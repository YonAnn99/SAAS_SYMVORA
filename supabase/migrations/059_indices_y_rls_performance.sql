-- =============================================
-- 059: Higiene de rendimiento en BD
-- ---------------------------------------------
-- Los dos hallazgos de `get_advisors(type: "performance")` que si son reales.
-- (Los 20 "indices sin usar" que tambien reporta NO se tocan: con 15 MB de
-- datos Postgres prefiere secuencial en casi todo, asi que ese aviso mide la
-- falta de datos, no un indice sobrante. Borrarlos los haria falta justo cuando
-- las tablas crezcan.)
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. Claves foraneas sin indice de cobertura
-- ---------------------------------------------
-- Sin indice, cada DELETE o UPDATE en la tabla referenciada tiene que escanear
-- la tabla hija entera para comprobar la FK. Hoy son tablas diminutas y no se
-- nota; con historico real, borrar un usuario o un tenant empieza a costar
-- escaneos completos.

CREATE INDEX IF NOT EXISTS idx_pagos_credito_usuario
  ON public.pagos_credito (usuario_id);

CREATE INDEX IF NOT EXISTS idx_sugerencias_tenant
  ON public.sugerencias (tenant_id);

CREATE INDEX IF NOT EXISTS idx_sugerencias_usuario
  ON public.sugerencias (usuario_id);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_created_by
  ON public.user_permission_overrides (created_by);

-- ---------------------------------------------
-- 2. `sugerencias_insert` reevalua auth.uid() por fila
-- ---------------------------------------------
-- Es la unica politica del esquema que llama a `auth.uid()` sin envolver. Sin
-- el `(SELECT ...)`, Postgres la trata como volatil y la ejecuta UNA VEZ POR
-- FILA en vez de una vez por consulta. Todas las demas politicas del proyecto
-- ya usan la forma envuelta; esta se quedo atras en la migracion 043.
--
-- Se conserva la semantica exacta: mismo tenant y el registro debe ser del
-- propio usuario.

DROP POLICY IF EXISTS "sugerencias_insert" ON public.sugerencias;
CREATE POLICY "sugerencias_insert" ON public.sugerencias
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT user_tenant_ids())
    AND usuario_id = (SELECT auth.uid())
  );

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- No deben quedar FK sin indice ni avisos de initplan:
--   --   get_advisors(type: "performance")
--
--   -- La politica quedo con auth.uid() envuelto:
--   SELECT pg_get_expr(polwithcheck, polrelid)
--     FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--    WHERE c.relname = 'sugerencias' AND p.polname = 'sugerencias_insert';
--
--   -- Las escrituras de `sugerencias` siguen abiertas a todo el equipo a
--   -- proposito (es el buzon del cliente); el barrido de auditoria de la 054
--   -- debe seguir listando solo service_role + activity_logs + sugerencias.
-- =============================================
