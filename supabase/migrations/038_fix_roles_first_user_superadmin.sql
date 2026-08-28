-- =============================================
-- 038: Fix roles + first user = SUPER_ADMIN
-- ---------------------------------------------
-- 1. custom_access_token_hook reads role from tenant_memberships
--    (source of truth) instead of user_roles (legacy, can drift).
-- 2. complete_onboarding assigns SUPER_ADMIN to the first user
--    of each tenant (the founder/owner).
-- 3. Helper to promote existing test accounts.
-- =============================================

-- =============================================
-- 1. FIX custom_access_token_hook
-- =============================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event JSONB)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  claims JSONB;
  user_role public.app_role;
  v_tenant_id UUID;
BEGIN
  -- Read role from tenant_memberships (source of truth, scoped per tenant)
  SELECT tm.role, tm.tenant_id
  INTO user_role, v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = (event->>'user_id')::UUID
  ORDER BY tm.creado_en DESC
  LIMIT 1;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role::text));
  ELSE
    claims := jsonb_set(claims, '{user_role}', 'null');
  END IF;

  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{tenant_id}', to_jsonb(v_tenant_id::text));
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- =============================================
-- 2. FIX complete_onboarding: first user = SUPER_ADMIN
-- =============================================

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
  v_member_count BIGINT;
  v_role app_role;
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

  -- 3. First user of the tenant gets SUPER_ADMIN (the owner/founder)
  SELECT COUNT(*) INTO v_member_count
  FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_id;

  IF v_member_count = 0 THEN
    v_role := 'SUPER_ADMIN';
  ELSE
    v_role := 'ORG_ADMIN';
  END IF;

  -- 4. Create membership
  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role
  ) VALUES (
    v_tenant_id,
    p_user_id,
    v_role
  );

  -- 5. Create user role (sync for JWT hook compatibility)
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    v_role
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

-- =============================================
-- 3. PROMOTE EXISTING TEST ACCOUNTS
-- =============================================
-- Run this manually for the test account:
-- UPDATE public.tenant_memberships SET role = 'SUPER_ADMIN'
--   WHERE user_id = (SELECT id FROM auth.users WHERE email = 'pruebas@symvora.com.mx');
-- INSERT INTO public.user_roles (user_id, role)
--   SELECT id, 'SUPER_ADMIN' FROM auth.users WHERE email = 'pruebas@symvora.com.mx'
--   ON CONFLICT (user_id, role) DO NOTHING;
-- UPDATE public.subscriptions SET status = 'active', trial_end = NULL
--   WHERE tenant_id = (SELECT tenant_id FROM public.tenant_memberships
--     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'pruebas@symvora.com.mx'));
-- UPDATE public.tenants SET subscription_status = 'active'
--   WHERE id = (SELECT tenant_id FROM public.tenant_memberships
--     WHERE user_id = (SELECT id FROM auth.users WHERE email = 'pruebas@symvora.com.mx'));
