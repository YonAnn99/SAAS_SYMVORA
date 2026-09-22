-- =============================================
-- 074: Compra directa (sin orden previa) + cancelacion que revierte stock
-- ---------------------------------------------
-- EL PROBLEMA. `/purchases` tenia un boton "Nueva compra" que pedia proveedor,
-- numero de factura y total, y hacia UN INSERT de cabecera: sin renglones, sin
-- IVA y sin tocar inventario. Medido en produccion antes de esta migracion:
-- de 12 compras, 5 eran cabeceras a mano por $7,500 con CERO renglones y CERO
-- IVA, frente a 7 nacidas de una orden con sus 7 renglones y $248 de IVA.
-- Casi la mitad del dinero registrado no movia una sola unidad de inventario.
--
-- Esos 5 apuntes no son un descuido: son la necesidad real de comprar sin orden
-- previa (ir a la bodega, pagar una factura suelta). Esta migracion la hace de
-- verdad.
--
-- TRES COSAS, EN ESTE ORDEN:
--   1. `detalle_compras.variante_id`, sin la cual no se puede revertir stock.
--   2. `registrar_compra_directa()`: compra sin orden que SI mueve inventario.
--   3. `cancelar_compra()`: el deshacer, que hoy no existe.
-- =============================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. `detalle_compras` tiene que saber a QUE CUBO fue el stock
-- ---------------------------------------------------------------------------
-- El renglon de una compra guardaba siempre el producto PADRE, incluso cuando
-- la recepcion acreditaba una variante (ver la nota de la 066: los stocks de
-- producto y variante son buckets separados). Mientras solo se sumara daba
-- igual. En cuanto existe `cancelar_compra`, deja de dar igual: revertir
-- leyendo solo `producto_id` restaria del cubo equivocado.
--
-- Caso real en produccion: la compra del 2026-09-16 ("sueter", 4 unidades)
-- vino de una orden cuyo renglon era de variante. El stock esta en la variante
-- y el renglon dice el padre.
ALTER TABLE public.detalle_compras
  ADD COLUMN IF NOT EXISTS variante_id UUID
    REFERENCES public.variantes_producto(id);

COMMENT ON COLUMN public.detalle_compras.variante_id IS
  'Variante que recibio el stock, o NULL si fue al producto padre. Sin esto no se puede revertir una compra: producto y variante son buckets de stock separados.';

CREATE INDEX IF NOT EXISTS idx_detalle_compras_variante
  ON public.detalle_compras (variante_id) WHERE variante_id IS NOT NULL;

-- Relleno de lo ya existente, SOLO cuando no hay ambiguedad: un unico renglon
-- de variante en la orden para ese producto. Si hubiera dos, no habria forma de
-- saber cual de los dos corresponde a esta entrega, y adivinar seria peor que
-- dejarlo en NULL — `cancelar_compra` sabe negarse ante un NULL ambiguo.
UPDATE public.detalle_compras d
SET variante_id = doc.variante_id
FROM public.compras c
JOIN public.detalle_orden_compra doc ON doc.orden_compra_id = c.orden_compra_id
WHERE d.compra_id = c.id
  AND d.variante_id IS NULL
  AND doc.producto_id = d.producto_id
  AND doc.variante_id IS NOT NULL
  AND (
    SELECT COUNT(*) FROM public.detalle_orden_compra d2
    WHERE d2.orden_compra_id = c.orden_compra_id
      AND d2.producto_id = d.producto_id
  ) = 1;

