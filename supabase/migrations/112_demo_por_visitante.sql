-- =============================================================================
-- 112 · Demo privada por visitante
--
-- Antes la demo era UNA cuenta compartida (demo@symvora.com, "Abarrotes Don
-- Pedro"): cada visitante veia lo que hacian los demas, y cada entrada nueva
-- llamaba `reset_demo_tenant()`, que borraba los datos de quien estaba
-- probando a media prueba.
--
-- Ahora cada visitante tiene SU usuario (creado por `/api/demo/start` con
-- `app_metadata.is_demo = true`) y SU negocio, sembrado con los mismos datos.
-- El negocio lleva `demo_expira_en`: se borra al salir (`borrar_mi_demo`) o al
-- vencer (`borrar_demos_vencidas`, en cada entrada nueva y en un cron diario).
--
-- REGLA: `demo_expira_en IS NOT NULL` = negocio demo temporal. Todo cron,
-- conteo o vista interna sobre negocios debe ignorarlos.
--
-- `reset_demo_tenant()` y "Abarrotes Don Pedro" se quedan sin usar (respaldo
-- para volver atras); se retiran en una migracion posterior.
-- =============================================================================

BEGIN;

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS demo_expira_en TIMESTAMPTZ;

COMMENT ON COLUMN public.tenants.demo_expira_en IS
  'Negocio demo de un visitante: se borra al vencer (migracion 112). NULL = negocio real.';

CREATE INDEX IF NOT EXISTS idx_tenants_demo_expira_en
  ON public.tenants (demo_expira_en)
  WHERE demo_expira_en IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Deteccion de demo: el usuario compartido de antes (por correo) O un usuario
-- de visitante (`app_metadata.is_demo`). Mismas firmas: los GRANT se conservan.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $fn$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
      AND (u.email = 'demo@symvora.com' OR u.raw_app_meta_data->>'is_demo' = 'true')
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.current_user_is_demo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND (email = 'demo@symvora.com' OR raw_app_meta_data->>'is_demo' = 'true')
  );
$fn$;

-- Un negocio demo no genera notificaciones (migracion 108).
CREATE OR REPLACE FUNCTION public._notif_tenant_activo(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.tenants t
    WHERE t.id = p_tenant_id AND t.demo_expira_en IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN auth.users u ON u.id = tm.user_id
    WHERE tm.tenant_id = p_tenant_id
      AND (u.email = 'demo@symvora.com' OR u.raw_app_meta_data->>'is_demo' = 'true')
  );
$fn$;

