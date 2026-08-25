-- 027: Códigos promocionales de un solo uso (otorgan días de trial sin pasar
-- por Conekta). Un código válido extiende trial_end de la suscripción y se
-- marca como consumido (uso global único).

CREATE TABLE IF NOT EXISTS public.codigos_promocionales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  trial_days INT NOT NULL DEFAULT 7 CHECK (trial_days BETWEEN 1 AND 90),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  expira_en TIMESTAMPTZ,
  usado_por_tenant_id UUID REFERENCES public.tenants(id) ON DELETE SET NULL,
  usado_en TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Los códigos son datos sensibles de negocio: nadie los lee vía PostgREST.
-- El acceso solo ocurre dentro de las SECURITY DEFINER functions de abajo
-- o con service role (APIs propias).
ALTER TABLE public.codigos_promocionales ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- validar_codigo_promo: feedback en vivo sin consumir el código
-- ============================================================
CREATE OR REPLACE FUNCTION public.validar_codigo_promo(p_codigo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.codigos_promocionales%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'no_autenticado');
  END IF;

  SELECT * INTO v_code
  FROM public.codigos_promocionales
  WHERE codigo = UPPER(btrim(p_codigo));

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'no_existe');
  END IF;
  IF NOT v_code.activo THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'inactivo');
  END IF;
  IF v_code.expira_en IS NOT NULL AND v_code.expira_en < NOW() THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'expirado');
  END IF;
  IF v_code.usado_por_tenant_id IS NOT NULL THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'usado');
  END IF;

  RETURN jsonb_build_object('valido', TRUE, 'trial_days', v_code.trial_days);
END;
$$;

-- ============================================================
-- aplicar_codigo_promo: consume el código y extiende el trial
-- atómicamente (FOR UPDATE evita doble consumo por carrera)
-- ============================================================
CREATE OR REPLACE FUNCTION public.aplicar_codigo_promo(
  p_codigo TEXT,
  p_tenant_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code public.codigos_promocionales%ROWTYPE;
  v_is_member INT;
  v_sub public.subscriptions%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'no_autenticado');
  END IF;

  -- Anti-fraude: solo un miembro del tenant puede aplicarle un código
  SELECT 1 INTO v_is_member
  FROM public.tenant_memberships
  WHERE tenant_id = p_tenant_id AND user_id = auth.uid()
  LIMIT 1;

  IF v_is_member IS NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'no_autorizado');
  END IF;

  SELECT * INTO v_code
  FROM public.codigos_promocionales
  WHERE codigo = UPPER(btrim(p_codigo))
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'no_existe');
  END IF;

  -- Idempotencia: el mismo tenant que ya lo usó no debe romper el flujo
  IF v_code.usado_por_tenant_id = p_tenant_id THEN
    RETURN jsonb_build_object('ok', TRUE, 'idempotente', TRUE, 'trial_days', v_code.trial_days);
  END IF;

  IF NOT v_code.activo THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'inactivo');
  END IF;
  IF v_code.expira_en IS NOT NULL AND v_code.expira_en < NOW() THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'expirado');
  END IF;
  IF v_code.usado_por_tenant_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'usado');
  END IF;

  -- Solo aplica a suscripciones en trial (o sin suscripción aún); nunca a
  -- cuentas que ya pagan — evita que un cliente activo "regrese" a trial.
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id;

  IF FOUND AND v_sub.status NOT IN ('trial', 'expired', 'canceled') THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'suscripcion_activa');
  END IF;

  -- Consumir el código (uso global único)
  UPDATE public.codigos_promocionales
  SET usado_por_tenant_id = p_tenant_id,
      usado_en = NOW()
  WHERE id = v_code.id;

  IF FOUND THEN
    UPDATE public.subscriptions
    SET trial_end = GREATEST(trial_end, NOW()) + make_interval(days => v_code.trial_days),
        status = 'trial',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;
  END IF;

  -- Edge case: suscripción inexistente (signup interrumpido) — crearla
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      tenant_id, status, trial_start, trial_end
    ) VALUES (
      p_tenant_id, 'trial', NOW(), NOW() + make_interval(days => v_code.trial_days)
    );
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'trial_days', v_code.trial_days);
END;
$$;

REVOKE ALL ON FUNCTION public.validar_codigo_promo(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validar_codigo_promo(TEXT) TO authenticated;

REVOKE ALL ON FUNCTION public.aplicar_codigo_promo(TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aplicar_codigo_promo(TEXT, UUID) TO authenticated;
