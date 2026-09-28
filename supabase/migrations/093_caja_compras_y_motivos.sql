-- 093_caja_compras_y_motivos.sql
-- Compras pagadas con efectivo de la caja, y motivo de las salidas de caja.
--
-- 1. `movimientos_caja.concepto`: por que salio (o volvio) el dinero. Las
--    salidas manuales ahora llevan motivo (deposito al banco, retiro del dueno
--    u otro gasto) y las que genera el sistema al pagar una compra se marcan
--    como COMPRA. NULL en lo anterior a esta migracion, en las entradas
--    manuales y en los movimientos de venta.
-- 2. `movimientos_caja.compra_id`: la compra que pago una salida. Es lo que
--    permite devolver el dinero a la caja al cancelar la compra.
-- 3. `registrar_compra_directa` y `recibir_orden_compra` aceptan `p_caja_id`:
--    si viene, la SALIDA se registra en la MISMA transaccion que la compra.
--    Si la caja ya no esta abierta, no se registra ninguna de las dos.
-- 4. `cancelar_compra` devuelve el dinero a la caja si la caja de donde salio
--    sigue abierta. Con el corte ya cerrado no lo toca: reabrir un corte
--    cerrado lo descuadraria; la pantalla avisa para ajustarlo a mano.

-- ---------------------------------------------------------------------------
-- 1 y 2. Columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.movimientos_caja
  ADD COLUMN IF NOT EXISTS concepto TEXT NULL,
  ADD COLUMN IF NOT EXISTS compra_id UUID NULL REFERENCES public.compras(id) ON DELETE SET NULL;

ALTER TABLE public.movimientos_caja
  DROP CONSTRAINT IF EXISTS movimientos_caja_concepto_check;
ALTER TABLE public.movimientos_caja
  ADD CONSTRAINT movimientos_caja_concepto_check CHECK (
    concepto IS NULL OR concepto IN (
      'DEPOSITO_BANCO', 'RETIRO_EFECTIVO', 'OTRO_GASTO', 'COMPRA', 'DEVOLUCION_COMPRA'
    )
  );

CREATE INDEX IF NOT EXISTS idx_movimientos_caja_compra_id
  ON public.movimientos_caja(compra_id)
  WHERE compra_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Auxiliar: la salida de caja que paga una compra.
-- Solo la llaman las funciones de abajo (SECURITY DEFINER); nadie mas puede
-- ejecutarla directamente.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pagar_compra_con_caja(
  p_caja_id UUID,
  p_tenant_id UUID,
  p_compra_id UUID,
  p_monto DECIMAL,
  p_descripcion TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- La caja tiene que ser del que registra y seguir abierta. FOR UPDATE: que
  -- nadie la cierre entre esta comprobacion y el INSERT.
  PERFORM 1 FROM public.cajas
  WHERE id = p_caja_id
    AND tenant_id = p_tenant_id
    AND usuario_id = auth.uid()
    AND estado = 'ABIERTA'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Tu caja ya no está abierta: abre una en Finanzas o registra la compra sin descontarla de la caja';
  END IF;

  -- Una compra de importe cero no mueve dinero.
  IF p_monto > 0 THEN
    INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, concepto, compra_id)
    VALUES (p_caja_id, 'SALIDA', p_monto, p_descripcion, 'COMPRA', p_compra_id);
  END IF;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public._pagar_compra_con_caja(UUID, UUID, UUID, DECIMAL, TEXT)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3a. registrar_compra_directa + p_caja_id
-- Igual que la version vigente (074/082/085) salvo el pago con caja al final.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT, UUID);

CREATE FUNCTION public.registrar_compra_directa(
  p_tenant_id uuid,
  p_proveedor_id uuid,
  p_items jsonb,
  p_numero_factura text DEFAULT NULL::text,
  p_incluye_iva boolean DEFAULT true,
  p_notas text DEFAULT NULL::text,
  p_sucursal_id uuid DEFAULT NULL::uuid,
  p_caja_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_tasa_iva CONSTANT DECIMAL := 0.16;
  v_sucursal UUID;
  v_proveedor TEXT;
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

  SELECT nombre INTO v_proveedor
  FROM public.proveedores
  WHERE id = p_proveedor_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor no pertenece a este negocio';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra no tiene renglones';
  END IF;

  -- El local que RECIBE la mercancia. Sin sucursal explicita, el de por
  -- defecto: para un negocio de uno solo, el comportamiento de siempre.
  v_sucursal := public._sucursal_para_usuario(p_tenant_id, p_sucursal_id);

  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, notas, sucursal_id
  ) VALUES (
    p_tenant_id, p_proveedor_id, v_caller_id, NULL,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), p_notas, v_sucursal
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
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_variante_id
        AND tenant_id = p_tenant_id
      RETURNING * INTO v_variante;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante % no pertenece a este negocio', v_variante_id;
      END IF;

      v_producto_id := v_variante.producto_id;

      PERFORM public.mover_stock(v_sucursal, v_producto_id, v_variante_id, v_cantidad);
    ELSE
      v_producto_id := (v_item->>'producto_id')::UUID;

      UPDATE public.productos
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_producto_id
        AND tenant_id = p_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_producto_id, NULL, v_cantidad);

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

  -- Pagada con efectivo de la caja: la salida va en esta misma transaccion.
  IF p_caja_id IS NOT NULL THEN
    PERFORM public._pagar_compra_con_caja(
      p_caja_id, p_tenant_id, v_compra_id, v_subtotal + v_impuesto,
      'Compra a ' || v_proveedor
        || COALESCE(' · Factura ' || NULLIF(TRIM(p_numero_factura), ''), '')
    );
  END IF;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto,
    'pagada_con_caja', p_caja_id IS NOT NULL
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT, UUID, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT, UUID, UUID)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3b. recibir_orden_compra + p_caja_id
-- Igual que la version vigente (065/079/082/085) salvo el pago con caja.
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.recibir_orden_compra(UUID, JSONB, TEXT);

