-- =============================================
-- 128: eliminar la cuenta desde la app (requisito de Google Play)
-- =============================================
-- Google Play exige que una app que deja crear cuenta deje tambien pedir su
-- eliminacion, desde la app y desde una pagina web (/es/eliminar-cuenta).
--
-- FLUJO (decision del dueño de SYMVORA, 2026-10-31):
--   1. `solicitar_baja`: queda una solicitud con 30 dias para arrepentirse. La
--      ruta /api/cuenta/eliminar ademas cancela la suscripcion en Conekta y
--      avisa a hola@. El panel muestra la cuenta bloqueada con la fecha.
--   2. `cancelar_baja`: el titular se arrepiente antes del plazo.
--   3. `ejecutar_baja` (cron /api/cron/ejecutar-bajas, solo service_role):
--      - DUEÑO: se borra el negocio completo (la misma secuencia que
--        `_borrar_negocio_demo`, ensayada sobre el negocio de pruebas) y se
--        cierran las cuentas que solo pertenecian a ese negocio.
--      - COLABORADOR: sale del negocio y su cuenta se cierra; las ventas que
--        cobro son del negocio y se quedan.
--      Cerrar una cuenta = borrarla de auth.users; si todavia la apuntan ventas,
--      compras o cajas de OTRO negocio (llaves NO ACTION), se anonimiza.
--
-- QUE SE CONSERVA (aviso de privacidad v1.5, seccion 3 y 7):
--   - Nombre y celular del titular para comunicaciones comerciales, salvo que
--     al pedir la baja marque que no (`conservar_contacto = false`).
--     Van a `interno.contactos_conservados` y salen en `interno.cartera_clientes`
--     como «Cuenta cerrada».
--   - Los pagos de la suscripcion (obligacion fiscal), en `interno.bajas`.

-- ---------------------------------------------------------------------------
-- 1. Solicitudes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.solicitudes_baja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- SET NULL: al ejecutarse se borra el usuario y la fila queda como registro.
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  es_dueno BOOLEAN NOT NULL,
  conservar_contacto BOOLEAN NOT NULL DEFAULT TRUE,
  motivo TEXT CHECK (motivo IS NULL OR length(motivo) <= 500),
  solicitada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ejecutar_en TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  cancelada_en TIMESTAMPTZ,
  ejecutada_en TIMESTAMPTZ,
  -- Si el cron no pudo ejecutarla: el mensaje, para revisarla a mano.
  error TEXT
);

-- Una sola solicitud viva por persona.
CREATE UNIQUE INDEX IF NOT EXISTS solicitudes_baja_una_viva
  ON public.solicitudes_baja (user_id)
  WHERE cancelada_en IS NULL AND ejecutada_en IS NULL;
CREATE INDEX IF NOT EXISTS idx_solicitudes_baja_tenant ON public.solicitudes_baja (tenant_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_baja_pendientes
  ON public.solicitudes_baja (ejecutar_en)
  WHERE cancelada_en IS NULL AND ejecutada_en IS NULL;

ALTER TABLE public.solicitudes_baja ENABLE ROW LEVEL SECURITY;

-- La ve quien la pidio y, si es del dueño, todo su equipo (el negocio se va a
-- cerrar y el panel se lo dice). Sin politicas de escritura: solo por RPC.
DROP POLICY IF EXISTS solicitudes_baja_select ON public.solicitudes_baja;
CREATE POLICY solicitudes_baja_select ON public.solicitudes_baja
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (es_dueno AND tenant_id IN (SELECT public.user_tenant_ids()))
  );

REVOKE ALL ON public.solicitudes_baja FROM anon, authenticated;
GRANT SELECT ON public.solicitudes_baja TO authenticated;

