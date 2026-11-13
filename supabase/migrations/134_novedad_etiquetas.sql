-- =============================================
-- 134: aviso de novedad en la campana (Etiquetas con código de barras)
-- =============================================
-- Como la 126 (Catálogo en línea), pero la novedad es una FUNCIÓN dentro de
-- Productos (el botón «Etiquetas»), no un módulo. Ver `src/lib/novedades.ts`.
--
-- Aditiva:
-- 1. Un aviso por negocio real (sin demos). `permiso` NULL: todo el equipo,
--    porque el catálogo de Productos y su botón Etiquetas están abiertos a
--    todos (generar códigos sí pide `inventory.manage`, dentro de la ventana).
--    Sin actor. Idempotente por `datos->>'novedad'`.
-- 2. Los negocios que se registren mientras dure la novedad (hasta el
--    2026-12-03, CDMX) también lo reciben: trigger AFTER INSERT en `tenants`.
--    Los demos nacen con `demo_expira_en` y se saltan. Atrapa sus errores: un
--    aviso nunca puede tumbar un registro.
--
-- Solo inserta filas de lectura. El cron `avisos-stock` las borra a los 30
-- días, como a cualquier otro aviso. 'novedad' ya está en el CHECK (126).

INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
SELECT
  t.id,
  'novedad',
  'Nuevo: etiquetas con código de barras',
  'Imprime etiquetas con código de barras y precio para tus productos, en hoja carta o en rollo. Búscalo en Productos → Etiquetas.',
  '/products',
  NULL,
  jsonb_build_object('novedad', 'etiquetas-codigos')
FROM public.tenants t
WHERE t.demo_expira_en IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = t.id
      AND n.tipo = 'novedad'
      AND n.datos->>'novedad' = 'etiquetas-codigos'
  );

-- Negocios nuevos: la novedad vigente les llega al crearse. Para una novedad
-- futura, CREATE OR REPLACE de esta función con su texto y su fecha.
CREATE OR REPLACE FUNCTION public._novedades_negocio_nuevo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.demo_expira_en IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF public._hoy_mx() <= DATE '2026-12-03' THEN
    INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
    VALUES (
      NEW.id,
      'novedad',
      'Nuevo: etiquetas con código de barras',
      'Imprime etiquetas con código de barras y precio para tus productos, en hoja carta o en rollo. Búscalo en Productos → Etiquetas.',
      '/products',
      NULL,
      jsonb_build_object('novedad', 'etiquetas-codigos')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[_novedades_negocio_nuevo] %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._novedades_negocio_nuevo() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_tenants_novedades ON public.tenants;
CREATE TRIGGER trg_tenants_novedades
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public._novedades_negocio_nuevo();
