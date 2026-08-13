-- =============================================
-- 017: Mercado Pago Point - cobro por terminal
-- ---------------------------------------------
-- Rastrea cada intento de cobro con terminal fisica
-- (Mercado Pago Point, Orders API). La venta NO se crea
-- al momento de crear la orden: se crea cuando llega el
-- webhook de Mercado Pago confirmando el pago
-- (RPC confirm_terminal_payment).
--
-- Ademas se refactoriza complete_sale(): su nucleo (bloqueo
-- FOR UPDATE, precios desde BD, clamp de descuento, insercion
-- de venta+detalle, descuento de stock y movimiento de caja)
-- se extrae a _crear_venta_desde_items(), reutilizado tanto por
-- complete_sale() (cajero, con auth/RBAC) como por
-- confirm_terminal_payment() (webhook, via service_role).
-- =============================================

-- =============================================
-- TABLA: pagos_terminal
-- =============================================

CREATE TABLE public.pagos_terminal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  cliente_id UUID REFERENCES public.clientes(id),
  mp_order_id TEXT,
  external_reference TEXT NOT NULL,
  monto DECIMAL(10,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'CREADA', -- CREADA | ESPERANDO_PAGO | PAGADA | RECHAZADA | CANCELADA
  payload_items JSONB NOT NULL DEFAULT '[]',
  venta_id UUID REFERENCES public.ventas(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (mp_order_id)
);

CREATE INDEX idx_pagos_terminal_tenant ON public.pagos_terminal(tenant_id, creado_en DESC);
CREATE INDEX idx_pagos_terminal_mp_order ON public.pagos_terminal(mp_order_id);

ALTER TABLE public.pagos_terminal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pagos_terminal_tenant_isolation" ON public.pagos_terminal
  FOR ALL TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "pagos_terminal_service_role" ON public.pagos_terminal
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- =============================================
-- NUCLEO: _crear_venta_desde_items()
-- ---------------------------------------------
-- Misma logica que complete_sale() pero SIN auth/RBAC:
-- valida cliente/stock, bloquea filas de productos, calcula
-- precios SOLO desde la BD, inserta venta+detalle, descuenta
-- stock y registra el movimiento de caja. Solo invocable por
-- service_role (lo usan complete_sale y el webhook).
-- =============================================

CREATE OR REPLACE FUNCTION public._crear_venta_desde_items(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID,
  p_metodo_pago public.metodo_pago,
  p_items JSONB,
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

  -- Validate cliente belongs to tenant (if provided)
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id AND tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Cliente invalido para este negocio';
    END IF;
  END IF;

  -- Items validados con precio bloqueado desde la BD.
  DROP TABLE IF EXISTS _venta_items;
  CREATE TEMP TABLE _venta_items (
    producto_id UUID NOT NULL,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0
  );

  -- Pass 1: lock + validate stock + compute totals (precio desde productos)
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

    -- Precio: SOLO desde la BD. El 'precioUnitario' del cliente se ignora.
    v_precio := v_producto.precio_venta;

    -- Descuento clampeado a [0, subtotal de linea]
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

  v_impuesto := ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2);
  v_total := ROUND(((v_subtotal - v_descuento + v_impuesto))::NUMERIC, 2);

  -- Insert venta
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

  -- Pass 2: insert detalle + decrement stock (precios desde la temp table)
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
    VALUES (v_caja_id, 'ENTRADA', v_total, 'Venta #' || LEFT(v_venta_id::text, 8) || ' - ' || p_metodo_pago::text);
  END IF;

  -- Return the created venta
  SELECT to_jsonb(v.*) INTO v_venta
  FROM public.ventas v
  WHERE v.id = v_venta_id;

  RETURN v_venta;
END;
$$;

REVOKE ALL ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) TO service_role;

-- =============================================
-- complete_sale() refactorizado: auth/RBAC + delega
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
    p_tenant_id, v_caller_id, p_cliente_id, p_metodo_pago, p_items, p_notas
  );
END;
$$;

-- Grant execute to authenticated users (misma firma que 009/011)
GRANT EXECUTE ON FUNCTION public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) TO authenticated;

-- =============================================
-- confirm_terminal_payment()
-- ---------------------------------------------
-- Invocado por el webhook de Mercado Pago. Idempotente:
-- si el mp_order_id ya tiene venta asignada, NO crea otra.
-- Solo invocable por service_role.
-- =============================================

CREATE OR REPLACE FUNCTION public.confirm_terminal_payment(
  p_mp_order_id TEXT,
  p_pagado BOOLEAN,
  p_estado TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pago RECORD;
  v_venta JSONB;
  v_estado TEXT;
BEGIN
  SELECT * INTO v_pago
  FROM public.pagos_terminal
  WHERE mp_order_id = p_mp_order_id
  FOR UPDATE;

  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'Orden de terminal no encontrada';
  END IF;

  -- Idempotencia: webhook duplicado no debe duplicar la venta
  IF v_pago.venta_id IS NOT NULL THEN
    SELECT to_jsonb(v.*) INTO v_venta
    FROM public.ventas v
    WHERE v.id = v_pago.venta_id;
    RETURN v_venta;
  END IF;

  IF NOT p_pagado THEN
    v_estado := COALESCE(p_estado, 'RECHAZADA');
    UPDATE public.pagos_terminal
    SET estado = v_estado,
        actualizado_en = NOW()
    WHERE id = v_pago.id;
    RETURN NULL;
  END IF;

  -- Pago aprobado: crear la venta desde el carrito guardado
  v_venta := public._crear_venta_desde_items(
    v_pago.tenant_id,
    v_pago.usuario_id,
    v_pago.cliente_id,
    'TARJETA_TERMINAL',
    v_pago.payload_items,
    'Pago con terminal Mercado Pago Point (orden ' || v_pago.external_reference || ')'
  );

  UPDATE public.pagos_terminal
  SET estado = 'PAGADA',
      venta_id = (v_venta->>'id')::UUID,
      actualizado_en = NOW()
  WHERE id = v_pago.id;

  RETURN v_venta;
END;
$$;

REVOKE ALL ON FUNCTION public.confirm_terminal_payment(TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_terminal_payment(TEXT, BOOLEAN, TEXT) TO service_role;