-- ---------------------------------------------------------------------------
-- 2. Lo que se conserva (esquema interno, no expuesto por la API)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS interno.contactos_conservados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT,
  celular TEXT,
  negocio TEXT,
  giro TEXT,
  -- La version del aviso con la que se conservaron (evidencia LFPDPPP).
  aviso_version TEXT NOT NULL,
  conservado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interno.bajas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitud_id UUID NOT NULL,
  tenant_id UUID,
  negocio TEXT,
  es_dueno BOOLEAN NOT NULL,
  solicitada_en TIMESTAMPTZ NOT NULL,
  ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conservo_contacto BOOLEAN NOT NULL,
  -- Pagos de la suscripcion: se guardan por obligacion fiscal.
  pagos JSONB NOT NULL DEFAULT '[]'::jsonb
);

REVOKE ALL ON interno.contactos_conservados, interno.bajas FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Pedir y cancelar (authenticated)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.solicitar_baja(
  p_conservar_contacto BOOLEAN DEFAULT TRUE,
  p_motivo TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_demo BOOLEAN;
  v_tenant UUID;
  v_dueno BOOLEAN := FALSE;
  v_fila public.solicitudes_baja;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Inicia sesión para eliminar tu cuenta';
  END IF;

  SELECT COALESCE((u.raw_app_meta_data->>'is_demo')::BOOLEAN, FALSE) INTO v_demo
  FROM auth.users u WHERE u.id = v_uid;
  IF v_demo THEN
    RAISE EXCEPTION 'La demo se borra sola al salir';
  END IF;

  SELECT tm.tenant_id INTO v_tenant
  FROM public.tenant_memberships tm
  WHERE tm.user_id = v_uid AND tm.role = 'SUPER_ADMIN'
  ORDER BY tm.creado_en
  LIMIT 1;

  IF v_tenant IS NOT NULL THEN
    v_dueno := TRUE;
  ELSE
    SELECT tm.tenant_id INTO v_tenant
    FROM public.tenant_memberships tm
    WHERE tm.user_id = v_uid
    ORDER BY tm.creado_en
    LIMIT 1;
  END IF;

  -- Pedirla dos veces no cambia la fecha: se devuelve la que ya existe.
  SELECT * INTO v_fila
  FROM public.solicitudes_baja
  WHERE user_id = v_uid AND cancelada_en IS NULL AND ejecutada_en IS NULL;
  IF FOUND THEN
    RETURN to_jsonb(v_fila);
  END IF;

  INSERT INTO public.solicitudes_baja (user_id, tenant_id, es_dueno, conservar_contacto, motivo)
  VALUES (v_uid, v_tenant, v_dueno, COALESCE(p_conservar_contacto, TRUE), NULLIF(left(trim(p_motivo), 500), ''))
  RETURNING * INTO v_fila;

  RETURN to_jsonb(v_fila);
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_baja()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_n INT;
BEGIN
  UPDATE public.solicitudes_baja
  SET cancelada_en = NOW()
  WHERE user_id = auth.uid()
    AND cancelada_en IS NULL
    AND ejecutada_en IS NULL;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;

REVOKE ALL ON FUNCTION public.solicitar_baja(BOOLEAN, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.solicitar_baja(BOOLEAN, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.cancelar_baja() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_baja() TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ejecutar (service_role)
-- ---------------------------------------------------------------------------

-- Cierra una cuenta que ya no pertenece a ningun negocio. Si todavia la
-- apuntan registros de otro negocio (llaves NO ACTION), se anonimiza en lugar
-- de borrarse. Devuelve 'conserva' | 'borrado' | 'anonimizado'.
CREATE OR REPLACE FUNCTION public._cerrar_usuario(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = p_user_id) THEN
    RETURN 'conserva';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.ventas WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.compras WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.cajas WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.ajustes_inventario WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.ordenes_compra WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.pagos_terminal WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.sugerencias WHERE usuario_id = p_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.pagos_credito WHERE usuario_id = p_user_id)
  THEN
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN 'borrado';
  END IF;

  -- Anonimizar: sin correo, nombre, celular ni forma de entrar.
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM public.contacto_usuarios WHERE user_id = p_user_id;
  DELETE FROM public.user_roles WHERE user_id = p_user_id;
  DELETE FROM public.usuario_sucursales WHERE user_id = p_user_id;
  DELETE FROM public.user_permission_overrides WHERE user_id = p_user_id;
  UPDATE auth.users
  SET email = 'eliminado-' || id || '@symvora.invalid',
      phone = NULL,
      raw_user_meta_data = '{}'::jsonb,
      encrypted_password = '',
      banned_until = 'infinity'
  WHERE id = p_user_id;
  RETURN 'anonimizado';
END;
$$;

CREATE OR REPLACE FUNCTION public.ejecutar_baja(p_solicitud_id UUID, p_forzar BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_s public.solicitudes_baja;
  v_negocio TEXT;
  v_giro TEXT;
  v_nombre TEXT;
  v_celular TEXT;
  v_pagos JSONB := '[]'::jsonb;
  v_miembros UUID[];
  v_u UUID;
  v_resultado TEXT;
BEGIN
  SELECT * INTO v_s FROM public.solicitudes_baja WHERE id = p_solicitud_id FOR UPDATE;
  IF v_s.id IS NULL THEN
    RAISE EXCEPTION 'Solicitud de baja no encontrada';
  END IF;
  IF v_s.cancelada_en IS NOT NULL OR v_s.ejecutada_en IS NOT NULL THEN
    RETURN jsonb_build_object('resultado', 'sin_cambios');
  END IF;
  IF v_s.ejecutar_en > NOW() AND NOT p_forzar THEN
    RAISE EXCEPTION 'La solicitud todavía está en su plazo para arrepentirse';
  END IF;

  SELECT t.nombre_comercial,
         COALESCE(ts.configuracion_json->>'giro_detalle', t.giro_comercial)
  INTO v_negocio, v_giro
  FROM public.tenants t
  LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
  WHERE t.id = v_s.tenant_id;

  IF v_s.user_id IS NOT NULL THEN
    SELECT public.nombre_de_usuario(u.raw_user_meta_data), c.telefono
    INTO v_nombre, v_celular
    FROM auth.users u
    LEFT JOIN public.contacto_usuarios c ON c.user_id = u.id
    WHERE u.id = v_s.user_id;
  END IF;

  IF v_s.conservar_contacto AND (NULLIF(v_nombre, '') IS NOT NULL OR v_celular IS NOT NULL) THEN
    INSERT INTO interno.contactos_conservados (nombre, celular, negocio, giro, aviso_version)
    VALUES (NULLIF(v_nombre, ''), v_celular, v_negocio, v_giro, 'v1.5-2026-10-31');
  END IF;

  IF v_s.es_dueno AND v_s.tenant_id IS NOT NULL THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'pagado_en', ph.paid_at, 'monto', ph.amount, 'moneda', ph.currency,
             'metodo', ph.payment_method, 'estado', ph.status,
             'referencia', ph.reference, 'orden_conekta', ph.conekta_order_id
           ) ORDER BY ph.paid_at), '[]'::jsonb)
    INTO v_pagos
    FROM public.payment_history ph
    JOIN public.subscriptions s ON s.id = ph.subscription_id
    WHERE s.tenant_id = v_s.tenant_id;
  END IF;

  INSERT INTO interno.bajas (solicitud_id, tenant_id, negocio, es_dueno, solicitada_en, conservo_contacto, pagos)
  VALUES (v_s.id, v_s.tenant_id, v_negocio, v_s.es_dueno, v_s.solicitada_en, v_s.conservar_contacto, v_pagos);

  IF v_s.es_dueno AND v_s.tenant_id IS NOT NULL THEN
    -- Sin usuario en la sesion: el trigger de la Bitacora (`log_table_changes`)
    -- registraria el borrado EN CASCADA de productos, clientes… contra un
    -- negocio que ya no existe, y la llave de `activity_logs` lo rechaza.
    -- Sin `sub` y sin `usuario_id` en la fila, el trigger no registra nada.
    PERFORM set_config('request.jwt.claims', '{}', true);

    -- Quien pertenece al negocio: al cerrarse, las cuentas que solo vivian ahi
    -- se cierran tambien.
    SELECT array_agg(tm.user_id) INTO v_miembros
    FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_s.tenant_id;

    -- La misma secuencia que `_borrar_negocio_demo`: primero lo que apunta con
    -- llaves NO ACTION, despues el negocio (el resto cae en cascada).
    DELETE FROM public.facturas WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.pagos_terminal WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.traspasos WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.ajustes_inventario WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.compras WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.ordenes_compra WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.ventas WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.cajas WHERE tenant_id = v_s.tenant_id;
    DELETE FROM public.stock_sucursal
    WHERE sucursal_id IN (SELECT id FROM public.sucursales WHERE tenant_id = v_s.tenant_id);
    DELETE FROM public.tenants WHERE id = v_s.tenant_id AND demo_expira_en IS NULL;
  END IF;

  -- El titular deja TODOS sus negocios (pidio cerrar su cuenta, no un negocio).
  IF v_s.user_id IS NOT NULL THEN
    DELETE FROM public.tenant_memberships WHERE user_id = v_s.user_id;
  END IF;

  UPDATE public.solicitudes_baja SET ejecutada_en = NOW(), error = NULL WHERE id = v_s.id;

  IF v_s.user_id IS NOT NULL THEN
    v_resultado := public._cerrar_usuario(v_s.user_id);
  END IF;

  IF v_miembros IS NOT NULL THEN
    FOREACH v_u IN ARRAY v_miembros LOOP
      IF v_u IS DISTINCT FROM v_s.user_id THEN
        PERFORM public._cerrar_usuario(v_u);
      END IF;
    END LOOP;
  END IF;

  RETURN jsonb_build_object('resultado', COALESCE(v_resultado, 'sin_usuario'), 'tenant_id', v_s.tenant_id);