-- ---------------------------------------------------------------------------
-- 2. La recepcion de ordenes tambien anota la variante
-- ---------------------------------------------------------------------------
-- Cambio minimo sobre la 066: una columna mas en el INSERT de `detalle_compras`.
-- La FIRMA NO CAMBIA, asi que `CREATE OR REPLACE` y NO hay que tocar grants (un
-- DROP se llevaria los privilegios por delante sin necesidad — bug #23).
CREATE OR REPLACE FUNCTION public.recibir_orden_compra(
  p_orden_id UUID,
  p_items JSONB,
  p_numero_factura TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_orden RECORD;
  v_item JSONB;
  v_item_recibido RECORD;
  v_cantidad DECIMAL;
  v_todos_recibidos BOOLEAN := TRUE;
  v_compra_id UUID;
  v_subtotal DECIMAL := 0;
  v_impuesto DECIMAL := 0;
  v_tasa_iva DECIMAL := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_orden FROM public.ordenes_compra WHERE id = p_orden_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_tenant_id := v_orden.tenant_id;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = v_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para recibir ordenes de compra';
  END IF;

  IF v_orden.estado NOT IN ('ENVIADA', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'Order cannot be received in current state: %', v_orden.estado;
  END IF;

  IF v_orden.subtotal > 0 THEN
    v_tasa_iva := v_orden.impuesto / v_orden.subtotal;
  END IF;

  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW()
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := (v_item->>'cantidad_recibida')::DECIMAL;

    UPDATE public.detalle_orden_compra
    SET cantidad_recibida = cantidad_recibida + v_cantidad
    WHERE id = (v_item->>'detalle_id')::UUID
    AND orden_compra_id = p_orden_id
    RETURNING * INTO v_item_recibido;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El renglón % no pertenece a esta orden', v_item->>'detalle_id';
    END IF;

    IF v_item_recibido.variante_id IS NOT NULL THEN
      -- LA LINEA ES DE UNA VARIANTE: el stock va a la variante. El del
      -- producto padre NO se toca — son buckets independientes y el punto de
      -- venta descuenta de uno o de otro segun lo que se venda.
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.variante_id
        AND tenant_id = v_tenant_id;

      -- Si el id de variante no es de este negocio no se actualiza nada, y
      -- entonces el stock se habria perdido sin aviso.
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante del renglón % no pertenece a este negocio', v_item->>'detalle_id';
      END IF;
    ELSE
      UPDATE public.productos
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.producto_id
        AND tenant_id = v_tenant_id;
    END IF;

    -- El renglon guarda el producto PADRE y ademas la variante concreta
    -- (columna nueva en la 074). El padre se conserva para no romper lo que ya
    -- lee esta tabla; la variante es lo que permite revertir al cubo correcto.
    INSERT INTO public.detalle_compras (
      compra_id, producto_id, variante_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id,
      v_item_recibido.producto_id,
      v_item_recibido.variante_id,
      v_cantidad,
      v_item_recibido.costo_unitario,
      ROUND(v_cantidad * v_item_recibido.costo_unitario, 2)
    );

    v_subtotal := v_subtotal + v_cantidad * v_item_recibido.costo_unitario;

    IF v_item_recibido.cantidad_recibida < v_item_recibido.cantidad_solicitada THEN
      v_todos_recibidos := FALSE;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.detalle_orden_compra
    WHERE orden_compra_id = p_orden_id
      AND cantidad_recibida < cantidad_solicitada
  ) THEN
    v_todos_recibidos := FALSE;
  END IF;

  v_impuesto := ROUND(v_subtotal * v_tasa_iva, 2);
  v_subtotal := ROUND(v_subtotal, 2);

  UPDATE public.compras
  SET subtotal = v_subtotal,
      impuesto = v_impuesto,
      total = v_subtotal + v_impuesto
  WHERE id = v_compra_id;

  IF v_todos_recibidos THEN
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_TOTAL', fecha_recepcion = NOW(), actualizado_en = NOW()
    WHERE id = p_orden_id;
  ELSE
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_PARCIAL', fecha_recepcion = NOW(), actualizado_en = NOW()
    WHERE id = p_orden_id;
  END IF;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Compra directa: sin orden previa, pero con todos los efectos
-- ---------------------------------------------------------------------------
-- Hermano de `recibir_orden_compra` y con SUS MISMAS GUARDAS, porque comete el
-- mismo pecado: es SECURITY DEFINER y SUMA STOCK. El bug #33 fue exactamente
-- eso — un SECURITY DEFINER que sumaba stock sin validar nada.
--
-- QUE VIAJA DESDE EL CLIENTE Y QUE NO. El `costo_unitario` SI: es lo que cobro
-- el proveedor y solo lo sabe quien tiene la factura delante (no es el caso del
-- punto de venta, donde mandar el precio desde el navegador era el bug #5). El
-- `subtotal`, el `impuesto` y el `total` NO: se derivan de los renglones y se
-- calculan aqui. Aceptarlos tal cual permitiria que la pantalla dijera una cosa
-- y la base guardara otra, que es el fallo que ya sufrieron las ordenes.
--
-- LIMITACION CONOCIDA Y DELIBERADA: la comprobacion de permiso mira
-- `role_permissions` y no las excepciones por usuario, igual que
-- `recibir_orden_compra`. Se copia a proposito: dos RPC del mismo permiso
-- comportandose distinto seria peor que la limitacion.
CREATE OR REPLACE FUNCTION public.registrar_compra_directa(
  p_tenant_id UUID,
  p_proveedor_id UUID,
  p_items JSONB,
  p_numero_factura TEXT DEFAULT NULL,
  p_incluye_iva BOOLEAN DEFAULT TRUE,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_item JSONB;
  v_variante RECORD;
  v_producto_id UUID;
  v_variante_id UUID;
  v_cantidad DECIMAL;
  v_costo DECIMAL;
  v_compra_id UUID;
  v_subtotal DECIMAL := 0;
  v_impuesto DECIMAL := 0;
  -- IVA general en Mexico. Mismo numero que `TASA_IVA` en
  -- src/features/inventory/purchase-order-totals.ts.
  v_tasa_iva CONSTANT DECIMAL := 0.16;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para registrar compras';
  END IF;

  -- El proveedor tiene que ser de este negocio: sin orden que acote el
  -- conjunto, nada mas impide mandar el id de un proveedor ajeno.
  IF NOT EXISTS (
    SELECT 1 FROM public.proveedores
    WHERE id = p_proveedor_id AND tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'El proveedor no pertenece a este negocio';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra no tiene renglones';
  END IF;

  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, notas
  ) VALUES (
    p_tenant_id, p_proveedor_id, v_caller_id, NULL,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), p_notas
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := (v_item->>'cantidad')::DECIMAL;
    v_costo := (v_item->>'costo_unitario')::DECIMAL;
    v_variante_id := NULLIF(v_item->>'variante_id', '')::UUID;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada renglón debe ser mayor que cero';
    END IF;

    IF v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'El costo de cada renglón no puede ser negativo';
    END IF;

    IF v_variante_id IS NOT NULL THEN
      -- El `producto_id` se toma de la variante, NO del cliente: si llegaran
      -- descuadrados, el stock iria a un cubo y el renglon diria otro producto.
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_variante_id
        AND tenant_id = p_tenant_id
      RETURNING * INTO v_variante;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante % no pertenece a este negocio', v_variante_id;
      END IF;

      v_producto_id := v_variante.producto_id;
    ELSE
      v_producto_id := (v_item->>'producto_id')::UUID;

      UPDATE public.productos
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_producto_id
        AND tenant_id = p_tenant_id;

      -- Sin esta guarda, un id ajeno o inexistente no actualizaria nada y la
      -- compra quedaria registrada como si hubiera entrado mercancia.
      IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no pertenece a este negocio', v_producto_id;
      END IF;
    END IF;

    INSERT INTO public.detalle_compras (
      compra_id, producto_id, variante_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id, v_producto_id, v_variante_id, v_cantidad, v_costo,
      ROUND(v_cantidad * v_costo, 2)
    );

    v_subtotal := v_subtotal + v_cantidad * v_costo;
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);
  v_impuesto := CASE WHEN p_incluye_iva THEN ROUND(v_subtotal * v_tasa_iva, 2) ELSE 0 END;

  UPDATE public.compras
  SET subtotal = v_subtotal,
      impuesto = v_impuesto,
      total = v_subtotal + v_impuesto
  WHERE id = v_compra_id;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Cancelar una compra devolviendo el stock
-- ---------------------------------------------------------------------------
-- POR QUE HACE FALTA. El boton de borrar de /purchases hacia un DELETE duro,
-- sin confirmacion, que NO revertia el stock de una compra nacida de una orden.
-- En cuanto la compra directa suma inventario, teclear 100 en vez de 10 dejaria
-- stock fantasma sin forma de arreglarlo desde la pantalla.
--
-- `CANCELADA` ya existia en el enum `estado_compra` desde la migracion 001 y
-- NINGUN boton la producia: era un valor muerto. Aqui se le da su trabajo.
--
-- LO QUE NO DESHACE: `costo_compra`. Es "ultimo costo" y no se guarda el
-- anterior en ningun sitio, asi que revertirlo exigiria un historico de costos
-- que este esquema no tiene. Se deja como esta y la interfaz lo dice, en vez de
-- fingir que la cancelacion devuelve todo a su sitio.
CREATE OR REPLACE FUNCTION public.cancelar_compra(p_compra_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_compra RECORD;
  v_renglon RECORD;
  v_revertidos INT := 0;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe';
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = v_compra.tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar compras';
  END IF;

  IF v_compra.estado = 'CANCELADA' THEN
    RAISE EXCEPTION 'Esta compra ya está cancelada';
  END IF;

  -- Renglon ambiguo: el producto tiene variantes pero no se anoto cual recibio
  -- el stock (compras anteriores a la 074 que no se pudieron rellenar). Restar
  -- del padre dejaria el inventario peor que antes de cancelar, asi que se
  -- prefiere negarse y decirlo.
  IF EXISTS (
    SELECT 1
    FROM public.detalle_compras d
    WHERE d.compra_id = p_compra_id
      AND d.variante_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.variantes_producto v WHERE v.producto_id = d.producto_id
      )
  ) THEN
    RAISE EXCEPTION 'No se puede cancelar: esta compra es anterior al registro de variantes y no consta a qué talla o color entró el stock. Ajústalo a mano desde Inventario.';
  END IF;

  FOR v_renglon IN
    SELECT * FROM public.detalle_compras WHERE compra_id = p_compra_id
  LOOP
    IF v_renglon.variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual - v_renglon.cantidad,
          actualizado_en = NOW()
      WHERE id = v_renglon.variante_id
        AND tenant_id = v_compra.tenant_id;
    ELSE
      UPDATE public.productos
      SET stock_actual = stock_actual - v_renglon.cantidad,
          actualizado_en = NOW()
      WHERE id = v_renglon.producto_id
        AND tenant_id = v_compra.tenant_id;
    END IF;

    v_revertidos := v_revertidos + 1;
  END LOOP;

  UPDATE public.compras
  SET estado = 'CANCELADA'
  WHERE id = p_compra_id;

  RETURN jsonb_build_object(
    'compra_id', p_compra_id,
    'renglones_revertidos', v_revertidos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancelar_compra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_compra(UUID) TO authenticated;

COMMIT;

-- Verificacion (sondas en transaccion revertida, ver el plan):
--   compra directa de producto sin variantes  -> stock sube exacto
--   compra directa de variante                -> sube la variante, NO el padre
--   producto de otro negocio / cantidad 0     -> rechazados
--   cancelar_compra                           -> stock vuelve al valor previo
