-- Añade el periodo de facturación elegido (mensual/anual) a las suscripciones.
-- El pago anual nunca estaba realmente implementado (ver auditoría de sept 2026):
-- el toggle "Anual" de la landing era solo visual y el checkout siempre cobraba
-- el monto mensual. Esta columna permite que /billing y create-checkout sepan
-- qué monto cobrar y qué fecha de renovación calcular.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_period TEXT NOT NULL DEFAULT 'monthly'
  CHECK (billing_period IN ('monthly', 'yearly'));
