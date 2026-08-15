-- =============================================
-- 023: Programa de Referidos
-- ---------------------------------------------
-- 1. tenants.codigo_referido (codigo estable por negocio, UNIQUE).
-- 2. subscriptions.creditos_mes_gratis (meses gratis acumulados).
-- 3. Tabla referidos (ledger: 1 fila por referido; tenant_referido_id UNIQUE
--    => un tenant solo puede ser referido una vez).
-- 4. complete_onboarding con p_referral_code: genera el codigo propio y
--    aplica la referencia (ignora auto-referencias y conflictos).
-- =============================================

-- =============================================
-- COLUMNAS NUEVAS
-- =============================================

ALTER TABLE public.tenants
  ADD COLUMN codigo_referido TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_tenants_codigo_referido
  ON public.tenants(codigo_referido);

ALTER TABLE public.subscriptions
  ADD COLUMN creditos_mes_gratis INT NOT NULL DEFAULT 0;

-- =============================================
-- TABLA REFERIDOS
-- =============================================

CREATE TABLE public.referidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_referidor_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tenant_referido_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  estado TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE | REGISTRADO | CONVERTIDO
  registrado_en TIMESTAMPTZ,
  convertido_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT referidos_referido_unico UNIQUE (tenant_referido_id)
);

CREATE INDEX IF NOT EXISTS idx_referidos_referidor ON public.referidos(tenant_referidor_id);
CREATE INDEX IF NOT EXISTS idx_referidos_referido ON public.referidos(tenant_referido_id);

-- =============================================
-- RLS REFERIDOS
-- =============================================

ALTER TABLE public.referidos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "referidor_ve_sus_referidos" ON public.referidos;
  DROP POLICY IF EXISTS "referido_ve_su_referido" ON public.referidos;
  DROP POLICY IF EXISTS "service_role_gestiona_referidos" ON public.referidos;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- El referidor ve sus referidos salientes; el referido ve su fila de entrada.
CREATE POLICY "referidor_ve_sus_referidos" ON public.referidos FOR SELECT
  USING (tenant_referidor_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "referido_ve_su_referido" ON public.referidos FOR SELECT
  USING (tenant_referido_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "service_role_gestiona_referidos" ON public.referidos FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- COMPLETE_ONBOARDING + p_referral_code
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

  -- 5. Generate own referral code (deterministic, unique by tenant id)
  UPDATE public.tenants
  SET codigo_referido = 'SYM' || substr(upper(encode(v_tenant_id::bytea, 'hex')), 1, 8)
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

-- Grants: solo authenticated (020 revoco anon/public sobre la firma previa).
REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- =============================================
-- INCREMENTAR CREDITO (atómico, solo service_role)
-- =============================================

CREATE OR REPLACE FUNCTION public.incrementar_credito_referido(p_tenant_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.subscriptions
  SET creditos_mes_gratis = creditos_mes_gratis + 1
  WHERE tenant_id = p_tenant_id;
$$;

REVOKE ALL ON FUNCTION public.incrementar_credito_referido(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.incrementar_credito_referido(UUID) TO service_role;