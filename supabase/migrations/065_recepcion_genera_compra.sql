-- =============================================
-- 065: Recibir una orden de compra genera la compra, suma stock y fija el costo
-- ---------------------------------------------
-- EL PROBLEMA: /purchases y /purchase-orders eran dos silos sin un solo punto
-- de contacto. Ni FK, ni columna, ni RPC que creara una a partir de la otra.
-- El boton "Recibir" de una orden hacia un UPDATE del estado y nada mas:
--   - no sumaba stock,
--   - no rellenaba `cantidad_recibida`,
--   - no dejaba rastro en `compras`.
-- Medido en produccion antes de esta migracion: 6 ordenes, 27 unidades
-- solicitadas, 0 recibidas, y `detalle_compras` VACIA desde la migracion 001.
--
-- LO QUE YA ESTABA HECHO: `recibir_orden_compra` existe desde la 005 y la 053
-- lo blindo (RBAC contra la base, tenant desde el registro). Hace lo dificil:
-- acumula lo recibido, suma stock y decide entre RECIBIDA_PARCIAL y
-- RECIBIDA_TOTAL. La interfaz NUNCA lo llamaba — solo aparecia en el fichero
-- de tipos generado. Esta migracion lo amplia; no lo reescribe desde cero.
--
-- LO QUE SE AÑADE:
--   1. `compras.orden_compra_id` + `subtotal` + `impuesto`.
--   2. El RPC crea la compra y sus renglones en la MISMA transaccion.
--   3. El RPC fija `productos.costo_compra` con el costo de la orden.
--   4. `p_numero_factura`: la factura llega con la mercancia.
--
-- ⚠️ CAMBIA LA FIRMA, y eso arrastra dos trampas que este proyecto ya sufrio:
--   - Bug #18 (sobrecarga huerfana): añadir un parametro con DEFAULT NO
--     sustituye la funcion, crea una SEGUNDA. Postgres se queda con las dos y
--     la llamada de dos argumentos seguiria yendo a la version vieja, que no
--     crea la compra. Por eso hay un DROP explicito de la firma antigua.
--   - Bug #23 (grants perdidos): DROP se lleva los privilegios por delante. Hay
--     que rehacer el GRANT y el REVOKE de la migracion 020, o el RPC queda
--     inalcanzable (o, peor, abierto a `anon`).
-- =============================================

BEGIN;

-- =============================================
-- 1. Las columnas que faltaban en `compras`
-- =============================================

ALTER TABLE public.compras
  -- NULLABLE: se conservan las dos vias. Una compra puede nacer de una orden
  -- (queda ligada) o seguir siendo una factura suelta anotada a mano.
  --
  -- SIN UNIQUE: una recepcion parcial genera UNA COMPRA POR ENTREGA, asi que
  -- una misma orden puede tener varias.
  --
  -- ON DELETE SET NULL, no CASCADE: borrar una orden no puede llevarse por
  -- delante el historico de lo que ya se pago.
  ADD COLUMN IF NOT EXISTS orden_compra_id UUID
    REFERENCES public.ordenes_compra(id) ON DELETE SET NULL,

  -- `compras` solo tenia `total`; la orden si desglosa. Sin estas dos, la
  -- compra generada perderia el IVA.
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS impuesto DECIMAL(10,2);

-- Para listar "las compras de esta orden" sin recorrer la tabla entera.
CREATE INDEX IF NOT EXISTS idx_compras_orden_compra
  ON public.compras (orden_compra_id)
  WHERE orden_compra_id IS NOT NULL;

-- =============================================
-- 2. Reparar las ordenes con fecha de recepcion falsa
-- ---------------------------------------------
-- `updateOrderStatus` escribia `fecha_recepcion` tambien al pasar a ENVIADA,
-- asi que las 6 ordenes de produccion estan en ENVIADA con fecha de recepcion
-- pese a no haber recibido nada (0 de 27 unidades). El origen queda corregido
-- en `purchase-order-service.ts`; esto limpia lo ya guardado.
--
-- ⚠️ EL `WHERE` NO ES COSMETICO: sin el se borraria la fecha de las ordenes
-- realmente recibidas.
-- =============================================

UPDATE public.ordenes_compra
   SET fecha_recepcion = NULL
 WHERE estado = 'ENVIADA'
   AND fecha_recepcion IS NOT NULL;

-- =============================================
-- 3. El RPC ampliado
-- =============================================