END;
$$;

-- Los archivos del negocio (fotos, logo, PDFs de ordenes): el cron los borra
-- por la API de Storage ANTES de ejecutar la baja. Todos viven en `<tenant>/…`.
CREATE OR REPLACE FUNCTION public.archivos_de_negocio(p_tenant_id UUID)
RETURNS TABLE (bucket_id TEXT, nombre TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.bucket_id, o.name
  FROM storage.objects o
  WHERE o.bucket_id IN ('product-images', 'logos', 'ordenes-compra')
    AND split_part(o.name, '/', 1) = p_tenant_id::TEXT;
$$;

REVOKE ALL ON FUNCTION public._cerrar_usuario(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ejecutar_baja(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archivos_de_negocio(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._cerrar_usuario(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.ejecutar_baja(UUID, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.archivos_de_negocio(UUID) TO service_role;

-- ---------------------------------------------------------------------------
-- 5. La cartera interna suma las cuentas cerradas que conservaron su contacto
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW interno.cartera_clientes AS
 WITH duenos AS (
         SELECT DISTINCT ON (m.tenant_id) m.tenant_id,
            m.user_id
           FROM tenant_memberships m
          WHERE (m.role = 'SUPER_ADMIN'::app_role)
          ORDER BY m.tenant_id, m.user_id
        )
 SELECT 'Cliente'::text AS tipo,
    NULLIF(TRIM(BOTH FROM COALESCE((u.raw_user_meta_data ->> 'nombre_completo'::text), (u.raw_user_meta_data ->> 'nombre'::text), (u.raw_user_meta_data ->> 'full_name'::text), ''::text)), ''::text) AS nombre_completo,
    c.telefono AS celular,
    (u.email)::text AS correo,
    t.nombre_comercial AS negocio,
    COALESCE((ts.configuracion_json ->> 'giro_detalle'::text), t.giro_comercial) AS giro,
        CASE
            WHEN (s.id IS NULL) THEN 'Sin suscripción'::text
            WHEN ((s.status = 'trial'::subscription_status) AND (s.trial_end < now())) THEN 'Prueba vencida'::text
            WHEN (s.status = 'trial'::subscription_status) THEN 'Prueba'::text
            WHEN (s.status = 'active'::subscription_status) THEN 'Activa'::text
            WHEN (s.status = 'past_due'::subscription_status) THEN 'Pago pendiente'::text
            WHEN (s.status = 'canceled'::subscription_status) THEN 'Cancelada'::text
            WHEN (s.status = 'expired'::subscription_status) THEN 'Vencida'::text
            ELSE (s.status)::text
        END AS estatus,
    t.creado_en AS fecha_registro,
        CASE
            WHEN (s.status = 'trial'::subscription_status) THEN s.trial_end
            ELSE s.current_period_end
        END AS vence_el,
    c.avisos_whatsapp,
    ( SELECT count(*) AS count
           FROM productos p
          WHERE ((p.tenant_id = t.id) AND (p.archivado_en IS NULL))) AS productos,
    ( SELECT count(*) AS count
           FROM variantes_producto v
          WHERE ((v.tenant_id = t.id) AND (v.archivado_en IS NULL))) AS variantes,
    ( SELECT min(p.creado_en) AS min
           FROM productos p
          WHERE (p.tenant_id = t.id)) AS primer_producto,
    ( SELECT count(*) AS count
           FROM ventas vt
          WHERE (vt.tenant_id = t.id)) AS ventas,
    ( SELECT max(vt.fecha_venta) AS max
           FROM ventas vt
          WHERE (vt.tenant_id = t.id)) AS ultima_venta
   FROM (((((tenants t
     JOIN duenos d ON ((d.tenant_id = t.id)))
     JOIN auth.users u ON ((u.id = d.user_id)))
     LEFT JOIN subscriptions s ON ((s.tenant_id = t.id)))
     LEFT JOIN tenant_settings ts ON ((ts.tenant_id = t.id)))
     LEFT JOIN contacto_usuarios c ON ((c.user_id = d.user_id)))
  WHERE (t.demo_expira_en IS NULL)
UNION ALL
 SELECT 'Registro incompleto'::text AS tipo,
    r.nombre AS nombre_completo,
    r.telefono AS celular,
    r.email AS correo,
    r.negocio,
    NULL::text AS giro,
        CASE
            WHEN (r.estado = 'contactado'::text) THEN 'Sin terminar (contactado)'::text
            ELSE 'Sin terminar'::text
        END AS estatus,
    r.creado_en AS fecha_registro,
    NULL::timestamp with time zone AS vence_el,
    NULL::boolean AS avisos_whatsapp,
    NULL::bigint AS productos,
    NULL::bigint AS variantes,
    NULL::timestamp with time zone AS primer_producto,
    NULL::bigint AS ventas,
    NULL::timestamp with time zone AS ultima_venta
   FROM registros_pendientes r
  WHERE (r.estado <> 'completado'::text)
UNION ALL
 SELECT 'Cuenta cerrada'::text AS tipo,
    k.nombre AS nombre_completo,
    k.celular,
    NULL::text AS correo,
    k.negocio,
    k.giro,
    'Cuenta cerrada'::text AS estatus,
    k.conservado_en AS fecha_registro,
    NULL::timestamp with time zone AS vence_el,
    NULL::boolean AS avisos_whatsapp,
    NULL::bigint AS productos,
    NULL::bigint AS variantes,
    NULL::timestamp with time zone AS primer_producto,
    NULL::bigint AS ventas,
    NULL::timestamp with time zone AS ultima_venta
   FROM interno.contactos_conservados k
  ORDER BY 8 DESC;
