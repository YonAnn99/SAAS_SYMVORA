-- SYMVORA SaaS - Subscription & Billing Migration
-- Conekta integration + Trial codes + Payment tracking

-- =============================================
-- ENUMS
-- =============================================

DO $$ BEGIN
  CREATE TYPE public.subscription_status AS ENUM (
    'trial', 'active', 'past_due', 'canceled', 'expired'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.payment_method AS ENUM (
    'card', 'oxxo', 'manual'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Subscriptions table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conekta_customer_id TEXT,
  conekta_subscription_id TEXT,
  conekta_card_id TEXT,
  status subscription_status NOT NULL DEFAULT 'trial',
  payment_method payment_method NOT NULL DEFAULT 'card',
  trial_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  trial_end TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_payment_at TIMESTAMPTZ,
  next_payment_due TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

-- Trial codes table
CREATE TABLE IF NOT EXISTS public.trial_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  used_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Payment history table
CREATE TABLE IF NOT EXISTS public.payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL DEFAULT 400.00,
  currency TEXT NOT NULL DEFAULT 'MXN',
  payment_method payment_method NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reference TEXT,
  conekta_order_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add subscription_status to tenants
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN subscription_status subscription_status DEFAULT 'trial';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_subscriptions_tenant ON public.subscriptions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_trial_codes_code ON public.trial_codes(code);
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription ON public.payment_history(subscription_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trial_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "Users can view own tenant subscription" ON public.subscriptions;
  DROP POLICY IF EXISTS "ORG_ADMIN can update subscription" ON public.subscriptions;
  DROP POLICY IF EXISTS "Service role can insert subscription" ON public.subscriptions;
  DROP POLICY IF EXISTS "Anyone can read unused trial codes" ON public.trial_codes;
  DROP POLICY IF EXISTS "Service role can manage trial codes" ON public.trial_codes;
  DROP POLICY IF EXISTS "Users can view own tenant payments" ON public.payment_history;
  DROP POLICY IF EXISTS "Service role can insert payment history" ON public.payment_history;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "Users can view own tenant subscription"
  ON public.subscriptions FOR SELECT
  USING (tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = auth.uid()));

CREATE POLICY "ORG_ADMIN can update subscription"
  ON public.subscriptions FOR UPDATE
  USING (tenant_id IN (
    SELECT tm.tenant_id FROM public.tenant_memberships tm 
    WHERE tm.user_id = auth.uid() AND tm.role = 'ORG_ADMIN'
  ));

CREATE POLICY "Service role can insert subscription"
  ON public.subscriptions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can read unused trial codes"
  ON public.trial_codes FOR SELECT
  USING (used_at IS NULL AND expires_at > NOW());

CREATE POLICY "Service role can manage trial codes"
  ON public.trial_codes FOR ALL
  WITH CHECK (true);

CREATE POLICY "Users can view own tenant payments"
  ON public.payment_history FOR SELECT
  USING (subscription_id IN (
    SELECT s.id FROM public.subscriptions s
    JOIN public.tenant_memberships tm ON s.tenant_id = tm.tenant_id
    WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Service role can insert payment history"
  ON public.payment_history FOR INSERT
  WITH CHECK (true);

-- =============================================
-- FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.has_active_subscription(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_status subscription_status;
  v_trial_end TIMESTAMPTZ;
BEGIN
  SELECT status, trial_end INTO v_status, v_trial_end
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id;
  
  IF v_status IS NULL THEN
    RETURN FALSE;
  END IF;
  
  IF v_status = 'active' THEN
    RETURN TRUE;
  END IF;
  
  IF v_status = 'trial' AND v_trial_end > NOW() THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_subscription_info(p_tenant_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'status', s.status,
    'payment_method', s.payment_method,
    'trial_end', s.trial_end,
    'current_period_end', s.current_period_end,
    'has_active', public.has_active_subscription(p_tenant_id)
  ) INTO v_result
  FROM public.subscriptions s
  WHERE s.tenant_id = p_tenant_id;
  
  RETURN COALESCE(v_result, jsonb_build_object(
    'status', 'expired',
    'has_active', false
  ));
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_trial_code(
  p_code TEXT,
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_id UUID;
BEGIN
  SELECT id INTO v_code_id
  FROM public.trial_codes
  WHERE code = UPPER(p_code)
    AND used_at IS NULL
    AND expires_at > NOW();
  
  IF v_code_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Codigo invalido o ya utilizado'
    );
  END IF;
  
  UPDATE public.trial_codes
  SET used_by_user_id = p_user_id,
      tenant_id = p_tenant_id,
      used_at = NOW()
  WHERE id = v_code_id;
  
  INSERT INTO public.subscriptions (
    tenant_id, status, payment_method, trial_start, trial_end
  ) VALUES (
    p_tenant_id, 'trial', 'card', NOW(), NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (tenant_id) DO UPDATE
  SET status = 'trial',
      trial_start = NOW(),
      trial_end = NOW() + INTERVAL '7 days',
      updated_at = NOW();
  
  UPDATE public.tenants
  SET subscription_status = 'trial'
  WHERE id = p_tenant_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'trial_end', (NOW() + INTERVAL '7 days')::TEXT
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscription_info(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_trial_code(TEXT, UUID, UUID) TO authenticated;
