-- =============================================================================
-- 110 · Variantes archivadas
--
-- Igual que los productos (migracion 102): una variante con historial (ventas,
-- compras, traspasos) no se puede borrar, porque las llaves foraneas NO ACTION
-- lo impiden a proposito. En su lugar se ARCHIVA: sale del catalogo, del punto
-- de venta y de los selectores, y su historial queda intacto. Se restaura
-- desde la pestaña Archivados de Productos.
--
-- Las politicas de escritura de `variantes_producto` ya exigen `authorize()`
-- con `inventory.manage` (migracion 053): archivar pide el mismo permiso que
-- editar. Una columna nueva no necesita politica propia.
-- =============================================================================

BEGIN;

ALTER TABLE public.variantes_producto
  ADD COLUMN IF NOT EXISTS archivado_en TIMESTAMPTZ;

COMMENT ON COLUMN public.variantes_producto.archivado_en IS
  'Cuando se archivo (NULL = activa). Archivada: fuera del catalogo y del POS; su historial se conserva.';

-- Una variante archivada tampoco genera avisos de stock (mismo cuerpo que la
-- 108, con la condicion nueva).
CREATE OR REPLACE FUNCTION public._notif_trg_stock_variante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_nuevo INT;
  v_producto public.productos%ROWTYPE;
BEGIN
  BEGIN
    IF NEW.archivado_en IS NOT NULL THEN
      RETURN NULL;
    END IF;
    v_nuevo := public._notif_estado_stock(NEW.stock_actual, NEW.stock_minimo);
    IF v_nuevo <= public._notif_estado_stock(OLD.stock_actual, OLD.stock_minimo) THEN
      RETURN NULL;
    END IF;
    SELECT * INTO v_producto FROM public.productos p WHERE p.id = NEW.producto_id;
    IF NOT FOUND OR v_producto.es_servicio OR v_producto.archivado_en IS NOT NULL THEN
      RETURN NULL;
    END IF;
    PERFORM public._notif_stock(
      NEW.tenant_id, NEW.producto_id, NEW.id,
      public._notif_nombre_variante(v_producto.nombre, NEW.atributos, NEW.talla, NEW.color),
      NEW.stock_actual, NEW.stock_minimo,
      COALESCE(NEW.unidad_medida::text, v_producto.unidad_medida::text), v_nuevo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de stock de variante omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

COMMIT;
