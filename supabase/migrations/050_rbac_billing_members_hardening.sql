-- =============================================
-- 050: Hardening RBAC — suscripcion y gestion de miembros
-- ---------------------------------------------
-- Dos escaladas de privilegio encontradas en la auditoria del 2026-09-10:
--
-- 1) CUALQUIER miembro podia cancelar la suscripcion del negocio.
--    /api/conekta/cancel-subscription, create-checkout y promo/apply
--    llamaban requireTenantAccess() SIN `permission`, asi que bastaba con
--    pertenecer al tenant. Sumado a que la guarda SUPER_ADMIN de /billing
--    en el middleware era codigo muerto (la ruta cae en isPublicRoute por
--    el fix del redirect loop, bug #9), un CAJERO podia entrar a /billing
--    y dar de baja el servicio de todo el negocio.
--
-- 2) Un ORG_ADMIN podia borrar permanentemente la cuenta del dueno.
--    `org.manage_members` esta concedido a SUPER_ADMIN **y** ORG_ADMIN,
--    y es el unico permiso que exigian /api/users/[userId] (PATCH/DELETE),
--    /api/users/invite y /api/users/keys/[keyId]. La UI restringe a
--    SUPER_ADMIN (`canManage`) pero eso es cosmetico: un DELETE directo
--    pasaba. Peor: las politicas RLS de `tenant_memberships`
--    (INSERT/UPDATE/DELETE) tambien usan `org.manage_members`, asi que el
--    ORG_ADMIN podia manipular membresias por PostgREST sin tocar la API.
--
-- Se introducen dos permisos nuevos SOLO para SUPER_ADMIN en vez de
-- revocar `org.manage_members` a ORG_ADMIN: ese permiso tambien gobierna
-- la politica de SELECT de `user_roles`, y revocarlo dejaria al ORG_ADMIN
-- sin la vista de solo-lectura de usuarios que si le corresponde.
-- =============================================

BEGIN;

-- =============================================
-- 1. Permisos nuevos (SUPER_ADMIN unicamente)
-- =============================================

INSERT INTO public.role_permissions (role, permission) VALUES
  ('SUPER_ADMIN', 'subscription.manage'),
  ('SUPER_ADMIN', 'org.manage_members_write')
ON CONFLICT (role, permission) DO NOTHING;

-- =============================================
-- 2. Escritura sobre tenant_memberships: solo SUPER_ADMIN
-- ---------------------------------------------
-- SELECT no se toca: la politica `tenant_memberships_select` sigue
-- acotada por user_tenant_ids(), y el ORG_ADMIN debe poder ver la tabla
-- de usuarios en modo lectura.
-- =============================================

DROP POLICY IF EXISTS "tenant_memberships_insert" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_insert" ON public.tenant_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT user_tenant_ids())
    AND authorize('org.manage_members_write')
  );

DROP POLICY IF EXISTS "tenant_memberships_update" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_update" ON public.tenant_memberships
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT user_tenant_ids())
    AND authorize('org.manage_members_write')
  )
  WITH CHECK (
    tenant_id IN (SELECT user_tenant_ids())
    AND authorize('org.manage_members_write')
  );

DROP POLICY IF EXISTS "tenant_memberships_delete" ON public.tenant_memberships;
CREATE POLICY "tenant_memberships_delete" ON public.tenant_memberships
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT user_tenant_ids())
    AND authorize('org.manage_members_write')
  );

COMMIT;
