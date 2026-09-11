-- =============================================
-- 054: Cierra la escalada CAJERO -> SUPER_ADMIN y el RBAC de ordenes de compra
-- ---------------------------------------------
-- Encontrado al responder "como quedaron las restricciones por usuario" tras
-- la migracion 053. Es el CUARTO hallazgo del mismo patron en este proyecto
-- (bugs #1, #27, #33 y este): la puerta HTTP cerrada y la de datos abierta.
--
-- ESCALADA COMPLETA A SUPER_ADMIN (la cadena, verificada):
--   1. user_invite_keys tenia INSERT/UPDATE/DELETE `TO authenticated` con solo
--      aislamiento por tenant, sin authorize().
--   2. La tabla tiene columna `role TEXT` (default 'CAJERO') SIN CHECK.
--   3. Un CAJERO insertaba por PostgREST una clave con role='SUPER_ADMIN'.
--   4. Llamaba a POST /api/auth/key-login con ese email + clave.
--   5. validate_invite_key() DEVUELVE el rol
--      (TABLE(p_tenant_id uuid, p_role text, p_valid boolean)).
--   6. El endpoint hace upsert en tenant_memberships CON ESE ROL.
--   => SUPER_ADMIN de su propio negocio: facturacion, usuarios, todo.
--
-- /api/users/invite SI exigia org.manage_members_write (SUPER_ADMIN-only). El
-- problema era que PostgREST expone la tabla directamente y se salta la ruta.
--
-- Se aplicaron DOS barreras independientes a proposito, porque una sola ya
-- fallo: la politica RLS, y un CHECK sobre el dato que impide que cualquier
-- clave otorgue SUPER_ADMIN pase lo que pase con la politica.
--
-- Verificado antes de aplicar: ningun flujo del navegador ESCRIBE esta tabla
-- (users/page.tsx solo hace .select(); invite y revoke van por rutas API con
-- service_role, que salta RLS). Sin duplicados de `key` ni roles invalidos.
--
-- NOTA: aplicada a produccion como 054a/054b.
-- =============================================

BEGIN;

-- =============================================
-- 1. user_invite_keys
-- =============================================

DROP POLICY IF EXISTS "invite_keys_insert" ON public.user_invite_keys;
DROP POLICY IF EXISTS "invite_keys_update" ON public.user_invite_keys;
DROP POLICY IF EXISTS "invite_keys_delete" ON public.user_invite_keys;

CREATE POLICY "invite_keys_insert" ON public.user_invite_keys
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));
CREATE POLICY "invite_keys_update" ON public.user_invite_keys
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));
CREATE POLICY "invite_keys_delete" ON public.user_invite_keys
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));

-- Segunda barrera, independiente de la politica: una clave de invitacion NUNCA
-- puede otorgar SUPER_ADMIN. Para nombrar a otro dueno hay que ascenderlo
-- explicitamente desde /users. Decision del usuario (2026-09-11).
ALTER TABLE public.user_invite_keys
  ADD CONSTRAINT user_invite_keys_role_check
  CHECK (role IN ('ORG_ADMIN', 'CAJERO'));

-- Sin esto, dos filas podian compartir clave y validate_invite_key() resolveria
-- de forma ambigua cual de las dos (y con que rol).
ALTER TABLE public.user_invite_keys
  ADD CONSTRAINT user_invite_keys_key_unique UNIQUE (key);

-- =============================================
-- 2. ordenes_compra / detalle_orden_compra
-- ---------------------------------------------
-- Mismo defecto, menos grave: un CAJERO podia crear y modificar ordenes.
-- Recibirlas ya quedo cerrado en la 053 (recibir_orden_compra exige
-- purchases.manage), aqui se cierra el resto del ciclo.
-- =============================================

DROP POLICY IF EXISTS "ordenes_compra_isolation" ON public.ordenes_compra;
CREATE POLICY "ordenes_compra_select" ON public.ordenes_compra
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()));
CREATE POLICY "ordenes_compra_insert" ON public.ordenes_compra
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('purchases.manage'));
CREATE POLICY "ordenes_compra_update" ON public.ordenes_compra
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('purchases.manage'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('purchases.manage'));
CREATE POLICY "ordenes_compra_delete" ON public.ordenes_compra
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('purchases.manage'));

DROP POLICY IF EXISTS "detalle_orden_compra_isolation" ON public.detalle_orden_compra;
CREATE POLICY "detalle_orden_compra_select" ON public.detalle_orden_compra
  FOR SELECT TO authenticated
  USING (orden_compra_id IN (
    SELECT oc.id FROM public.ordenes_compra oc
    WHERE oc.tenant_id IN (SELECT user_tenant_ids())));
CREATE POLICY "detalle_orden_compra_insert" ON public.detalle_orden_compra
  FOR INSERT TO authenticated
  WITH CHECK (orden_compra_id IN (
    SELECT oc.id FROM public.ordenes_compra oc
    WHERE oc.tenant_id IN (SELECT user_tenant_ids())) AND authorize('purchases.manage'));
CREATE POLICY "detalle_orden_compra_update" ON public.detalle_orden_compra
  FOR UPDATE TO authenticated
  USING (orden_compra_id IN (
    SELECT oc.id FROM public.ordenes_compra oc
    WHERE oc.tenant_id IN (SELECT user_tenant_ids())) AND authorize('purchases.manage'))
  WITH CHECK (orden_compra_id IN (
    SELECT oc.id FROM public.ordenes_compra oc
    WHERE oc.tenant_id IN (SELECT user_tenant_ids())) AND authorize('purchases.manage'));
CREATE POLICY "detalle_orden_compra_delete" ON public.detalle_orden_compra
  FOR DELETE TO authenticated
  USING (orden_compra_id IN (
    SELECT oc.id FROM public.ordenes_compra oc
    WHERE oc.tenant_id IN (SELECT user_tenant_ids())) AND authorize('purchases.manage'));

COMMIT;

-- =============================================
-- BARRIDO DE AUDITORIA — guardar y reejecutar periodicamente.
-- Lista toda tabla con RLS cuyas escrituras NO comprueban permiso. Es la
-- consulta que habria delatado los bugs #33 y #34 sesiones antes.
-- Resultado esperado: solo service_role (correcto, salta RLS por diseno) mas
-- activity_logs y sugerencias, que deben estar abiertas a todos.
--
--   SELECT c.relname, string_agg(DISTINCT p.cmd, ', ') AS escrituras_abiertas,
--          string_agg(DISTINCT p.roles::text, ', ') AS para_roles
--     FROM pg_class c
--     JOIN pg_namespace n ON n.oid = c.relnamespace
--     JOIN pg_policies p ON p.schemaname='public' AND p.tablename = c.relname
--    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
--      AND p.cmd IN ('INSERT','UPDATE','DELETE','ALL')
--      AND COALESCE(p.qual,'') || COALESCE(p.with_check,'') NOT LIKE '%authorize%'
--    GROUP BY c.relname ORDER BY c.relname;
-- =============================================
