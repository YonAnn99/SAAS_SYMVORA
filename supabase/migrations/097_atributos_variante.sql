-- 097: atributos libres en las variantes (Color, Sabor, Voltaje, Material...).
--
-- Antes una variante solo podia ser "talla" y/o "color" (columnas fijas). Ahora
-- guarda sus atributos como arreglo ORDENADO:
--   [{"tipo": "Sabor", "valor": "Fresa"}, {"tipo": "Color", "valor": "Rojo"}]
-- (arreglo y no objeto: jsonb reordena las llaves y el orden importa para
-- mostrar "Fresa · Rojo" siempre igual).
--
-- `talla` y `color` SE SIGUEN LLENANDO como resumen compatible —`color` con el
-- atributo Color y `talla` con los demas valores unidos por " · "— asi el POS,
-- el ticket, el historial, compras, traspasos, listas de precios y las
-- funciones que ya leen esas columnas muestran la variante correcta sin
-- cambios, y el UNIQUE(tenant_id, producto_id, talla, color) sigue evitando
-- duplicados. Lo calcula la aplicacion (`resumenCompatible`).

ALTER TABLE public.variantes_producto
  ADD COLUMN IF NOT EXISTS atributos jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Las existentes: lo que ya tenian, como atributos Talla y Color.
UPDATE public.variantes_producto
SET atributos = (
  SELECT COALESCE(jsonb_agg(par ORDER BY orden), '[]'::jsonb)
  FROM (
    SELECT 1 AS orden, jsonb_build_object('tipo', 'Talla', 'valor', talla) AS par
    WHERE talla IS NOT NULL AND btrim(talla) <> ''
    UNION ALL
    SELECT 2, jsonb_build_object('tipo', 'Color', 'valor', color)
    WHERE color IS NOT NULL AND btrim(color) <> ''
  ) s
)
WHERE atributos = '[]'::jsonb
  AND (COALESCE(btrim(talla), '') <> '' OR COALESCE(btrim(color), '') <> '');

COMMENT ON COLUMN public.variantes_producto.atributos IS
  'Atributos de la variante en orden: [{tipo, valor}]. talla/color son su resumen compatible.';
