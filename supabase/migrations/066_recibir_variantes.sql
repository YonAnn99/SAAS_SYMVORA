-- =============================================
-- 066: Recibir una orden acredita el stock de la VARIANTE, no del padre
-- ---------------------------------------------
-- EL PROBLEMA: `detalle_orden_compra.variante_id` existe desde la migracion
-- 005, pero `recibir_orden_compra` NUNCA lo miraba: sumaba siempre a
-- `productos.stock_actual`.
--
-- Mientras la interfaz no dejaba pedir variantes, eso no se notaba. Ahora el
-- dialogo de nueva orden si permite pedir "sueter · M / ROJO", y sin este
-- cambio el inventario quedaria mal EN SILENCIO: los stocks son buckets
-- SEPARADOS. Medido en produccion: sueter tiene 42 en el padre y su variante
-- M/ROJO tiene 3 propios. Recibir 10 tallas M habria dejado 52 en el padre y 3
-- en la talla — el numero total cuadra y el inventario real no.
--
-- Se sigue el mismo patron que ya usa `ajustar_inventario` (migracion 053b),
-- que si distingue variante de producto desde siempre.
--
-- ⚠️ Misma trampa que en la 065, pero al reves: la firma NO cambia, asi que
-- basta `CREATE OR REPLACE` y NO hay que tocar grants. Un DROP aqui si se
-- llevaria los privilegios por delante sin necesidad (bug #23).
-- =============================================

BEGIN;

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
  v_cantidad NUMERIC;
  v_tasa_iva NUMERIC := 0;
  v_subtotal NUMERIC := 0;
  v_impuesto NUMERIC := 0;
  v_compra_id UUID;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_orden
  FROM public.ordenes_compra
  WHERE id = p_orden_id;

  IF v_orden IS NULL THEN
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

    -- El renglon de la compra guarda SIEMPRE el producto padre: `detalle_compras`
    -- no tiene columna de variante. El desglose fino vive en la orden.
    INSERT INTO public.detalle_compras (
      compra_id, producto_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id,
      v_item_recibido.producto_id,
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
    'success', true,
    'orden_id', p_orden_id,
    'compra_id', v_compra_id,
    'total', v_subtotal + v_impuesto,
    'nuevo_estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END
  );
END;
$$;

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- Sigue habiendo UNA sola funcion y con sus grants (no se hizo DROP):
--   SELECT oid::regprocedure FROM pg_proc WHERE proname = 'recibir_orden_compra';
--   SELECT grantee, privilege_type FROM information_schema.routine_privileges
--    WHERE routine_name = 'recibir_orden_compra';
--
--   -- Tras recibir una linea con variante, el stock sube en la VARIANTE y el
--   -- del padre se queda igual:
--   SELECT p.nombre, p.stock_actual AS padre, v.talla, v.stock_actual AS variante
--     FROM public.productos p
--     JOIN public.variantes_producto v ON v.producto_id = p.id;
-- =============================================
