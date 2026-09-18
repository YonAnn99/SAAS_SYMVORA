-- =============================================
-- 072: La Bitacora admite la accion REIMPRIMIR
-- ---------------------------------------------
-- Al reimprimir el ticket de una venta ya cobrada hay que dejar rastro: un
-- ticket reimpreso sirve para justificar una devolucion falsa, y sin registro
-- no hay forma de saber quien lo saco ni cuando.
--
-- POR QUE UNA ACCION NUEVA Y NO REUTILIZAR 'CREATE'. El CHECK solo admitia
-- CREATE, UPDATE y DELETE. Registrar la reimpresion como 'CREATE' sobre la
-- entidad `venta` habria hecho que la Bitacora dijera que alguien **creo una
-- venta**: exactamente lo contrario de lo que paso, y en el unico sitio del
-- sistema al que se acude cuando algo huele mal. Un registro que miente es
-- peor que no tener registro.
--
-- La pantalla de Bitacora ya tolera acciones desconocidas (cae a un icono y
-- una etiqueta genericos), asi que esta migracion puede aplicarse antes de
-- desplegar el cliente sin romper nada.
-- =============================================

ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_action_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_action_check
  CHECK (action = ANY (ARRAY['CREATE', 'UPDATE', 'DELETE', 'REIMPRIMIR']));

COMMENT ON CONSTRAINT activity_logs_action_check ON public.activity_logs IS
  'Acciones registrables. REIMPRIMIR se anadio en la 072: reimprimir un ticket no crea ni modifica nada, pero tiene que dejar rastro.';

-- Verificacion (ejecutar a mano tras aplicar):
--   INSERT ... action = 'REIMPRIMIR'  -> permitido
--   INSERT ... action = 'CUALQUIERA'  -> rechazado
