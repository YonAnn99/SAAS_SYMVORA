-- =============================================
-- 049: Actualiza el DEFAULT de payment_history.amount al precio vigente
-- ---------------------------------------------
-- La migracion 006 fijo DEFAULT 400.00 cuando la mensualidad costaba $400 MXN.
-- El precio bajo a $399 MXN (y el anual a $3,588 = $299/mes, 25% de ahorro).
--
-- En la practica este default nunca se usa: todos los INSERT del codigo pasan
-- `amount` explicito (create-checkout y el webhook de Conekta). Se actualiza
-- solo para que el esquema no contradiga al precio real si algun dia alguien
-- inserta una fila a mano desde el SQL Editor.
--
-- No toca filas existentes: cambiar un DEFAULT no reescribe historico, y el
-- historial de pagos debe conservar los montos realmente cobrados.
-- =============================================

ALTER TABLE public.payment_history
  ALTER COLUMN amount SET DEFAULT 399.00;
