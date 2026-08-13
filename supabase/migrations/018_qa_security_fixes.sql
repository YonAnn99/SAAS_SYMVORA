-- =============================================
-- 018: QA - correcciones de seguridad y errores
-- ---------------------------------------------
-- Bugs encontrados durante el QA post-lanzamiento:
--
--  1. [CRITICO] reset_demo_tenant() usaba TRUNCATE global sobre
--     detalle_ventas y movimientos_caja -> borraba las filas de TODOS
--     los tenants. Ahora hace DELETE scoped al tenant demo.
--     Ademas se REVOCA el EXECUTE a PUBLIC/anon/authenticated.
--
--  2. [CRITICO] trial_codes: la policy "Anyone can read unused trial
--     codes" (FOR SELECT, sin TO) exponia todos los codigos sin usar
--     a anon, y "Service role can manage trial codes" (FOR ALL, sin
--     TO) permitia a anon INSERT/UPDATE/DELETE. Ahora solo service_role.
--
--  3. [CRITICO] redeem_trial_code() era ejecutable por PUBLIC (default)
--     y por authenticated con argumentos arbitrarios (p_tenant_id de
--     cualquier tenant). Ahora solo service_role.
--
--  4. [ALTO] subscriptions/payment_history INSERT con WITH CHECK (true)
--     sin TO -> PUBLIC podia insertar filas. Ahora solo service_role.
--
--  5. [MEDIO] get_next_folio(), has_active_subscription(),
--     get_subscription_info() ejecutables por authenticated (y PUBLIC)
--     sin validar pertenencia al tenant. Ahora solo service_role.
--
--  6. [MEDIO] log_activity() SECURITY DEFINER aceptaba p_user_id
--     arbitrario -> cualquier rol podia inyectar actividad de otros
--     usuarios. Ahora exige auth.uid() = p_user_id y se revoca a anon.
--
--  7. [ALTO] Doble conteo de ventas en el cierre de caja: complete_sale
--     insertaba un movimiento de caja tipo 'ENTRADA' por cada venta y
--     la pagina de finanzas sumaba ademas totalVentas (tabla ventas).
--     Se agrega el valor 'VENTA' a tipo_movimiento: las ventas ya no
--     inflan totalEntradas. De paso se corrige el flujo CREDITO:
--     requiere cliente y descuenta saldo_pendiente.
-- =============================================

BEGIN;

-- =============================================
-- 1. reset_demo_tenant() con limpieza scoped
-- =============================================

