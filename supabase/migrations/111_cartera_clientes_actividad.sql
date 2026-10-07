-- =============================================
-- 111: Cartera de clientes con actividad
-- ---------------------------------------------
-- Agrega a `interno.cartera_clientes` (migracion 100) si cada negocio ya
-- empezo a usar el sistema: productos y variantes activos (sin archivados),
-- el dia de su primer producto, cuantas ventas lleva y la ultima.
--
-- Las columnas nuevas van AL FINAL: `CREATE OR REPLACE VIEW` solo permite
-- agregar columnas despues de las que ya existen. En los registros
-- incompletos (sin negocio todavia) quedan en NULL.
--
-- Sigue sin exponerse por la API: mismo esquema `interno` y mismos REVOKE.
-- =============================================

BEGIN;

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

COMMENT ON VIEW interno.cartera_clientes IS
  'Cartera de clientes de SYMVORA (uso interno, no expuesta en la API). Ver migraciones 100 y 111.';

REVOKE ALL ON interno.cartera_clientes FROM PUBLIC, anon, authenticated;

COMMIT;
