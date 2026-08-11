-- SECURITY DEFINER function to complete onboarding atomically
-- This bypasses RLS to allow a new user to bootstrap their tenant

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_nombre_comercial TEXT,
  p_subdominio TEXT,
  p_giro_comercial TEXT,
  p_color_primario TEXT DEFAULT NULL,
  p_configuracion_json JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant JSONB;
BEGIN
  -- 1. Create tenant
  INSERT INTO public.tenants (
    nombre_comercial,
    subdominio,
    giro_comercial,
    color_primario
  ) VALUES (
    p_nombre_comercial,
    p_subdominio,
    p_giro_comercial,
    p_color_primario
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Create tenant settings
  INSERT INTO public.tenant_settings (
    tenant_id,
    configuracion_json
  ) VALUES (
    v_tenant_id,
    COALESCE(p_configuracion_json, '{}'::jsonb)
  );

  -- 3. Create membership (ORG_ADMIN for the founder)
  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role
  ) VALUES (
    v_tenant_id,
    p_user_id,
    'ORG_ADMIN'
  );

  -- 4. Create user role
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    'ORG_ADMIN'
  )
  ON CONFLICT (user_id) DO UPDATE
    SET role = EXCLUDED.role;

  -- Return the created tenant
  SELECT to_jsonb(t.*) INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  RETURN v_tenant;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB
) TO authenticated;
