-- =============================================
-- 131: Ingresos mensuales de SYMVORA (uso interno)
-- ---------------------------------------------
-- Lo que cobro SYMVORA por suscripciones, mes por mes (zona CDMX): para la
-- contabilidad de la empresa sin buscar pago por pago en Conekta.
--
-- Fuente: `payment_history` con `status = 'completed'` y `amount > 0` (el
-- webhook de Conekta guarda `amount` en pesos, ya dividido entre 100). Sin
-- negocios demo, con la misma regla que `resumen_interno_diario()` (123):
-- `demo_expira_en IS NOT NULL` y el demo compartido viejo (miembro `is_demo`).
--
-- IVA: el precio al publico ($399/mes) incluye IVA, asi que `base_sin_iva` =
-- total / 1.16 y `iva` = la diferencia. Confirmarlo con el contador.
--
-- NO es parte de la app: vive en el esquema `interno` (no expuesto por la API)
-- igual que `interno.cartera_clientes` (100, 111). Consulta:
--   select * from interno.ingresos_mensuales;
-- =============================================

BEGIN;

CREATE OR REPLACE VIEW interno.ingresos_mensuales AS
WITH reales AS (
  SELECT t.id
  FROM public.tenants t
  WHERE t.demo_expira_en IS NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE m.tenant_id = t.id
        AND COALESCE(u.raw_app_meta_data ->> 'is_demo', 'false') = 'true'
    )
),
pagos AS (
  SELECT
    date_trunc('month', ph.paid_at AT TIME ZONE 'America/Mexico_City')::date AS mes,
    s.tenant_id,
    ph.amount,
    ph.currency,
    ph.payment_method::text AS metodo
  FROM public.payment_history ph
  JOIN public.subscriptions s ON s.id = ph.subscription_id
  JOIN reales r ON r.id = s.tenant_id
  WHERE ph.status = 'completed'
    AND ph.amount > 0
    AND ph.paid_at IS NOT NULL
),
por_metodo AS (
  SELECT mes, jsonb_object_agg(metodo, total ORDER BY metodo) AS por_metodo
  FROM (
    SELECT mes, COALESCE(metodo, 'desconocido') AS metodo, sum(amount) AS total
    FROM pagos
    GROUP BY 1, 2
  ) x
  GROUP BY mes
)
SELECT
  p.mes,
  count(*) AS pagos,
  count(DISTINCT p.tenant_id) AS negocios,
  sum(p.amount) AS total,
  round(sum(p.amount) / 1.16, 2) AS base_sin_iva,
  sum(p.amount) - round(sum(p.amount) / 1.16, 2) AS iva,
  m.por_metodo,
  string_agg(DISTINCT p.currency, ', ') AS moneda
FROM pagos p
JOIN por_metodo m ON m.mes = p.mes
GROUP BY p.mes, m.por_metodo
ORDER BY p.mes DESC;

COMMENT ON VIEW interno.ingresos_mensuales IS
  'Ingresos de SYMVORA por mes (CDMX): pagos completados de suscripciones, sin demos. Uso interno, no expuesta en la API. Ver migracion 131.';

REVOKE ALL ON interno.ingresos_mensuales FROM PUBLIC, anon, authenticated;

COMMIT;
