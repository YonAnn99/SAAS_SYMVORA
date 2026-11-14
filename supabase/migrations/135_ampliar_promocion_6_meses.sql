-- =============================================
-- 135: Ampliar promocion de lanzamiento a 6 meses
-- ---------------------------------------------
-- Se extiende la promocion mensual de 3 a 6 meses ($199 MXN).
-- Para los suscriptores que ya tengan la promocion activa en curso
-- (promo_cobros_restantes > 0 y promo_plan IS NOT NULL), se les suman 3 cobros
-- adicionales a su contador restante para completar los 6 meses de beneficio.
-- =============================================

UPDATE public.subscriptions
SET promo_cobros_restantes = promo_cobros_restantes + 3,
    updated_at = NOW()
WHERE promo_cobros_restantes > 0
  AND promo_plan IS NOT NULL;
