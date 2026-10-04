-- ===========================================================================
-- 102 — Productos archivados
-- ===========================================================================
--
-- Un producto con historial (ventas, compras, ajustes, ordenes, traspasos) no
-- se puede borrar: las llaves foraneas NO ACTION lo impiden a proposito, para
-- no romper reportes ni cortes. En vez de un error, el sistema ofrece
-- ARCHIVARLO: deja de aparecer en el catalogo, el punto de venta y los
-- selectores, y su historial queda intacto. Se puede restaurar.
--
-- Las politicas RLS de escritura de `productos` ya exigen `authorize()` con
-- `inventory.manage`: archivar pide el mismo permiso que editar. Una columna
-- nueva no necesita politica propia.

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS archivado_en TIMESTAMPTZ;

COMMENT ON COLUMN public.productos.archivado_en IS
  'Cuando se archivo (NULL = activo). Archivado: fuera del catalogo y del POS; su historial se conserva.';

-- Un producto archivado no reserva su codigo de barras ni su SKU: el negocio
-- puede dar de alta otro con el mismo codigo. Al restaurar, si el codigo ya lo
-- usa otro activo, el indice lo rechaza y la interfaz lo explica.
DROP INDEX IF EXISTS public.uq_productos_tenant_codigo_barras;
CREATE UNIQUE INDEX uq_productos_tenant_codigo_barras
  ON public.productos (tenant_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '' AND archivado_en IS NULL;

DROP INDEX IF EXISTS public.uq_productos_tenant_sku;
CREATE UNIQUE INDEX uq_productos_tenant_sku
  ON public.productos (tenant_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '' AND archivado_en IS NULL;
