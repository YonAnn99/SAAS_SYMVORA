-- =============================================
-- 055: Permisos por usuario (excepciones sobre el rol)
-- ---------------------------------------------
-- El SUPER_ADMIN puede conceder o quitar modulos a un usuario concreto desde
-- /users. Por defecto NADA cambia: sin excepciones, authorize() se comporta
-- exactamente igual que antes (verificado: SUPER_ADMIN 17 permisos,
-- ORG_ADMIN 14, CAJERO 4, identico antes y despues).
--
-- POR QUE authorize() Y NO POLITICAS NUEVAS: 75 politicas en 25 tablas llaman
-- a authorize(). Haciendo que ESA funcion consulte las excepciones, las 75 lo
-- heredan sin tocar ninguna, y el permiso queda enforced en la base de datos
-- en vez de solo en la interfaz.
--
-- TRES BARRERAS INDEPENDIENTES sobre los permisos que reparten poder
-- (org.manage_members, org.manage_members_write, org.delete,
-- subscription.manage), porque en este proyecto la barrera unica ya fallo
-- cuatro veces (bugs #1, #27, #33, #34):
--   1. El diálogo no ofrece el switch (src/lib/modules.ts, grantable:false)
--   2. El endpoint lo rechaza (api/users/[userId]/permissions)
--   3. El CHECK de esta tabla lo rechaza aunque se salten las dos anteriores
--
-- NOTA: aplicada a produccion como 055a/055b/055c/055d.
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission TEXT NOT NULL,
  -- Booleano y no "la fila existe": hay que poder expresar tanto CONCEDER lo
  -- que el rol no da como QUITAR lo que si da.
  granted BOOLEAN NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, user_id, permission)
);

ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT user_permission_overrides_permission_check
  CHECK (permission IN (
    'sales.create', 'sales.view_reports', 'sales.void',
    'inventory.view', 'inventory.manage',
    'purchases.manage',
    'finances.manage',
    'org.manage_settings',
    'billing.view', 'billing.create', 'billing.stamp', 'billing.cancel', 'billing.config'
  ));

-- authorize() consulta esta tabla en CADA llamada y hay 75 politicas que la
-- usan (a veces por fila). El indice es lo que evita que eso se note.
CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_lookup
  ON public.user_permission_overrides (user_id, permission);

ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- Esta tabla ES el sistema de permisos: si sus escrituras quedan abiertas,
-- cualquiera se concede lo que quiera insertando una fila.
--
-- No hay recursion pese a que la politica llama a authorize() y authorize()
-- lee esta tabla: authorize() es SECURITY DEFINER, su lectura no pasa por RLS.
CREATE POLICY "user_permission_overrides_select" ON public.user_permission_overrides
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()));
CREATE POLICY "user_permission_overrides_insert" ON public.user_permission_overrides
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));
CREATE POLICY "user_permission_overrides_update" ON public.user_permission_overrides
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));
CREATE POLICY "user_permission_overrides_delete" ON public.user_permission_overrides
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('org.manage_members_write'));

COMMIT;

-- =============================================
-- authorize() + get_effective_permissions() + get_effective_permissions_for_user()
-- ---------------------------------------------
-- Los cuerpos completos se aplicaron en 055b/055c/055d. Resumen:
--
--  * authorize(permission): 1) si hay excepcion para auth.uid(), devuelve su
--    `granted`; 2) si no, role_permissions como siempre. FIRMA SIN CAMBIOS,
--    asi que va con CREATE OR REPLACE y no aplican los bugs #18 ni #23.
--
--    ⚠️ authorize() no recibe tenant_id, asi que busca la excepcion solo por
--    auth.uid(). Hoy cada usuario pertenece a UN tenant, asi que es exacto. Si
--    algun dia hay usuarios en dos negocios, una excepcion concedida en uno se
--    filtraria al otro y habria que pasar a una firma con tenant (lo que
--    obligaria a reescribir las 75 politicas). Ver CONTEXT.md.
--
--  * get_effective_permissions(tenant): permisos del usuario actual
--    (rol ∪ concedidos − quitados). Lo usa el sidebar. SI acota por tenant.
--
--  * get_effective_permissions_for_user(tenant, user): igual pero recibiendo
--    el usuario. Lo usa el middleware, que corre con service_role y ahi
--    auth.uid() es NULL. Solo service_role: deja leer los permisos de
--    cualquiera.
--
-- Para consultar las versiones vivas:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname IN ('authorize','get_effective_permissions',
--                      'get_effective_permissions_for_user');
-- =============================================
