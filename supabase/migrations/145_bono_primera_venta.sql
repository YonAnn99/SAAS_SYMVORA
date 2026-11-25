-- ============================================================================
-- 145 — +7 días de prueba al cobrar la PRIMERA venta
-- ============================================================================
-- Incentivo de activación (2026-11-25): de 13 pruebas vigentes, 12 no habían cargado productos ni vendido. La acción
-- clave es la primera venta, así que se premia con 7 días más de prueba, una sola vez por cuenta.
--
-- ADITIVA:
--   * `subscriptions.trial_bono_en` (NULL): marca de «ya se concedió». Garantiza una sola vez.
--   * `_conceder_bono_primera_venta(tenant)`: si la cuenta es real (no demo), sigue en `trial` vigente y no tiene el
--     bono, suma 7 días a `trial_end`, limpia las marcas de aviso de fin de prueba (para que el aviso salga cerca del
--     NUEVO vencimiento) y deja un aviso en la campana (tipo `novedad`, ya permitido por el CHECK).
--   * Disparador `AFTER INSERT` en `ventas`: solo si es la PRIMERA venta del negocio y `total > 0`. Va dentro de
--     `EXCEPTION WHEN OTHERS`: un bono NUNCA puede tumbar una venta (regla de las notificaciones, CLAUDE.md).
-- No toca el cobro ni Conekta: `acceso_tenant()` lee `trial_end` en vivo. Quien ya vendió antes no recibe nada.
-- ============================================================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_bono_en timestamptz;

CREATE OR REPLACE FUNCTION public._conceder_bono_primera_venta(p_tenant uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = p_tenant AND t.demo_expira_en IS NOT NULL) THEN
    RETURN false;
  END IF;

  UPDATE public.subscriptions s
  SET trial_end = s.trial_end + interval '7 days',
      trial_bono_en = now(),
      trial_aviso_previo_en = NULL,
      trial_aviso_fin_en = NULL,
      updated_at = now()
  WHERE s.tenant_id = p_tenant
    AND s.status = 'trial'
    AND s.last_payment_at IS NULL
    AND s.trial_bono_en IS NULL
    AND s.trial_end >= now();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n = 0 THEN
    RETURN false;
  END IF;

  -- Un aviso nunca puede tumbar la venta (ni quitar el bono ya concedido).
  BEGIN
    INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
    VALUES (
      p_tenant,
      'novedad',
      '🎉 ¡Primera venta! Te regalamos 7 días más de prueba',
      'Cobraste tu primera venta en SYMVORA. Sigue vendiendo con todo incluido.',
      '/billing',
      NULL,
      jsonb_build_object('novedad', 'bono-primera-venta')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '_conceder_bono_primera_venta: aviso no creado: %', SQLERRM;
  END;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public._conceder_bono_primera_venta(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._trg_bono_primera_venta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.total > 0
     AND (SELECT count(*) FROM public.ventas v WHERE v.tenant_id = NEW.tenant_id) = 1 THEN
    PERFORM public._conceder_bono_primera_venta(NEW.tenant_id);
  END IF;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '_trg_bono_primera_venta: %', SQLERRM;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public._trg_bono_primera_venta() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_bono_primera_venta ON public.ventas;
CREATE TRIGGER trg_bono_primera_venta
  AFTER INSERT ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public._trg_bono_primera_venta();
