-- SYMVORA SaaS - Conekta current payment methods
-- OXXO was replaced by Conekta Efectivo (BBVA, 7Eleven, Farmacia del
-- Ahorro, Waldo's y más). Extend the payment_method enum with the
-- methods supported by Conekta API v2.3 so payment_history can store
-- them accurately. 'oxxo' is kept as a legacy value (nothing writes it).
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'cash';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'bank_transfer';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'pay_by_bank';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'spei';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'apple';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'google';
ALTER TYPE public.payment_method ADD VALUE IF NOT EXISTS 'bnpl';