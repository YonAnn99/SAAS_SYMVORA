-- =============================================
-- 140: Cartera de clientes con métricas de embudo de activación
-- ---------------------------------------------
-- Actualiza la vista `interno.cartera_clientes` para clasificar automáticamente
-- la etapa del embudo de cada negocio:
--   - 01_REGISTRO_INCOMPLETO: Registro abandonado en borrador.
--   - 02_FANTASMA_0_PROD: Cuenta creada, pero con 0 productos y 0 ventas.
--   - 03_EN_ARMADO_SIN_VENTAS: Tiene productos agregados, pero aún no vende.
--   - 04_ACTIVADO: Ya cobró entre 1 y 4 ventas (probó el POS).
--   - 05_RETENIDO_ACTIVO: >= 5 ventas y actividad en los últimos 7 días.
--   - 06_EN_RIESGO_DORMIDO: Registró ventas pero lleva > 7 días inactivo.
--   - 07_CUENTA_CERRADA: Negocio eliminado que conservó contacto.
--
-- Agrega además:
--   - dias_restantes_prueba: Días de trial vigentes para priorizar cierres.
--   - dias_desde_registro: Antigüedad de la cuenta en días.
--   - total_vendido_mxn: Facturación real acumulada del negocio en SYMVORA.
--   - ultimo_acceso: Fecha del último login del dueño (auth.users.last_sign_in_at).
--   - link_whatsapp: Enlace clicable directo a wa.me para contacto 1 a 1.
-- =============================================

BEGIN;

CREATE OR REPLACE VIEW interno.cartera_clientes AS
WITH duenos AS (
  SELECT DISTINCT ON (m.tenant_id) m.tenant_id, m.user_id
  FROM public.tenant_memberships m
  WHERE m.role = 'SUPER_ADMIN'::app_role
  ORDER BY m.tenant_id, m.user_id
)
SELECT
  'Cliente'::text AS tipo,
  NULLIF(TRIM(BOTH FROM COALESCE(
    (u.raw_user_meta_data ->> 'nombre_completo'::text),
    (u.raw_user_meta_data ->> 'nombre'::text),
    (u.raw_user_meta_data ->> 'full_name'::text),
    ''::text
  )), ''::text) AS nombre_completo,
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
    WHERE p.tenant_id = t.id AND p.archivado_en IS NULL
  ) AS productos,
  ( SELECT count(*) AS count
    FROM variantes_producto v
    WHERE v.tenant_id = t.id AND v.archivado_en IS NULL
  ) AS variantes,
  ( SELECT min(p.creado_en) AS min
    FROM productos p
    WHERE p.tenant_id = t.id
  ) AS primer_producto,
  ( SELECT count(*) AS count
    FROM ventas vt
    WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta
  ) AS ventas,
  ( SELECT max(vt.fecha_venta) AS max
    FROM ventas vt
    WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta
  ) AS ultima_venta,
  -- Nuevas columnas de diagnóstico y embudo de conversión
  CASE
    WHEN (SELECT count(*) FROM productos p WHERE p.tenant_id = t.id AND p.archivado_en IS NULL) = 0
         AND (SELECT count(*) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) = 0
      THEN '02_FANTASMA_0_PROD'::text
    WHEN (SELECT count(*) FROM productos p WHERE p.tenant_id = t.id AND p.archivado_en IS NULL) > 0
         AND (SELECT count(*) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) = 0
      THEN '03_EN_ARMADO_SIN_VENTAS'::text
    WHEN (SELECT count(*) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) BETWEEN 1 AND 4
      THEN '04_ACTIVADO'::text
    WHEN (SELECT count(*) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) >= 5
         AND (SELECT max(vt.fecha_venta) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) >= (now() - interval '7 days')
      THEN '05_RETENIDO_ACTIVO'::text
    WHEN (SELECT count(*) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) >= 1
         AND (SELECT max(vt.fecha_venta) FROM ventas vt WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta) < (now() - interval '7 days')
      THEN '06_EN_RIESGO_DORMIDO'::text
    ELSE '04_ACTIVADO'::text
  END AS etapa_embudo,
  CASE
    WHEN (s.status = 'trial'::subscription_status AND s.trial_end IS NOT NULL)
      THEN GREATEST(0, CEIL(EXTRACT(EPOCH FROM (s.trial_end - now())) / 86400.0)::integer)
    ELSE NULL::integer
  END AS dias_restantes_prueba,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - t.creado_en)) / 86400.0)::integer) AS dias_desde_registro,
  ( SELECT COALESCE(sum(vt.total), 0)
    FROM ventas vt
    WHERE vt.tenant_id = t.id AND vt.estado = 'COMPLETADA'::estado_venta
  ) AS total_vendido_mxn,
  u.last_sign_in_at AS ultimo_acceso,
  CASE
    WHEN c.telefono IS NOT NULL AND TRIM(c.telefono) <> ''
      THEN 'https://wa.me/' || regexp_replace(c.telefono, '[^0-9]', '', 'g')
    ELSE NULL::text
  END AS link_whatsapp
