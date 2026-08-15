-- =============================================
-- 024: Fix codigo_referido + backfill + trigger
-- ---------------------------------------------
-- 1. FIX: complete_onboarding de 023 usaba encode(uuid::bytea) que es un cast
--    invalido en Postgres (42846) => cualquier signup fallaria en runtime.
--    Se corrige con la expresion equivalente en texto (coincide 1:1 con
--    src/lib/referrals.ts generateReferralCode):
--      'SYM' + upper(primeros 8 chars del hex del id sin guiones)
-- 2. Backfill: asigna el codigo a los tenants pre-023 cuyo codigo quedo NULL.
-- 3. Trigger BEFORE INSERT: garantiza que TODO tenant nuevo (seed demo,
--    admin, etc.) reciba codigo aunque no pase por complete_onboarding.
-- =============================================

-- =============================================
-- 1. FIX complete_onboarding (paso "generar codigo")
-- =============================================

DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_nombre_comercial TEXT,
  p_subdominio TEXT,
  p_giro_comercial TEXT,
  p_color_primario TEXT DEFAULT NULL,
  p_configuracion_json JSONB DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_referral_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant JSONB;
  v_referrer_tenant_id UUID;
  v_is_self INT;
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

  -- 5. Generate own referral code (deterministic, unique by tenant id).
  --    El trigger trg_tenants_assign_codigo_referido ya lo asigna en el
  --    INSERT; este UPDATE es redundante pero inofensivo (mismo valor).
  UPDATE public.tenants
  SET codigo_referido = 'SYM' || upper(substr(replace(v_tenant_id::text, '-', ''), 1, 8))
  WHERE id = v_tenant_id;

  -- 6. Apply referral (if provided) — silently ignore self-referrals and
  --    tenants that were already referred.
  IF p_referral_code IS NOT NULL AND btrim(p_referral_code) <> '' THEN
    BEGIN
      SELECT t.id INTO v_referrer_tenant_id
      FROM public.tenants t
      WHERE t.codigo_referido = UPPER(btrim(p_referral_code));

      IF v_referrer_tenant_id IS NOT NULL THEN
        SELECT 1 INTO v_is_self
        FROM public.tenant_memberships
        WHERE tenant_id = v_referrer_tenant_id
          AND user_id = p_user_id
        LIMIT 1;

        IF v_is_self IS NULL THEN
          INSERT INTO public.referidos (
            tenant_referidor_id,
            tenant_referido_id,
            estado,
            registrado_en
          ) VALUES (
            v_referrer_tenant_id,
            v_tenant_id,
            'REGISTRADO',
            NOW()
          );
        END IF;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- El tenant nuevo ya fue referido con otro codigo: se ignora.
      NULL;
    END;
  END IF;

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

REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- =============================================
-- 2. BACKFILL: tenants pre-023 (codigo NULL)
-- =============================================

UPDATE public.tenants
SET codigo_referido = 'SYM' || upper(substr(replace(id::text, '-', ''), 1, 8))
WHERE codigo_referido IS NULL;

-- =============================================
-- 3. TRIGGER: todo tenant nuevo recibe codigo
-- =============================================

CREATE OR REPLACE FUNCTION public.tenants_assign_codigo_referido()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.codigo_referido IS NULL THEN
    NEW.codigo_referido := 'SYM' || upper(substr(replace(NEW.id::text, '-', ''), 1, 8));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tenants_assign_codigo_referido ON public.tenants;
CREATE TRIGGER trg_tenants_assign_codigo_referido
BEFORE INSERT ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.tenants_assign_codigo_referido();