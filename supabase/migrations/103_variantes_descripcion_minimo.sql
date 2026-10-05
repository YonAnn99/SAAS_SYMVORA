-- ===========================================================================
-- 103 — Descripcion y stock minimo propios en cada variante
-- ===========================================================================
--
-- Hasta ahora una variante no tenia descripcion, y su estado de stock (OK /
-- stock bajo / agotado) usaba el `stock_minimo` del PRODUCTO. Cada variante
-- (talla, color, presentacion) se vende distinto, asi que lleva el suyo.
--
-- Backfill: cada variante existente arranca con el minimo de su producto, para
-- que ninguna cambie de estado al aplicar esto.
--
-- La tabla ya tiene RLS con `authorize()`; columnas nuevas no piden politica.

ALTER TABLE public.variantes_producto
  ADD COLUMN IF NOT EXISTS descripcion TEXT,
  ADD COLUMN IF NOT EXISTS stock_minimo NUMERIC NOT NULL DEFAULT 0
    CHECK (stock_minimo >= 0);

UPDATE public.variantes_producto v
   SET stock_minimo = p.stock_minimo
  FROM public.productos p
 WHERE p.id = v.producto_id
   AND p.stock_minimo IS NOT NULL
   AND p.stock_minimo > 0;
