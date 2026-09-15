-- =============================================
-- 060: Un solo RPC para todo lo que el middleware necesita
-- ---------------------------------------------
-- PROBLEMA: `src/lib/supabase/middleware.ts` corre en CADA navegacion
-- autenticada y encadenaba hasta 4 consultas secuenciales a la base, ademas del
-- `auth.getUser()`:
--   1. tenant_memberships -> tenant_id + role
--   2. tenants            -> subscription_status
--   3. subscriptions      -> trial_end          (solo si el estado es 'trial')
--   4. get_effective_permissions_for_user()     (solo en rutas protegidas)
-- Cada una es un round trip contra PostgREST, que en el plan Free atiende con
-- un pool de 4 conexiones. Medido en produccion: 21,197 lecturas de
-- `tenant_memberships` y 30,466 de `tenants` por esta via.
--
-- Todas dependen del mismo `user_id`, asi que en la base son un unico JOIN.
--
-- NOTA SOBRE EL ORDEN: se resuelve la membresia con `ORDER BY creado_en DESC`,
-- igual que `custom_access_token_hook`. El codigo anterior usaba `.limit(1)`
-- SIN `order`, asi que para un usuario con dos negocios el middleware y el JWT
-- podian elegir tenants distintos. Hoy nadie pertenece a dos tenants, pero la
-- incoherencia estaba documentada como latente y aqui se cierra.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public.get_middleware_context(p_user_id UUID)
RETURNS TABLE (
  tenant_id           UUID,
  rol                 public.app_role,
  subscription_status public.subscription_status,
  trial_end           TIMESTAMPTZ,
  permisos            TEXT[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_rol       public.app_role;
BEGIN
  SELECT tm.tenant_id, tm.role
    INTO v_tenant_id, v_rol
    FROM public.tenant_memberships tm
   WHERE tm.user_id = p_user_id
   ORDER BY tm.creado_en DESC
   LIMIT 1;

  -- Sin membresia no hay contexto: se devuelve vacio y el middleware deja pasar
  -- igual que antes (el caso del invitado recien creado).
  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_tenant_id,
    v_rol,
    t.subscription_status,
    s.trial_end,
    COALESCE(
      ARRAY(
        SELECT p.permission
          FROM public.get_effective_permissions_for_user(v_tenant_id, p_user_id) p
      ),
      ARRAY[]::TEXT[]
    )
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
  WHERE t.id = v_tenant_id;
END;
$$;

-- Lo llama el middleware con `service_role`. `authenticated` no lo necesita y
-- devolveria el contexto de cualquier usuario que se le pase por parametro.
-- El REVOKE es obligatorio en toda SECURITY DEFINER nueva: Postgres concede
-- EXECUTE a PUBLIC por defecto (bug #23).
REVOKE ALL ON FUNCTION public.get_middleware_context(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_middleware_context(UUID) TO service_role;

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- Devuelve una fila coherente por usuario con membresia:
--   SELECT u.email, c.*
--     FROM auth.users u
--     CROSS JOIN LATERAL public.get_middleware_context(u.id) c;
--
--   -- anon/authenticated no pueden ejecutarlo:
--   SELECT has_function_privilege('authenticated',
--     'public.get_middleware_context(uuid)', 'EXECUTE');  -- false
-- =============================================