-- Ver bug #18 arriba: sin este DROP quedarian dos funciones.
DROP FUNCTION IF EXISTS public.recibir_orden_compra(UUID, JSONB);

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
  v_todos_recibidos BOOLEAN := TRUE;
  v_item_recibido RECORD;
  v_tasa_iva NUMERIC := 0;
  v_subtotal NUMERIC := 0;
  v_impuesto NUMERIC := 0;
  v_compra_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- El tenant sale de la ORDEN, no del claim del JWT. El claim es el de la
  -- membresia mas reciente: para alguien con dos negocios podia ser el
  -- equivocado. (Bloque heredado de la 053; se conserva intacto.)
  SELECT * INTO v_orden
  FROM public.ordenes_compra
  WHERE id = p_orden_id;

  IF v_orden IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_tenant_id := v_orden.tenant_id;

  -- SECURITY DEFINER salta RLS: sin esta comprobacion cualquier miembro del
  -- negocio (incluido un CAJERO) podria recibir mercancia y alterar stock.
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

  -- La tasa EFECTIVA de la orden, no un 16 % fijo: si una orden se guardo con
  -- otra tasa, la compra generada debe cuadrar con ella. Con subtotal 0 se
  -- queda en 0 en vez de dividir por cero.
  IF v_orden.subtotal > 0 THEN
    v_tasa_iva := v_orden.impuesto / v_orden.subtotal;
  END IF;

  -- La compra se crea ANTES del bucle para tener su id al insertar los
  -- renglones. Los importes se rellenan al final, ya sumados.
  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW()
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    UPDATE public.detalle_orden_compra
    SET cantidad_recibida = cantidad_recibida + (v_item->>'cantidad_recibida')::DECIMAL
    WHERE id = (v_item->>'detalle_id')::UUID
    AND orden_compra_id = p_orden_id
    RETURNING * INTO v_item_recibido;

    -- Un detalle_id que no pertenece a esta orden no actualiza ninguna fila.
    -- Se usa `NOT FOUND` y no `v_item_recibido IS NULL`: un RECORD conserva el
    -- valor de la vuelta ANTERIOR cuando el UPDATE no devuelve nada, asi que
    -- sin esta guarda el stock del producto anterior se sumaria dos veces.
    IF NOT FOUND THEN
      RAISE EXCEPTION 'El renglón % no pertenece a esta orden', v_item->>'detalle_id';
    END IF;

    -- El UPDATE se acota tambien por tenant: sin eso, un detalle_id de otro
    -- negocio podria mover stock ajeno.
    UPDATE public.productos
    SET stock_actual = stock_actual + (v_item->>'cantidad_recibida')::DECIMAL,
        -- ULTIMO COSTO: el producto toma lo que se acaba de pagar. Es un
        -- cambio VISIBLE — de `costo_compra` sale el margen del catalogo.
        costo_compra = v_item_recibido.costo_unitario,
        actualizado_en = NOW()
    WHERE id = v_item_recibido.producto_id
      AND tenant_id = v_tenant_id;

    -- El renglon de la compra: lo que llego EN ESTA ENTREGA, no lo pedido.
    INSERT INTO public.detalle_compras (
      compra_id, producto_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id,
      v_item_recibido.producto_id,
      (v_item->>'cantidad_recibida')::DECIMAL,
      v_item_recibido.costo_unitario,
      ROUND((v_item->>'cantidad_recibida')::DECIMAL * v_item_recibido.costo_unitario, 2)
    );

    v_subtotal := v_subtotal
      + (v_item->>'cantidad_recibida')::DECIMAL * v_item_recibido.costo_unitario;

    IF v_item_recibido.cantidad_recibida < v_item_recibido.cantidad_solicitada THEN
      v_todos_recibidos := FALSE;
    END IF;
  END LOOP;

  -- ⚠️ Una linea que NO viene en `p_items` no pasa por el bucle, asi que su
  -- estado no se revisa ahi. Se comprueba aparte: si queda algo pendiente en
  -- cualquier renglon de la orden, la recepcion es PARCIAL.
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
    'success', true,
    'orden_id', p_orden_id,
    'compra_id', v_compra_id,
    'total', v_subtotal + v_impuesto,
    'nuevo_estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END
  );
END;
$$;

-- Ver bug #23 arriba: el DROP se llevo los privilegios.
REVOKE ALL ON FUNCTION public.recibir_orden_compra(UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recibir_orden_compra(UUID, JSONB, TEXT) TO authenticated;

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- UNA sola funcion, no dos (bug #18):
--   SELECT oid::regprocedure FROM pg_proc WHERE proname = 'recibir_orden_compra';
--
--   -- Los privilegios volvieron (bug #23):
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--    WHERE routine_name = 'recibir_orden_compra';
--
--   -- Las columnas nuevas:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name = 'compras' ORDER BY ordinal_position;
--
--   -- Ninguna orden ENVIADA con fecha de recepcion:
--   SELECT count(*) FROM public.ordenes_compra
--    WHERE estado = 'ENVIADA' AND fecha_recepcion IS NOT NULL;   -- 0
-- =============================================
