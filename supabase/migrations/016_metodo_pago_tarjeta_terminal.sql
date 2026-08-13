-- =============================================
-- 016: nuevo metodo de pago TARJETA_TERMINAL
-- ---------------------------------------------
-- Cobro con terminal fisica (Mercado Pago Point).
-- Se separa de TARJETA para poder distinguir en reportes
-- y en la caja si el cobro fue manual o por terminal.
--
-- Se declara en su propia migracion porque ALTER TYPE ... ADD VALUE
-- no puede usarse dentro de la misma transaccion en que se crean
-- funciones que lo referencian.
-- =============================================

ALTER TYPE public.metodo_pago ADD VALUE IF NOT EXISTS 'TARJETA_TERMINAL';