CREATE FUNCTION public.recibir_orden_compra(
  p_orden_id uuid,
  p_items jsonb,
  p_numero_factura text DEFAULT NULL::text,
  p_caja_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  v_sucursal UUID;
  v_proveedor TEXT;
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

  -- A que local va la mercancia: el que se decidio al pedirla. Se revalida
  -- contra el negocio, por si la orden apuntara a una sucursal ajena.
  v_sucursal := public._sucursal_para_usuario(v_tenant_id, v_orden.sucursal_id);

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
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, sucursal_id
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), v_sucursal
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
      UPDATE public.variantes_producto
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.variante_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_item_recibido.producto_id, v_item_recibido.variante_id, v_cantidad);

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante del renglón % no pertenece a este negocio', v_item->>'detalle_id';
      END IF;
    ELSE
      UPDATE public.productos
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.producto_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_item_recibido.producto_id, NULL, v_cantidad);
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

  -- Pagada con efectivo de la caja: la salida es por lo que llego en ESTA
  -- recepcion (la compra que acaba de generarse), no por toda la orden.
  IF p_caja_id IS NOT NULL THEN
    SELECT nombre INTO v_proveedor FROM public.proveedores WHERE id = v_orden.proveedor_id;
    PERFORM public._pagar_compra_con_caja(
      p_caja_id, v_tenant_id, v_compra_id, v_subtotal + v_impuesto,
      'Recepción ' || v_orden.numero_orden || COALESCE(' · ' || v_proveedor, '')
    );
  END IF;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto,
    'pagada_con_caja', p_caja_id IS NOT NULL
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.recibir_orden_compra(UUID, JSONB, TEXT, UUID)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recibir_orden_compra(UUID, JSONB, TEXT, UUID)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. cancelar_compra: devuelve el efectivo si la caja sigue abierta.
-- Misma firma y tipo de retorno: CREATE OR REPLACE conserva los permisos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_compra(p_compra_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_compra RECORD;
  v_renglon RECORD;
  v_revertidos INT := 0;
  v_pago RECORD;
  v_devuelto DECIMAL := 0;
  v_caja_cerrada BOOLEAN := FALSE;
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

  -- Renglon ambiguo: el producto tiene variantes pero no consta cual recibio el
  -- stock (compras anteriores a la 074 que no se pudieron rellenar). Restar del
  -- padre dejaria el inventario peor que antes de cancelar.
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
    PERFORM public.mover_stock(v_compra.sucursal_id, v_renglon.producto_id, v_renglon.variante_id, -v_renglon.cantidad);

    v_revertidos := v_revertidos + 1;
  END LOOP;

  UPDATE public.compras
  SET estado = 'CANCELADA'
  WHERE id = p_compra_id;

  -- Si se pago con efectivo de una caja, el dinero vuelve a ESA caja mientras
  -- siga abierta. Con el corte cerrado no se toca (reabrirlo lo descuadraria).
  FOR v_pago IN
    SELECT m.caja_id, m.monto, c.estado AS estado_caja
    FROM public.movimientos_caja m
    JOIN public.cajas c ON c.id = m.caja_id
    WHERE m.compra_id = p_compra_id
      AND m.concepto = 'COMPRA'
    FOR UPDATE OF c
  LOOP
    IF v_pago.estado_caja = 'ABIERTA' THEN
      INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, concepto, compra_id)
      VALUES (
        v_pago.caja_id, 'ENTRADA', v_pago.monto,
        'Devolución de compra cancelada'
          || COALESCE(' · Factura ' || NULLIF(TRIM(v_compra.numero_factura), ''), ''),
        'DEVOLUCION_COMPRA', p_compra_id
      );
      v_devuelto := v_devuelto + v_pago.monto;
    ELSE
      v_caja_cerrada := TRUE;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'compra_id', p_compra_id,
    'renglones_revertidos', v_revertidos,
    'devuelto_a_caja', v_devuelto,
    'caja_cerrada', v_caja_cerrada
  );
END;
$function$;
