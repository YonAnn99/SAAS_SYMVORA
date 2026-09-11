-- =============================================
-- 056: Venta por variante (talla/color)
-- ---------------------------------------------
-- Hasta ahora el POS ignoraba las variantes por completo: `detalle_ventas` no
-- tenia `variante_id` y `CartItem` no llevaba variante. Consecuencia: vender un
-- producto con variantes descontaba el stock del PRODUCTO y cobraba el precio
-- del PRODUCTO, dejando el stock por talla/color congelado para siempre.
--
-- MODELO DE STOCK (decision del usuario, 2026-09-11):
--   - Cada variante tiene su propio anaquel: vender M/ROJO baja M/ROJO.
--   - El stock del producto pasa a ser el "sin clasificar": de ahi salen las
--     ventas generales (el usuario pidio permitir ambas).
--   - NO se descuentan los dos. Serian dos cifras que mantener cuadradas a
--     mano y ya estaban descuadradas (sueter: 50 producto vs 5 variante).
--
-- La FIRMA de la funcion NO cambia: la variante viaja dentro del JSON de
-- items, asi que va con CREATE OR REPLACE y no aplican los bugs #18 ni #23.
--
-- PRECIO: la variante tiene el suyo; 0 significa "usa el del producto", para
-- no tener que repetirlo en cada talla cuando todas valen igual. Igual con el
-- costo (alimenta el calculo de ganancia de la migracion 052).
--
-- SEGURIDAD: se valida que la variante pertenezca al producto Y al tenant. Sin
-- eso, un cliente manipulado podria mandar el id de una variante ajena y
-- vender a su precio.
--
-- NOTA: aplicada a produccion como 056a/056b. El cuerpo completo de
-- _crear_venta_desde_items esta en la version viva:
--   SELECT pg_get_functiondef(oid) FROM pg_proc
--    WHERE proname = '_crear_venta_desde_items';
-- =============================================

BEGIN;

ALTER TABLE public.detalle_ventas
  ADD COLUMN IF NOT EXISTS variante_id UUID REFERENCES public.variantes_producto(id);

COMMENT ON COLUMN public.detalle_ventas.variante_id IS
  'Variante vendida (talla/color). NULL = se vendio el producto "general", sin clasificar por variante.';

CREATE INDEX IF NOT EXISTS idx_detalle_ventas_variante
  ON public.detalle_ventas (variante_id)
  WHERE variante_id IS NOT NULL;

COMMIT;