-- -----------------------------------------------------------------------------
-- crear_negocio_demo: el negocio de UN visitante, con los datos de siempre.
-- Solo `service_role` (la llama `/api/demo/start` tras crear el usuario).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_negocio_demo(
  p_user_id UUID,
  p_horas INT DEFAULT 2,
  p_terms_version TEXT DEFAULT NULL,
  p_privacy_version TEXT DEFAULT NULL,
  p_cookies_version TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
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
  -- Solo para usuarios de visitante: nunca convierte en demo a una cuenta real.
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND u.raw_app_meta_data->>'is_demo' = 'true'
  ) THEN
    RAISE EXCEPTION 'crear_negocio_demo: % no es un usuario demo', p_user_id;
  END IF;

  INSERT INTO public.tenants (
    nombre_comercial, subdominio, giro_comercial, color_primario,
    telefono, email, direccion, subscription_status, demo_expira_en
  ) VALUES (
    'Abarrotes Don Pedro',
    'demo-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16),
    'ABARROTES', '#2563eb',
    '5551234567', 'demo@symvora.com', 'Av. Insurgentes Sur 1234, CDMX', 'active',
    NOW() + make_interval(hours => GREATEST(1, LEAST(p_horas, 24)))
  )
  RETURNING id INTO v_tenant_id;
  -- La sucursal principal la crea `trg_tenants_sucursal_principal` (081).

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (v_tenant_id, p_user_id, 'ORG_ADMIN');

  INSERT INTO public.user_roles (user_id, role)
  VALUES (p_user_id, 'ORG_ADMIN')
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
    tenant_id, status, payment_method, trial_start, trial_end,
    current_period_start, current_period_end, last_payment_at, next_payment_due
  ) VALUES (
    v_tenant_id, 'active', 'card',
    NOW() - INTERVAL '30 days', NOW() + INTERVAL '6 days',
    NOW() - INTERVAL '30 days', NOW() + INTERVAL '30 days',
    NOW() - INTERVAL '30 days', NOW() + INTERVAL '30 days'
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
    v_tenant_id, p_user_id, 500, 0, 0, 0, 500, 500, 0,
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
      v_tenant_id, p_user_id, v_cliente_id, v_total, v_subtotal,
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

  -- Aceptacion legal con las versiones VIGENTES (las manda la app desde
  -- `lib/legal/versions.ts`): sin ella saldria el aviso de "documentos
  -- actualizados" encima de la demo. Si la tabla no existe, se omite.
  IF p_terms_version IS NOT NULL THEN
    BEGIN
      EXECUTE
        'INSERT INTO public.legal_acceptances
           (user_id, terms_version, privacy_version, cookies_version, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6)'
      USING p_user_id, p_terms_version, p_privacy_version, p_cookies_version, '127.0.0.1', 'demo';
    EXCEPTION WHEN undefined_table OR undefined_column THEN
      NULL;
    END;
  END IF;

  RETURN v_tenant_id;
END;
$fn$;

-- -----------------------------------------------------------------------------
-- _borrar_negocio_demo: borra UN negocio demo y sus usuarios de visitante.
-- Se niega a tocar un negocio real (`demo_expira_en` NULL).
--
-- El orden importa: las cajas, ventas, compras, ordenes, ajustes, traspasos y
-- existencias apuntan a la sucursal con RESTRICT, y facturas/pagos de terminal
-- a la venta con NO ACTION. Se borran primero; el resto cae en cascada con el
-- negocio. El usuario va al final: ventas y cajas lo apuntan con NO ACTION.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._borrar_negocio_demo(p_tenant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_usuarios UUID[];
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = p_tenant_id AND demo_expira_en IS NOT NULL
  ) THEN
    RAISE EXCEPTION '_borrar_negocio_demo: % no es un negocio demo', p_tenant_id;
  END IF;

  SELECT array_agg(tm.user_id) INTO v_usuarios
  FROM public.tenant_memberships tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tenant_id = p_tenant_id
    AND u.raw_app_meta_data->>'is_demo' = 'true';

  DELETE FROM public.facturas WHERE tenant_id = p_tenant_id;
  DELETE FROM public.pagos_terminal WHERE tenant_id = p_tenant_id;
  DELETE FROM public.traspasos WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ajustes_inventario WHERE tenant_id = p_tenant_id;
  DELETE FROM public.compras WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ordenes_compra WHERE tenant_id = p_tenant_id;
  DELETE FROM public.ventas WHERE tenant_id = p_tenant_id;
  DELETE FROM public.cajas WHERE tenant_id = p_tenant_id;
  DELETE FROM public.stock_sucursal
  WHERE sucursal_id IN (SELECT id FROM public.sucursales WHERE tenant_id = p_tenant_id);

  DELETE FROM public.tenants WHERE id = p_tenant_id AND demo_expira_en IS NOT NULL;

  -- Solo usuarios de visitante sin ningun otro negocio.
  IF v_usuarios IS NOT NULL THEN
    DELETE FROM auth.users u
    WHERE u.id = ANY (v_usuarios)
      AND u.raw_app_meta_data->>'is_demo' = 'true'
      AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = u.id);
  END IF;
END;
$fn$;

-- Limpieza de las vencidas (cada entrada nueva y cron diario). Un negocio que
-- falle no frena a los demas. Devuelve cuantos se borraron.
CREATE OR REPLACE FUNCTION public.borrar_demos_vencidas(p_limite INT DEFAULT 50)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_id UUID;
  v_borrados INT := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.tenants
    WHERE demo_expira_en IS NOT NULL AND demo_expira_en < NOW()
    ORDER BY demo_expira_en
    LIMIT GREATEST(p_limite, 0)
    FOR UPDATE SKIP LOCKED
  LOOP
    BEGIN
      PERFORM public._borrar_negocio_demo(v_id);
      v_borrados := v_borrados + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[demo] no se pudo borrar el negocio demo %: %', v_id, SQLERRM;
    END;
  END LOOP;
  RETURN v_borrados;