FROM public.tenants t
JOIN duenos d ON d.tenant_id = t.id
JOIN auth.users u ON u.id = d.user_id
LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
LEFT JOIN public.tenant_settings ts ON ts.tenant_id = t.id
LEFT JOIN public.contacto_usuarios c ON c.user_id = d.user_id
WHERE t.demo_expira_en IS NULL

UNION ALL

SELECT
  'Registro incompleto'::text AS tipo,
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
  NULL::timestamp with time zone AS ultima_venta,
  '01_REGISTRO_INCOMPLETO'::text AS etapa_embudo,
  NULL::integer AS dias_restantes_prueba,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - r.creado_en)) / 86400.0)::integer) AS dias_desde_registro,
  0::numeric AS total_vendido_mxn,
  NULL::timestamp with time zone AS ultimo_acceso,
  CASE
    WHEN r.telefono IS NOT NULL AND TRIM(r.telefono) <> ''
      THEN 'https://wa.me/' || regexp_replace(r.telefono, '[^0-9]', '', 'g')
    ELSE NULL::text
  END AS link_whatsapp
FROM public.registros_pendientes r
WHERE r.estado <> 'completado'::text

UNION ALL

SELECT
  'Cuenta cerrada'::text AS tipo,
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
  NULL::timestamp with time zone AS ultima_venta,
  '07_CUENTA_CERRADA'::text AS etapa_embudo,
  NULL::integer AS dias_restantes_prueba,
  GREATEST(0, FLOOR(EXTRACT(EPOCH FROM (now() - k.conservado_en)) / 86400.0)::integer) AS dias_desde_registro,
  0::numeric AS total_vendido_mxn,
  NULL::timestamp with time zone AS ultimo_acceso,
  CASE
    WHEN k.celular IS NOT NULL AND TRIM(k.celular) <> ''
      THEN 'https://wa.me/' || regexp_replace(k.celular, '[^0-9]', '', 'g')
    ELSE NULL::text
  END AS link_whatsapp
FROM interno.contactos_conservados k
ORDER BY 8 DESC;

COMMENT ON VIEW interno.cartera_clientes IS
  'Cartera de clientes interna con métricas de embudo (etapa_embudo: 01_REGISTRO_INCOMPLETO, 02_FANTASMA_0_PROD, 03_EN_ARMADO_SIN_VENTAS, 04_ACTIVADO, 05_RETENIDO_ACTIVO, 06_EN_RIESGO_DORMIDO, 07_CUENTA_CERRADA), días de prueba restantes, facturación acumulada y link de WhatsApp.';

REVOKE ALL ON interno.cartera_clientes FROM PUBLIC, anon, authenticated;

COMMIT;
