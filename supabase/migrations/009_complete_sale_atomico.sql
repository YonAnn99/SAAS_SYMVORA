-- =============================================
-- 009: complete_sale() - venta atomica
-- ---------------------------------------------
-- Reemplaza el patron "leer stock -> calcular -> escribir" del cliente
-- (expuesto a sobreventa en concurrencia y a datos parciales).
--
-- El RPC es SECURITY DEFINER y ejecuta TODO en una sola transaccion:
--   1. Bloquea cada producto con SELECT ... FOR UPDATE (mata la sobreventa).
--   2. Valida stock antes de escribir.
--   3. Inserta venta + detalle_ventas, decrementa stock, registra caja.
--   4. Nunca confia en JWT: lee rol de tenant_memberships y permiso de role_permissions.
-- =============================================

CREATE OR REPLACE FUNCTION public.complete_sale(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID DEFAULT NULL,
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_items JSONB DEFAULT NULL,
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
  v_producto RECORD;
  v_tenant_id UUID;
  v_venta_id UUID;
  v_subtotal DECIMAL(10,2) := 0;
  v_descuento DECIMAL(10,2) := 0;
  v_impuesto DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_line_subtotal DECIMAL(10,2) := 0;
  v_caja_id UUID;
  v_venta JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;

  -- RBAC desde la DB (no desde JWT): membresia real + permiso sales.create
  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'sales.create'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;

  -- Validate cliente belongs to tenant (if provided)
  IF p_cliente_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.clientes
    WHERE id = p_cliente_id AND tenant_id = p_tenant_id;
    IF v_tenant_id IS NULL THEN
      RAISE EXCEPTION 'Cliente invalido para este negocio';
    END IF;
  END IF;

  -- Pass 1: lock + validate stock + compute totals
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, tenant_id, nombre, stock_actual
    INTO v_producto
    FROM public.productos
    WHERE id = (v_item->>'productId')::UUID
    FOR UPDATE;

    IF v_producto.id IS NULL OR v_producto.tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Producto invalido para este negocio';
    END IF;

    IF (v_item->>'cantidad')::DECIMAL <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para "%"', v_producto.nombre;
    END IF;

    IF v_producto.stock_actual < (v_item->>'cantidad')::DECIMAL THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.stock_actual;
    END IF;

    v_subtotal := v_subtotal + ROUND(((v_item->>'precioUnitario')::DECIMAL * (v_item->>'cantidad')::DECIMAL)::NUMERIC, 2);
    v_descuento := v_descuento + ROUND(COALESCE((v_item->>'descuento')::DECIMAL, 0)::NUMERIC, 2);
  END LOOP;

  v_impuesto := ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2);
  v_total := ROUND(((v_subtotal - v_descuento + v_impuesto))::NUMERIC, 2);

  -- Insert venta
  INSERT INTO public.ventas (
    tenant_id, usuario_id, cliente_id,
    subtotal, impuesto, descuento, total,
    metodo_pago, estado, notas
  ) VALUES (
    p_tenant_id, v_caller_id, p_cliente_id,
    v_subtotal, v_impuesto, v_descuento, v_total,
    p_metodo_pago, 'COMPLETADA', p_notas
  )
  RETURNING id INTO v_venta_id;

  -- Pass 2: insert detalle + decrement stock
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_line_subtotal := ROUND(((v_item->>'precioUnitario')::DECIMAL * (v_item->>'cantidad')::DECIMAL)::NUMERIC, 2);

    INSERT INTO public.detalle_ventas (
      venta_id, producto_id, cantidad, precio_unitario, subtotal, descuento
    ) VALUES (
      v_venta_id,
      (v_item->>'productId')::UUID,
      (v_item->>'cantidad')::DECIMAL,
      (v_item->>'precioUnitario')::DECIMAL,
      v_line_subtotal,
      ROUND(COALESCE((v_item->>'descuento')::DECIMAL, 0)::NUMERIC, 2)
    );

    UPDATE public.productos
    SET stock_actual = stock_actual - (v_item->>'cantidad')::DECIMAL,
        actualizado_en = NOW()
    WHERE id = (v_item->>'productId')::UUID;
  END LOOP;

  -- Register caja movement if there is an open caja for this user/tenant
  SELECT id INTO v_caja_id
  FROM public.cajas
  WHERE tenant_id = p_tenant_id
    AND usuario_id = v_caller_id
    AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC
  LIMIT 1;

  IF v_caja_id IS NOT NULL THEN
    INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion)
    VALUES (v_caja_id, 'ENTRADA', v_total, 'Venta #' || LEFT(v_venta_id::text, 8) || ' - ' || p_metodo_pago::text);
  END IF;

  -- Return the created venta
  SELECT to_jsonb(v.*) INTO v_venta
  FROM public.ventas v
  WHERE v.id = v_venta_id;

  RETURN v_venta;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) TO authenticated;