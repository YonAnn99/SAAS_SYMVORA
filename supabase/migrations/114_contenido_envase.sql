-- ===========================================================================
-- 114 — Contenido del envase, aparte de la unidad de venta
-- ===========================================================================
--
-- `unidad_medida` dice COMO SE VENDE: con kg/g/l/ml/m el POS lo trata como
-- granel y pregunta "¿Cuanto?". Al capturar productos empaquetados se usaba
-- ese campo para describir lo que trae el envase (Coca Cola 2.5 L -> Litro,
-- Sabritas -> Gramo), y el POS terminaba ofreciendo "1/4 l" de un refresco.
--
-- El contenido (600 ml, 2.5 L, 45 g) va ahora en su propio par de columnas.
-- Es SOLO descriptivo: no cambia el cobro, el stock ni `complete_sale`.
--
-- En la variante, NULL = usa el del producto (igual que `unidad_medida`, 104).
-- La interfaz resuelve con `contenidoDe` (src/lib/unidades.ts).
--
-- Ambas tablas ya tienen RLS con `authorize()` y grants de tabla: columnas
-- nuevas no piden politica ni GRANT.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS contenido_cantidad numeric(12,3),
  ADD COLUMN IF NOT EXISTS contenido_unidad public.unidad_medida;

ALTER TABLE public.variantes_producto
  ADD COLUMN IF NOT EXISTS contenido_cantidad numeric(12,3),
  ADD COLUMN IF NOT EXISTS contenido_unidad public.unidad_medida;

COMMENT ON COLUMN public.productos.contenido_cantidad IS
  'Contenido del envase (2.5 en "2.5 L"). Descriptivo: no cambia como se cobra.';
COMMENT ON COLUMN public.productos.contenido_unidad IS
  'Medida del contenido del envase (LITRO en "2.5 L"). Solo unidades de medida.';
COMMENT ON COLUMN public.variantes_producto.contenido_cantidad IS
  'Contenido del envase de la variante. NULL = el del producto.';
COMMENT ON COLUMN public.variantes_producto.contenido_unidad IS
  'Medida del contenido de la variante. NULL = la del producto.';

-- Las dos van juntas, la cantidad es positiva y la medida es de las que se
-- miden (no "pieza" ni "caja"). Columnas nuevas y vacias: validar es inmediato.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_contenido_check') THEN
    ALTER TABLE public.productos
      ADD CONSTRAINT productos_contenido_check CHECK (
        (contenido_cantidad IS NULL) = (contenido_unidad IS NULL)
        AND (contenido_cantidad IS NULL OR contenido_cantidad > 0)
        AND (contenido_unidad IS NULL
             OR contenido_unidad IN ('KG', 'GRAMO', 'LITRO', 'MILILITRO', 'METRO'))
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'variantes_producto_contenido_check') THEN
    ALTER TABLE public.variantes_producto
      ADD CONSTRAINT variantes_producto_contenido_check CHECK (
        (contenido_cantidad IS NULL) = (contenido_unidad IS NULL)
        AND (contenido_cantidad IS NULL OR contenido_cantidad > 0)
        AND (contenido_unidad IS NULL
             OR contenido_unidad IN ('KG', 'GRAMO', 'LITRO', 'MILILITRO', 'METRO'))
      );
  END IF;
END $$;
