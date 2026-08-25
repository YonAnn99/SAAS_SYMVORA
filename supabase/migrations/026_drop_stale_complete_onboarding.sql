-- Elimina la sobrecarga vieja de complete_onboarding (7 args, pre-referidos, migración 008).
-- Las migraciones 023/024 solo hicieron DROP/recreate de la firma de 8 args
-- (con p_referral_code), dejando ambas sobrecargas en la BD. Al omitir
-- p_referral_code en la llamada RPC, Postgres no puede elegir entre las dos
-- ("Could not choose the best candidate function").
-- La versión vigente es la de 8 args (migración 024) con grants correctos.

DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, jsonb, text);