END;
$fn$;

-- El visitante sale: borra SU demo. Lo llama `/api/demo/salir` con
-- service_role DESPUES de verificar la sesion; aqui se vuelve a comprobar que
-- el usuario sea de visitante.
CREATE OR REPLACE FUNCTION public.borrar_mi_demo(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = p_user_id AND u.raw_app_meta_data->>'is_demo' = 'true'
  ) THEN
    RETURN FALSE;
  END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  JOIN public.tenants t ON t.id = tm.tenant_id
  WHERE tm.user_id = p_user_id AND t.demo_expira_en IS NOT NULL
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM public._borrar_negocio_demo(v_tenant_id);
  RETURN TRUE;
END;
$fn$;

REVOKE ALL ON FUNCTION public.crear_negocio_demo(UUID, INT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._borrar_negocio_demo(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.borrar_demos_vencidas(INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.borrar_mi_demo(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_negocio_demo(UUID, INT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.borrar_demos_vencidas(INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.borrar_mi_demo(UUID) TO service_role;

-- -----------------------------------------------------------------------------
-- La cartera interna (100, 111) no cuenta los negocios demo.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE VIEW interno.cartera_clientes AS
WITH duenos AS (
  SELECT DISTINCT ON (m.tenant_id) m.tenant_id, m.user_id
  FROM public.tenant_memberships m
  WHERE m.role = 'SUPER_ADMIN'
  ORDER BY m.tenant_id, m.user_id
)
SELECT
  'Cliente'::text AS tipo,
  NULLIF(trim(coalesce(
    u.raw_user_meta_data->>'nombre_completo',
    u.raw_user_meta_data->>'nombre',
    u.raw_user_meta_data->>'full_name',
    ''
  )), '') AS nombre_completo,
  c.telefono AS celular,
  u.email::text AS correo,
  t.nombre_comercial AS negocio,
  coalesce(ts.configuracion_json->>'giro_detalle', t.giro_comercial) AS giro,
  CASE
    WHEN s.id IS NULL THEN 'Sin suscripción'
    WHEN s.status = 'trial' AND s.trial_end < now() THEN 'Prueba vencida'
    WHEN s.status = 'trial' THEN 'Prueba'
    WHEN s.status = 'active' THEN 'Activa'
    WHEN s.status = 'past_due' THEN 'Pago pendiente'
    WHEN s.status = 'canceled' THEN 'Cancelada'
    WHEN s.status = 'expired' THEN 'Vencida'
    ELSE s.status::text
  END AS estatus,
  t.creado_en AS fecha_registro,
  CASE WHEN s.status = 'trial' THEN s.trial_end ELSE s.current_period_end END AS vence_el,
  c.avisos_whatsapp,
  (SELECT count(*) FROM public.productos p
    WHERE p.tenant_id = t.id AND p.archivado_en IS NULL) AS productos,
  (SELECT count(*) FROM public.variantes_producto v
    WHERE v.tenant_id = t.id AND v.archivado_en IS NULL) AS variantes,
  (SELECT min(p.creado_en) FROM public.productos p
    WHERE p.tenant_id = t.id) AS primer_producto,
  (SELECT count(*) FROM public.ventas vt WHERE vt.tenant_id = t.id) AS ventas,
  (SELECT max(vt.fecha_venta) FROM public.ventas vt WHERE vt.tenant_id = t.id) AS ultima_venta
FROM public.tenants t
JOIN duenos d ON d.tenant_id = t.id
JOIN auth.users u ON u.id = d.user_id
LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
LEFT JOIN public.contacto_usuarios c ON c.user_id = d.user_id
WHERE t.demo_expira_en IS NULL

UNION ALL

SELECT
  'Registro incompleto'::text,
  r.nombre,
  r.telefono,
  r.email,
  r.negocio,
  NULL,
  CASE WHEN r.estado = 'contactado' THEN 'Sin terminar (contactado)' ELSE 'Sin terminar' END,
  r.creado_en,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL,
  NULL
FROM public.registros_pendientes r
WHERE r.estado <> 'completado'

ORDER BY fecha_registro DESC;

REVOKE ALL ON interno.cartera_clientes FROM PUBLIC, anon, authenticated;

COMMIT;
