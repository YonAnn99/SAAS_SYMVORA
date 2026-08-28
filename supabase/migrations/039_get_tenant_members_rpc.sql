-- 039: RPC to get tenant members with user email
-- Avoids cross-schema FK join issues with auth.users

CREATE OR REPLACE FUNCTION public.get_tenant_members(p_tenant_id UUID)
RETURNS TABLE (
  id UUID,
  tenant_id UUID,
  user_id UUID,
  role app_role,
  creado_en TIMESTAMPTZ,
  user_email TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT tm.id, tm.tenant_id, tm.user_id, tm.role, tm.creado_en,
         u.email AS user_email
  FROM public.tenant_memberships tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tenant_id = p_tenant_id
  ORDER BY tm.creado_en DESC;
$$;

REVOKE ALL ON FUNCTION public.get_tenant_members(UUID) FROM public;
GRANT EXECUTE ON FUNCTION public.get_tenant_members(UUID) TO authenticated;
