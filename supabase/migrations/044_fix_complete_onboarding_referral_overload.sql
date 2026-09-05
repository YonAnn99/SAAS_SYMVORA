-- =============================================
-- 044: Fix complete_onboarding (overload de 8 parametros)
-- ---------------------------------------------
-- La migracion 038 corrigio complete_onboarding para que el primer
-- miembro de un tenant sea SUPER_ADMIN, pero solo tocó la firma de
-- 7 parametros (sin p_referral_code). La migracion 023 (referidos)
-- habia creado una segunda firma con 8 parametros que hardcodea
-- 'ORG_ADMIN' — y esa es la que el signup real llama siempre
-- (auth-forms.tsx pasa p_referral_code, aunque sea null), asi que
-- el fix de la 038 nunca se aplico en la practica.
--
-- Esta migracion:
--   1. Recrea la funcion de 8 parametros con la misma logica de
--      "primer miembro = SUPER_ADMIN" que ya tiene la de 7.
--   2. Elimina la funcion huerfana de 7 parametros (nadie la llama;
--      dejarla viva es lo que causo esta confusion).
--   3. Repara los tenants ya afectados en produccion: cualquier
--      tenant con cero SUPER_ADMIN queda con su fundador promovido.
-- =============================================

-- =============================================
-- 1. FIX complete_onboarding (8 parametros, con p_referral_code)
-- =============================================

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

  -- 5. Create user role (ON CONFLICT must match UNIQUE(user_id, role))
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    v_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 6. Create trial subscription server-side (7 dias). Antes la creaba el
  --    cliente browser; moverla aqui permite eliminar las politicas
  --    INSERT/UPDATE de authenticated sobre subscriptions (bypass de pago).
  INSERT INTO public.subscriptions (
    tenant_id,
    status,
    payment_method,
    trial_start,
    trial_end
  ) VALUES (
    v_tenant_id,
    'trial',
    'card',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 7. Generate own referral code (deterministic, unique by tenant id).
  --    El trigger trg_tenants_assign_codigo_referido ya lo asigna en el
  --    INSERT; este UPDATE es redundante pero inofensivo (mismo valor).
  UPDATE public.tenants
  SET codigo_referido = 'SYM' || upper(substr(replace(v_tenant_id::text, '-', ''), 1, 8))
  WHERE id = v_tenant_id;

  -- 8. Apply referral (if provided) — silently ignore self-referrals and
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

REVOKE ALL ON FUNCTION public.complete_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT
) TO authenticated;

-- =============================================
-- 2. DROP la firma huerfana de 7 parametros (nadie la llama)
-- =============================================

DROP FUNCTION IF EXISTS public.complete_onboarding(
  UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT
);

-- =============================================
-- 3. Repara tenants ya afectados: fundador unico sin SUPER_ADMIN
-- =============================================

WITH affected AS (
  -- Tenants with exactly one member and zero SUPER_ADMIN: the sole
  -- member must be the founder, mis-assigned as ORG_ADMIN by the bug.
  SELECT tenant_id, user_id
  FROM public.tenant_memberships
  WHERE tenant_id IN (
    SELECT tenant_id
    FROM public.tenant_memberships
    GROUP BY tenant_id
    HAVING COUNT(*) FILTER (WHERE role = 'SUPER_ADMIN') = 0
       AND COUNT(*) = 1
  )
),
fix_membership AS (
  UPDATE public.tenant_memberships tm
  SET role = 'SUPER_ADMIN'
  FROM affected a
  WHERE tm.tenant_id = a.tenant_id
    AND tm.user_id = a.user_id
    AND tm.role = 'ORG_ADMIN'
  RETURNING tm.user_id
)
UPDATE public.user_roles ur
SET role = 'SUPER_ADMIN'
FROM fix_membership fm
WHERE ur.user_id = fm.user_id
  AND ur.role = 'ORG_ADMIN';
