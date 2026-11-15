-- =============================================
-- 136: Código promocional de campaña Meta Ads 'SYMVORA99'
-- ---------------------------------------------
-- Pago único de $99 MXN válido hasta el 20 de noviembre de 2026.
-- Otorga acceso activo completo por un año (hasta el 20 de noviembre de 2027).
-- A partir del 21 de noviembre de 2027 se requiere la mensualidad regular ($399 MXN).
-- =============================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS promo_codigo_campana TEXT;

COMMENT ON COLUMN public.subscriptions.promo_codigo_campana IS
  'Código de campaña publicitaria aplicado (ej. SYMVORA99). Desbloquea pago único de $99 MXN con vigencia por un año.';

-- Actualizar validar_codigo_promo para soportar códigos de campaña
CREATE OR REPLACE FUNCTION public.validar_codigo_promo(p_codigo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code_clean TEXT;
  v_code public.codigos_promocionales%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('valido', FALSE, 'razon', 'no_autenticado');
  END IF;

  v_code_clean := UPPER(btrim(p_codigo));

  -- Código especial de campaña Meta Ads SYMVORA99
  IF v_code_clean = 'SYMVORA99' THEN
    IF NOW() > '2026-11-20 23:59:59-06'::timestamptz THEN
      RETURN jsonb_build_object('valido', FALSE, 'razon', 'expirado');
    END IF;
    RETURN jsonb_build_object(
      'valido', TRUE,
      'tipo', 'pago_unico_campana',
      'codigo', 'SYMVORA99',
      'precio_mxn', 99,
      'valido_hasta_ano', '2027-11-20T23:59:59-06:00'
    );
  END IF;

  -- Búsqueda estándar en codigos_promocionales (códigos de días de trial)
  SELECT * INTO v_code
  FROM public.codigos_promocionales
  WHERE codigo = v_code_clean;

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

  RETURN jsonb_build_object(
    'valido', TRUE,
    'tipo', 'trial',
    'trial_days', v_code.trial_days
  );
END;
$$;

-- Actualizar aplicar_codigo_promo para soportar códigos de campaña
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
  v_code_clean TEXT;
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

  v_code_clean := UPPER(btrim(p_codigo));

  -- Solo aplica a suscripciones en trial o sin pagos previos; nunca a cuentas activas pagadas
  SELECT * INTO v_sub
  FROM public.subscriptions
  WHERE tenant_id = p_tenant_id;

  IF FOUND AND v_sub.status NOT IN ('trial', 'expired', 'canceled') AND v_sub.last_payment_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'suscripcion_activa');
  END IF;

  -- Manejo especial de campaña Meta Ads SYMVORA99
  IF v_code_clean = 'SYMVORA99' THEN
    IF NOW() > '2026-11-20 23:59:59-06'::timestamptz THEN
      RETURN jsonb_build_object('ok', FALSE, 'razon', 'expirado');
    END IF;

    UPDATE public.subscriptions
    SET promo_codigo_campana = 'SYMVORA99',
        updated_at = NOW()
    WHERE tenant_id = p_tenant_id;

    IF NOT FOUND THEN
      INSERT INTO public.subscriptions (
        tenant_id, status, promo_codigo_campana
      ) VALUES (
        p_tenant_id, 'trial', 'SYMVORA99'
      );
    END IF;

    RETURN jsonb_build_object(
      'ok', TRUE,
      'tipo', 'pago_unico_campana',
      'codigo', 'SYMVORA99',
      'precio_mxn', 99,
      'valido_hasta_ano', '2027-11-20T23:59:59-06:00'
    );
  END IF;

  -- Búsqueda y consumo estándar en codigos_promocionales
  SELECT * INTO v_code
  FROM public.codigos_promocionales
  WHERE codigo = v_code_clean
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', FALSE, 'razon', 'no_existe');
  END IF;

  -- Idempotencia: el mismo tenant que ya lo usó no debe romper el flujo
  IF v_code.usado_por_tenant_id = p_tenant_id THEN
    RETURN jsonb_build_object('ok', TRUE, 'idempotente', TRUE, 'tipo', 'trial', 'trial_days', v_code.trial_days);
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

  -- Edge case: suscripción inexistente
  IF NOT FOUND THEN
    INSERT INTO public.subscriptions (
      tenant_id, status, trial_start, trial_end
    ) VALUES (
      p_tenant_id, 'trial', NOW(), NOW() + make_interval(days => v_code.trial_days)
    );
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'tipo', 'trial', 'trial_days', v_code.trial_days);
END;
$$;
