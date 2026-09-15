-- =============================================
-- 061: Marcas de los avisos de fin de prueba
-- ---------------------------------------------
-- Hasta ahora no existia ningun correo que avisara del fin de la prueba. Quien
-- no entraba al sistema se quedaba bloqueado sin que nada se lo explicara, y
-- encima `/billing` le seguia diciendo "Prueba" (ver el pendiente de
-- CONTEXT.md, sesion 2026-09-14).
--
-- Se mandan DOS correos: uno a 2 dias del vencimiento y otro al vencer.
--
-- POR QUE HACEN FALTA ESTAS COLUMNAS: el disparador es un cron DIARIO. Sin una
-- marca de lo ya enviado, la misma cuenta recibiria el mismo correo cada dia
-- hasta que pagara. Son dos columnas y no una porque son dos avisos
-- independientes: haber mandado el previo no debe impedir el de vencimiento.
--
-- Nullable y sin valor por defecto a proposito: `NULL` significa exactamente
-- "todavia no se ha mandado", que es lo que consulta la ruta del cron.
-- =============================================

BEGIN;

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_aviso_previo_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_aviso_fin_en    TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.trial_aviso_previo_en IS
  'Cuando se envio el aviso de "tu prueba termina pronto". NULL = sin enviar.';
COMMENT ON COLUMN public.subscriptions.trial_aviso_fin_en IS
  'Cuando se envio el aviso de "tu prueba termino". NULL = sin enviar.';

-- El cron busca pruebas vivas por fecha de fin. Indice parcial: solo las que
-- estan en `trial` son candidatas, y son una fraccion minima de la tabla.
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end_pendientes
  ON public.subscriptions (trial_end)
  WHERE status = 'trial';

COMMIT;

-- =============================================
-- NO SE TOCAN LAS POLITICAS RLS.
--
-- `subscriptions` ya tiene su SELECT acotado por tenant y las escrituras
-- restringidas a `service_role` (migracion 028, bug #10: no reintroducir
-- politicas de escritura para `authenticated`, permitian activarse sin pagar).
-- La ruta del cron usa `service_role`, que salta RLS, asi que estas columnas
-- quedan cubiertas por lo que ya hay. El barrido de auditoria de la 054 debe
-- seguir dando el mismo resultado que antes de esta migracion.
-- =============================================

-- =============================================
-- VERIFICACION
--
--   -- Las columnas existen y arrancan vacias:
--   SELECT count(*) FILTER (WHERE trial_aviso_previo_en IS NULL) AS sin_previo,
--          count(*) FILTER (WHERE trial_aviso_fin_en IS NULL)    AS sin_fin
--     FROM subscriptions;
--
--   -- A quien le tocaria aviso ahora mismo (sin enviar nada):
--   SELECT t.nombre_comercial, s.status, s.trial_end,
--          round(EXTRACT(EPOCH FROM (s.trial_end - now()))/86400, 2) AS dias
--     FROM subscriptions s JOIN tenants t ON t.id = s.tenant_id
--    WHERE s.status = 'trial'
--      AND s.trial_end <= now() + INTERVAL '2 days'
--      AND s.trial_end >= now() - INTERVAL '3 days';
-- =============================================
