-- =============================================
-- 073: Promocion de lanzamiento (-50% los primeros 3 cobros)
-- ---------------------------------------------
-- La mensualidad promocional cuesta $199 durante tres cobros y despues vuelve
-- a $399. Conekta NO sabe expresar eso: un plan tiene un unico `amount` y es
-- inmutable (ver el historial de versiones en conekta/config.ts). La promocion
-- se implementa con un plan aparte a 19900 y un cambio de plan en caliente
-- cuando se agota el contador, y ESE CONTADOR VIVE AQUI.
--
-- POR QUE EN LA BASE Y NO EN CODIGO. `PROMO_LANZAMIENTO.activa` decide a quien
-- se le OFRECE la promocion; cuantos cobros le quedan a cada suscripcion es
-- otro dato y es por fila. Si dependiera de la constante, apagar la oferta le
-- subiria el recibo de $199 a $399 de golpe a todo el que fuera por su mes 2:
-- incumplir lo prometido a cambio de nada.
--
-- POR QUE `promo_plan` ES TEXTO Y NO UN BOOLEANO. Guarda el plan de Conekta con
-- el que se contrato de verdad. Es lo que permite saber si hay que pedir el
-- cambio de plan (y a cual), y auditar el dia que exista una promo -v2 sin
-- confundir a quien entro con la primera.
-- =============================================

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS promo_cobros_restantes INT NOT NULL DEFAULT 0
    CHECK (promo_cobros_restantes >= 0),
  ADD COLUMN IF NOT EXISTS promo_plan TEXT;

COMMENT ON COLUMN public.subscriptions.promo_cobros_restantes IS
  'Cobros que quedan al precio promocional. Al llegar a 0 la suscripcion se pasa al plan normal de Conekta. El CHECK >= 0 evita que un reenvio del webhook lo deje en negativo.';

COMMENT ON COLUMN public.subscriptions.promo_plan IS
  'plan_id de Conekta con el que se contrato la promocion (ej. symvora-basic-monthly-promo50-v1). NULL cuando la suscripcion esta en el plan normal.';

-- Solo puede haber cobros promocionales pendientes si hay un plan promocional
-- detras: un contador suelto sin plan significaria cobrar $199 contra un plan
-- de Conekta de $399, o al reves, y el desajuste no se veria hasta el recibo.
ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_promo_coherente_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_promo_coherente_check
  CHECK (promo_cobros_restantes = 0 OR promo_plan IS NOT NULL);

-- Verificacion (ejecutar a mano tras aplicar):
--   UPDATE subscriptions SET promo_cobros_restantes = -1 ...  -> rechazado
--   UPDATE subscriptions SET promo_cobros_restantes = 3 ...   -> rechazado sin promo_plan
