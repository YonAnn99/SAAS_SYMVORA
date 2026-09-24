-- 090: mas unidades de medida.
--
-- Hasta aqui solo existian PIEZA, KG, GRAMO, LITRO y SERVICIO. Las paginas de
-- giro prometian "cable por metro" y no habia metro. Se agregan:
--   METRO, MILILITRO  -> de medida: se venden con decimales (0.750 kg, 3.5 m)
--   CAJA, PAQUETE, PAR, DOCENA -> de conteo: enteras, como PIEZA
--
-- Solo se AÑADEN valores; ningun dato cambia. Las cantidades ya eran
-- numeric(…,3) en ventas, existencias y compras, asi que los decimales caben
-- sin tocar tablas. Ninguna funcion hace CASE sobre la unidad (verificado):
-- `detalle_venta` solo usa 'PIEZA' como valor por defecto.
--
-- La lista, cuales admiten decimales y como se muestran viven en
-- `src/lib/unidades.ts`, que es la fuente unica del lado de la app.

ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'METRO';
ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'MILILITRO';
ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'CAJA';
ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'PAQUETE';
ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'PAR';
ALTER TYPE public.unidad_medida ADD VALUE IF NOT EXISTS 'DOCENA';
