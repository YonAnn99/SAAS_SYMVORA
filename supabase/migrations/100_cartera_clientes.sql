-- =============================================
-- 100: Cartera de clientes (uso interno de SYMVORA)
-- ---------------------------------------------
-- Una sola lista con cada negocio registrado y su dueño: nombre completo,
-- celular, correo, negocio, giro, estatus y fechas. Incluye tambien a quien
-- dejo su celular en "Crear cuenta" y no termino (`registros_pendientes`).
--
-- NO es parte de la app: vive en el esquema `interno`, que no se expone por
-- la API (PostgREST solo publica `public`) y al que anon/authenticated no
-- tienen acceso. Se consulta y exporta a CSV desde el panel de Supabase:
-- Table Editor -> esquema `interno` -> cartera_clientes, o en el SQL Editor:
--   select * from interno.cartera_clientes;
--
-- Lee `auth.users`: por eso NO va en `public`, donde quedaria expuesta.
-- =============================================

BEGIN;

CREATE SCHEMA IF NOT EXISTS interno;
REVOKE ALL ON SCHEMA interno FROM PUBLIC, anon, authenticated;

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
  c.avisos_whatsapp
FROM public.tenants t
JOIN duenos d ON d.tenant_id = t.id
JOIN auth.users u ON u.id = d.user_id
LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
LEFT JOIN public.contacto_usuarios c ON c.user_id = d.user_id

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
  NULL
FROM public.registros_pendientes r
WHERE r.estado <> 'completado'

ORDER BY fecha_registro DESC;

COMMENT ON VIEW interno.cartera_clientes IS
  'Cartera de clientes de SYMVORA (uso interno, no expuesta en la API). Ver migracion 100.';

REVOKE ALL ON interno.cartera_clientes FROM PUBLIC, anon, authenticated;

COMMIT;