CREATE OR REPLACE FUNCTION public.reset_demo_tenant()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_demo_email TEXT := 'demo@symvora.com';
  v_demo_user_id UUID;
  v_tenant_id UUID;
  v_caja_id UUID;
  v_producto RECORD;
  v_cliente_id UUID;
  v_venta_id UUID;
  v_subtotal DECIMAL(10,2);
  v_total DECIMAL(10,2);
  v_metodo public.metodo_pago;
  v_dias_atras INT;
  v_items JSONB;
  v_clientes_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('reset_demo_tenant'));

  SELECT id INTO v_demo_user_id
  FROM auth.users
  WHERE email = v_demo_email
  LIMIT 1;

  IF v_demo_user_id IS NULL THEN
    RAISE EXCEPTION 'Demo user % no existe. Ejecutar 013_demo_user_seed.sql primero.', v_demo_email;
  END IF;

  INSERT INTO public.tenants (
    nombre_comercial,
    subdominio,
    giro_comercial,
    color_primario,
    telefono,
    email,
    direccion,
    subscription_status
  ) VALUES (
    'Abarrotes Don Pedro',
    'abarrotes-don-pedro',
    'ABARROTES',
    '#2563eb',
    '5551234567',
    'demo@symvora.com',
    'Av. Insurgentes Sur 1234, CDMX',
    'active'
  )
  ON CONFLICT (subdominio) DO UPDATE
    SET nombre_comercial = EXCLUDED.nombre_comercial,
        giro_comercial   = EXCLUDED.giro_comercial,
        color_primario   = EXCLUDED.color_primario,
        telefono         = EXCLUDED.telefono,
        email            = EXCLUDED.email,
        direccion        = EXCLUDED.direccion,
        subscription_status = 'active'
  RETURNING id INTO v_tenant_id;

  ----------------------------------------------------------------------
  -- 3. Limpieza: SOLO del tenant demo (DELETE scoped, nunca TRUNCATE
  --    global: un TRUNCATE borraria las ventas de todos los tenants).
  ----------------------------------------------------------------------
  DELETE FROM public.detalle_ventas
  WHERE venta_id IN (SELECT id FROM public.ventas WHERE tenant_id = v_tenant_id);
  DELETE FROM public.movimientos_caja
  WHERE caja_id IN (SELECT id FROM public.cajas WHERE tenant_id = v_tenant_id);
  DELETE FROM public.ventas WHERE tenant_id = v_tenant_id;
  DELETE FROM public.detalle_compras WHERE compra_id IN (SELECT id FROM public.compras WHERE tenant_id = v_tenant_id);
  DELETE FROM public.compras WHERE tenant_id = v_tenant_id;
  DELETE FROM public.cajas WHERE tenant_id = v_tenant_id;
  DELETE FROM public.productos WHERE tenant_id = v_tenant_id;
  DELETE FROM public.clientes WHERE tenant_id = v_tenant_id;
  DELETE FROM public.proveedores WHERE tenant_id = v_tenant_id;
  DELETE FROM public.subscriptions WHERE tenant_id = v_tenant_id;
  DELETE FROM public.tenant_settings WHERE tenant_id = v_tenant_id;
  DELETE FROM public.payment_history WHERE subscription_id IN (SELECT id FROM public.subscriptions WHERE tenant_id = v_tenant_id);
  DELETE FROM public.activity_logs WHERE tenant_id = v_tenant_id;
  BEGIN
    DELETE FROM public.legal_acceptances WHERE user_id = v_demo_user_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;
  UPDATE public.trial_codes SET used_by_user_id = NULL WHERE used_by_user_id = v_demo_user_id;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, v_demo_user_id, 'ORG_ADMIN')
  ON CONFLICT (tenant_id, user_id) DO UPDATE SET role = 'ORG_ADMIN';

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_demo_user_id, 'ORG_ADMIN')
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.tenant_settings (tenant_id, configuracion_json)
  VALUES (
    v_tenant_id,
    jsonb_build_object(
      'giro_comercial', 'ABARROTES',
      'modulos_activos', jsonb_build_object(
        'permite_granel', false,
        'permite_variantes', false,
        'permite_lotes_caducidad', true,
        'permite_mermas', true,
        'permite_servicios', false,
        'permite_credito_fiado', true
      ),
      'pos_config', jsonb_build_object(
        'teclado_rapido', true,
        'lector_barras', true,
        'impresion_automatica', true
      )
    )
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET configuracion_json = EXCLUDED.configuracion_json,
        actualizado_en = NOW();

  INSERT INTO public.subscriptions (
    tenant_id,
    status,
    payment_method,
    trial_start,
    trial_end,
    current_period_start,
    current_period_end,
    last_payment_at,
    next_payment_due
  ) VALUES (
    v_tenant_id,
    'active',
    'card',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '6 days',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '30 days',
    NOW() + INTERVAL '30 days'
  )
  ON CONFLICT (tenant_id) DO UPDATE
    SET status = 'active',
        current_period_end = NOW() + INTERVAL '30 days',
        updated_at = NOW();

  INSERT INTO public.productos (tenant_id, codigo_barras, sku, nombre, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo, categoria)
  VALUES
    (v_tenant_id, '7501055309901', 'ARR-001', 'Arroz Brillante 1kg',     'PIEZA', 32,  22, 45, 10, 'Granos'),
    (v_tenant_id, '7501055309902', 'FRI-001', 'Frijol Negro 1kg',         'PIEZA', 38,  26, 32, 10, 'Granos'),
    (v_tenant_id, '7501055309903', 'ACE-001', 'Aceite Nutrioli 1L',       'PIEZA', 48,  34, 28, 8,  'Aceites'),
    (v_tenant_id, '7501055309904', 'AZU-001', 'Azucar Estandar 1kg',      'PIEZA', 28,  19, 50, 12, 'Endulzantes'),
    (v_tenant_id, '7501055309905', 'SAL-001', 'Sal La Fina 1kg',          'PIEZA', 18,  11, 60, 15, 'Condimentos'),
    (v_tenant_id, '7501055309906', 'LEC-001', 'Leche Lala Entera 1L',     'PIEZA', 26,  18, 40, 12, 'Lacteos'),
    (v_tenant_id, '7501055309907', 'PAN-001', 'Pan Bimbo Doble Fibra',    'PIEZA', 65,  46, 24, 6,  'Panaderia'),
    (v_tenant_id, '7501055309908', 'HUE-001', 'Huevo San Juan 12pz',      'PIEZA', 42,  30, 30, 8,  'Lacteos'),
    (v_tenant_id, '7501055309909', 'PAS-001', 'Pasta Barilla Spaghetti',  'PIEZA', 18,  11, 55, 15, 'Pastas'),
    (v_tenant_id, '7501055309910', 'ATU-001', 'Atun en Agua Dolphin',     'PIEZA', 22,  14, 48, 12, 'Enlatados'),
    (v_tenant_id, '7501055309911', 'CHO-001', 'Chiles Jalapenos La Costeña', 'PIEZA', 19, 12, 36, 10, 'Enlatados'),
    (v_tenant_id, '7501055309912', 'REF-001', 'Coca-Cola 600ml',          'PIEZA', 18,  11, 72, 20, 'Bebidas'),
    (v_tenant_id, '7501055309913', 'AGU-001', 'Agua Bonafont 1L',         'PIEZA', 12,   7, 90, 24, 'Bebidas'),
    (v_tenant_id, '7501055309914', 'JUG-001', 'Jugo del Valle Naranja 1L','PIEZA', 28,  19, 36, 10, 'Bebidas'),
    (v_tenant_id, '7501055309915', 'GAL-001', 'Galletas Marías Gamesa',   'PIEZA', 24,  16, 40, 12, 'Botanas'),
    (v_tenant_id, '7501055309916', 'TOT-001', 'Totis Original 60g',       'PIEZA', 14,   8, 50, 15, 'Botanas'),
    (v_tenant_id, '7501055309917', 'CHO-002', 'Chocolate Abuelita 540g',  'PIEZA', 78,  56, 18, 5,  'Endulzantes'),
    (v_tenant_id, '7501055309918', 'CAF-001', 'Cafe Soluble Nescafe 200g','PIEZA', 95,  68, 15, 5,  'Bebidas'),
    (v_tenant_id, '7501055309919', 'JAB-001', 'Jabon Zote Blanco 400g',   'PIEZA', 28,  18, 25, 8,  'Limpieza'),
    (v_tenant_id, '7501055309920', 'DET-001', 'Detergente Ace 1kg',       'PIEZA', 58,  40, 20, 6,  'Limpieza');

  WITH nuevos_clientes AS (
    INSERT INTO public.clientes (tenant_id, nombre, telefono, direccion)
    VALUES
      (v_tenant_id, 'Maria Lopez Garcia',       '5551234501', 'Calle Reforma 123, Col. Centro'),
      (v_tenant_id, 'Juan Hernandez Ramirez',   '5551234502', 'Av. Hidalgo 456, Col. Roma'),
      (v_tenant_id, 'Ana Martinez Castillo',    '5551234503', 'Calle Morelos 789, Col. Condesa'),
      (v_tenant_id, 'Pedro Ramirez Sanchez',    '5551234504', 'Av. Juarez 234, Col. Centro'),
      (v_tenant_id, 'Laura Gonzalez Vazquez',   '5551234505', 'Calle Allende 567, Col. Del Valle'),
      (v_tenant_id, 'Roberto Silva Mendoza',    '5551234506', 'Av. Universidad 890, Col. Narvarte'),
      (v_tenant_id, 'Carmen Diaz Flores',       '5551234507', 'Calle Pino 123, Col. Santa Maria'),
      (v_tenant_id, 'Miguel Torres Rios',       '5551234508', 'Av. Division 456, Col. Industrial'),
      (v_tenant_id, 'Patricia Ruiz Aguilar',    '5551234509', 'Calle Olmo 789, Col. Jardines'),
      (v_tenant_id, 'Cliente Mostrador',        NULL,         NULL)
    RETURNING id
  )
  SELECT array_agg(id) INTO v_clientes_ids FROM nuevos_clientes;

  INSERT INTO public.cajas (
    tenant_id, usuario_id, fondo_inicial, total_ventas,
    total_entradas, total_salidas, saldo_esperado, saldo_real, diferencia,
    estado, fecha_apertura
  ) VALUES (
    v_tenant_id, v_demo_user_id, 500, 0, 0, 0, 500, 500, 0,
    'ABIERTA', NOW() - INTERVAL '8 hours'
  )
  RETURNING id INTO v_caja_id;

  FOR i IN 1..30 LOOP
    v_dias_atras := (random() * 29)::INT;
    v_metodo := CASE (i % 4)
      WHEN 0 THEN 'EFECTIVO'::public.metodo_pago
      WHEN 1 THEN 'TARJETA'::public.metodo_pago
      WHEN 2 THEN 'TRANSFERENCIA'::public.metodo_pago
      ELSE 'EFECTIVO'::public.metodo_pago
    END;
    v_cliente_id := v_clientes_ids[1 + (i % array_length(v_clientes_ids, 1))];

    v_items := jsonb_build_array();
    FOR j IN 1..(1 + (i % 3)) LOOP
      SELECT id, precio_venta INTO v_producto
      FROM public.productos
      WHERE tenant_id = v_tenant_id
      ORDER BY random()
      LIMIT 1;

      v_items := v_items || jsonb_build_object(
        'productId', v_producto.id,
        'cantidad', (1 + (i % 4))::INT,
        'precioUnitario', v_producto.precio_venta,
        'descuento', 0
      );
    END LOOP;

    v_subtotal := 0;
    v_total := 0;
    FOR j IN 0..(jsonb_array_length(v_items) - 1) LOOP
      v_subtotal := v_subtotal + (
        (v_items->j->>'precioUnitario')::DECIMAL *
        (v_items->j->>'cantidad')::DECIMAL
      );
    END LOOP;
    v_total := ROUND((v_subtotal * 1.16)::NUMERIC, 2);

    INSERT INTO public.ventas (
      tenant_id, usuario_id, cliente_id, total, subtotal,
      impuesto, descuento, metodo_pago, estado, notas,
      fecha_venta
    ) VALUES (
      v_tenant_id, v_demo_user_id, v_cliente_id, v_total, v_subtotal,
      v_total - v_subtotal, 0, v_metodo, 'COMPLETADA', 'Venta demo',
      NOW() - (v_dias_atras || ' days')::INTERVAL - ((i % 10) || ' hours')::INTERVAL
    )
    RETURNING id INTO v_venta_id;

    FOR j IN 0..(jsonb_array_length(v_items) - 1) LOOP
      INSERT INTO public.detalle_ventas (
        venta_id, producto_id, cantidad, precio_unitario, subtotal, descuento
      ) VALUES (
        v_venta_id,
        (v_items->j->>'productId')::UUID,
        (v_items->j->>'cantidad')::DECIMAL,
        (v_items->j->>'precioUnitario')::DECIMAL,
        (v_items->j->>'precioUnitario')::DECIMAL * (v_items->j->>'cantidad')::DECIMAL,
        0
      );
    END LOOP;

    INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, fecha)
    VALUES (
      v_caja_id, 'ENTRADA', v_total,
      'Venta #' || LEFT(v_venta_id::text, 8) || ' - ' || v_metodo::text,
      NOW() - (v_dias_atras || ' days')::INTERVAL
    );

    UPDATE public.cajas
    SET total_ventas = total_ventas + v_total,
        total_entradas = total_entradas + v_total,
        saldo_esperado = saldo_esperado + v_total,
        saldo_real = saldo_real + v_total
    WHERE id = v_caja_id;
  END LOOP;

  BEGIN
    INSERT INTO public.legal_acceptances (
      user_id, terms_version, privacy_version, cookies_version, ip_address, user_agent
    ) VALUES (
      v_demo_user_id, '1.0', '1.0', '1.0', '127.0.0.1', 'demo-bot'
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', v_demo_user_id,
    'subdominio', 'abarrotes-don-pedro',
    'productos_count', (SELECT count(*) FROM public.productos WHERE tenant_id = v_tenant_id),
    'clientes_count', (SELECT count(*) FROM public.clientes WHERE tenant_id = v_tenant_id),
    'ventas_count', (SELECT count(*) FROM public.ventas WHERE tenant_id = v_tenant_id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reset_demo_tenant() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_tenant() TO service_role;

-- =============================================
-- 2. trial_codes: politicas solo service_role
-- =============================================

DROP POLICY IF EXISTS "Anyone can read unused trial codes" ON public.trial_codes;
DROP POLICY IF EXISTS "Service role can manage trial codes" ON public.trial_codes;

CREATE POLICY "trial_codes_read_service" ON public.trial_codes
  FOR SELECT TO service_role USING (true);

CREATE POLICY "trial_codes_manage_service" ON public.trial_codes
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- =============================================
-- 3. redeem_trial_code(): solo service_role
-- =============================================

REVOKE ALL ON FUNCTION public.redeem_trial_code(TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_trial_code(TEXT, UUID, UUID) TO service_role;

-- =============================================
-- 4. subscriptions / payment_history INSERT: service_role
-- =============================================

DROP POLICY IF EXISTS "Service role can insert subscription" ON public.subscriptions;
DROP POLICY IF EXISTS "Service role can insert payment history" ON public.payment_history;

CREATE POLICY "Service role can insert subscription" ON public.subscriptions
  FOR INSERT TO service_role WITH CHECK (true);

CREATE POLICY "Service role can insert payment history" ON public.payment_history
  FOR INSERT TO service_role WITH CHECK (true);

-- =============================================
-- 5. Funciones de suscripcion y folios: service_role
-- =============================================

REVOKE ALL ON FUNCTION public.has_active_subscription(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_subscription_info(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_next_folio(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_folio(UUID, TEXT) TO service_role;

-- =============================================
-- 6. log_activity(): exige auth.uid() = p_user_id
-- =============================================

CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_user_email TEXT,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_tenant_id UUID;
  v_log_id UUID;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = p_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found for user';
  END IF;

  INSERT INTO public.activity_logs (
    tenant_id, user_id, user_email, action, entity,
    entity_id, entity_name, details, ip_address
  ) VALUES (
    v_tenant_id, p_user_id, p_user_email, p_action, p_entity,
    p_entity_id, p_entity_name, p_details, p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) TO authenticated;

-- =============================================
-- 7. tipo_movimiento: nuevo valor 'VENTA' +
--    _crear_venta_desde_items() corrige el doble conteo
--    y valida/registra ventas a credito.
-- =============================================

ALTER TYPE public.tipo_movimiento ADD VALUE IF NOT EXISTS 'VENTA';

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

  v_impuesto := ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2);
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

REVOKE ALL ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) TO service_role;

COMMIT;
