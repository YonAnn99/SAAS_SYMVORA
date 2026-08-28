-- Migration 040: Add p_include_iva parameter to complete_sale and _crear_venta_desde_items
-- Allows the POS to optionally exclude IVA from the sale total

BEGIN;

-- =============================================
-- complete_sale() — add p_include_iva param
-- =============================================

DROP FUNCTION IF EXISTS public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public.complete_sale(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID DEFAULT NULL,
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_items JSONB DEFAULT NULL,
  p_include_iva BOOLEAN DEFAULT TRUE,
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

  RETURN public._crear_venta_desde_items(
    p_tenant_id, v_caller_id, p_cliente_id, p_metodo_pago, p_items, p_include_iva, p_notas
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT) TO authenticated;

-- =============================================
-- _crear_venta_desde_items() — add p_include_iva param
-- =============================================

DROP FUNCTION IF EXISTS public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT);

CREATE OR REPLACE FUNCTION public._crear_venta_desde_items(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID,
  p_metodo_pago public.metodo_pago,
  p_items JSONB,
  p_include_iva BOOLEAN DEFAULT TRUE,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_line RECORD;
  v_producto RECORD;
  v_venta_id UUID;
  v_subtotal DECIMAL(10,2) := 0;
  v_descuento DECIMAL(10,2) := 0;
  v_impuesto DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_line_subtotal DECIMAL(10,2) := 0;
  v_line_descuento DECIMAL(10,2) := 0;
  v_precio DECIMAL(10,2);
  v_cantidad DECIMAL(10,3);
  v_caja_id UUID;
  v_venta JSONB;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;

  -- CREDITO requiere cliente (para rastrear saldo_pendiente)
  IF p_metodo_pago = 'CREDITO' AND p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona un cliente para la venta a credito';
  END IF;

  -- Validate cliente belongs to tenant (if provided)
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id AND tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Cliente invalido para este negocio';
    END IF;
  END IF;

  DROP TABLE IF EXISTS _venta_items;
  CREATE TEMP TABLE _venta_items (
    producto_id UUID NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, tenant_id, nombre, stock_actual, precio_venta
    INTO v_producto
    FROM public.productos
    WHERE id = (v_item->>'productId')::UUID
    FOR UPDATE;

    IF v_producto.id IS NULL OR v_producto.tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Producto invalido para este negocio';
    END IF;

    v_cantidad := (v_item->>'cantidad')::DECIMAL;
    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para "%"', v_producto.nombre;
    END IF;

    IF v_producto.stock_actual < v_cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.stock_actual;
    END IF;

    v_precio := v_producto.precio_venta;

    v_line_descuento := ROUND(COALESCE((v_item->>'descuento')::DECIMAL, 0)::NUMERIC, 2);
    IF v_line_descuento < 0 THEN
      v_line_descuento := 0;
    END IF;
    IF v_line_descuento > ROUND((v_precio * v_cantidad)::NUMERIC, 2) THEN
      v_line_descuento := ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    END IF;

    v_subtotal := v_subtotal + ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    v_descuento := v_descuento + v_line_descuento;

    INSERT INTO _venta_items (producto_id, cantidad, precio_venta, descuento)
    VALUES (
      (v_item->>'productId')::UUID,
      v_cantidad,
      v_precio,
      v_line_descuento
    );
  END LOOP;

  -- IVA: conditionally apply 16% based on p_include_iva
  v_impuesto := CASE WHEN p_include_iva
    THEN ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2)
    ELSE 0 END;
  v_total := ROUND(((v_subtotal - v_descuento + v_impuesto))::NUMERIC, 2);

  INSERT INTO public.ventas (
    tenant_id, usuario_id, cliente_id,
    subtotal, impuesto, descuento, total,
    metodo_pago, estado, notas
  ) VALUES (
    p_tenant_id, p_usuario_id, p_cliente_id,
    v_subtotal, v_impuesto, v_descuento, v_total,
    p_metodo_pago, 'COMPLETADA', p_notas
  )
  RETURNING id INTO v_venta_id;

  FOR v_line IN SELECT producto_id, cantidad, precio_venta, descuento FROM _venta_items
  LOOP
    v_line_subtotal := ROUND((v_line.precio_venta * v_line.cantidad)::NUMERIC, 2);

    INSERT INTO public.detalle_ventas (
      venta_id, producto_id, cantidad, precio_unitario, subtotal, descuento
    ) VALUES (
      v_venta_id,
      v_line.producto_id,
      v_line.cantidad,
      v_line.precio_venta,
      v_line_subtotal,
      v_line.descuento
    );

    UPDATE public.productos
    SET stock_actual = stock_actual - v_line.cantidad,
        actualizado_en = NOW()
    WHERE id = v_line.producto_id;
  END LOOP;

  -- CREDITO: acumular saldo pendiente del cliente
  IF p_metodo_pago = 'CREDITO' THEN
    UPDATE public.clientes
    SET saldo_pendiente = saldo_pendiente + v_total
    WHERE id = p_cliente_id;
  END IF;

  -- Register caja movement if there is an open caja for this user/tenant
  SELECT id INTO v_caja_id
  FROM public.cajas
  WHERE tenant_id = p_tenant_id
    AND usuario_id = p_usuario_id
    AND estado = 'ABIERTA'
  ORDER BY fecha_apertura DESC
  LIMIT 1;

  IF v_caja_id IS NOT NULL THEN
    INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion)
    VALUES (v_caja_id, 'VENTA', v_total, 'Venta #' || LEFT(v_venta_id::text, 8) || ' - ' || p_metodo_pago::text);
  END IF;

  SELECT to_jsonb(v.*) INTO v_venta
  FROM public.ventas v
  WHERE v.id = v_venta_id;

  RETURN v_venta;
END;
$$;

REVOKE ALL ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT) TO service_role;

COMMIT;
