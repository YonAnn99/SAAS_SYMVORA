-- =============================================
-- 008: Fix complete_onboarding (security + UNIQUE)
-- ---------------------------------------------
-- 1. Unifica los dos overloads en uno solo (con p_logo_url).
-- 2. ON CONFLICT (user_id, role) que corresponde a la restriccion real UNIQUE(user_id, role).
-- 3. Valida auth.uid() = p_user_id: impide crear tenants/membresias a nombre de otro usuario.
-- 4. Maneja limpio el UNIQUE(subdominio) con EXCEPTION block.
-- =============================================

-- Drop both existing overloads (the 6-arg and the 7-arg) unconditionally.
DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, jsonb);
DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, jsonb, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_nombre_comercial TEXT,
  p_subdominio TEXT,
  p_giro_comercial TEXT,
  p_color_primario TEXT DEFAULT NULL,
  p_configuracion_json JSONB DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL
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
  -- Security: only the authenticated user may bootstrap their own tenant
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: no puedes crear un negocio a nombre de otro usuario';
  END IF;

  -- 1. Create tenant
  INSERT INTO public.tenants (
    nombre_comercial,
    subdominio,
    giro_comercial,
    color_primario,
    logo_url
  ) VALUES (
    p_nombre_comercial,
    p_subdominio,
    p_giro_comercial,
    p_color_primario,
    p_logo_url
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

  -- 4. Create user role (ON CONFLICT must match UNIQUE(user_id, role))
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    'ORG_ADMIN'
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- Return the created tenant
  SELECT to_jsonb(t.*) INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  RETURN v_tenant;

  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'El subdominio "%" ya esta en uso. Prueba otro.', p_subdominio
      USING ERRCODE = '23505';
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
) TO authenticated;