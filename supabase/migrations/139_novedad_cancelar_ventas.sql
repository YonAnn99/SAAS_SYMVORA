-- =============================================
-- 139: aviso de novedad en la campana (Cancelar y corregir ventas)
-- =============================================
-- Anuncia la 137 como la 134 anunció las etiquetas. APLICAR DESPUÉS DEL
-- DEPLOY: el aviso lleva a Reportes → historial, donde están los botones.
--
-- Aditiva:
-- 1. Un aviso por negocio real (sin demos), solo para quien puede usarlo
--    (`permiso = 'sales.void'`: dueño y administrador, o a quien se le
--    concedió). Sin actor. Idempotente por `datos->>'novedad'`.
-- 2. `_novedades_negocio_nuevo()` (134) suma esta novedad: los negocios que se
--    registren hasta el 2026-12-17 también la reciben. La de etiquetas sigue
--    hasta el 2026-12-03, como estaba.
--
-- Solo inserta filas de lectura. El cron `avisos-stock` las borra a los 30 días.

INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
SELECT
  t.id,
  'novedad',
  'Nuevo: cancela y corrige ventas',
  'En Reportes → historial de ventas, abre una venta y elige Cancelar o Corregir. El inventario regresa y queda registro de quién, cuándo y por qué.',
  '/reports',
  'sales.void',
  jsonb_build_object('novedad', 'cancelar-ventas')
FROM public.tenants t
WHERE t.demo_expira_en IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = t.id
      AND n.tipo = 'novedad'
      AND n.datos->>'novedad' = 'cancelar-ventas'
  );

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

  -- 134: etiquetas con código de barras.
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

  -- 139: cancelar y corregir ventas.
  IF public._hoy_mx() <= DATE '2026-12-17' THEN
    INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
    VALUES (
      NEW.id,
      'novedad',
      'Nuevo: cancela y corrige ventas',
      'En Reportes → historial de ventas, abre una venta y elige Cancelar o Corregir. El inventario regresa y queda registro de quién, cuándo y por qué.',
      '/reports',
      'sales.void',
      jsonb_build_object('novedad', 'cancelar-ventas')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[_novedades_negocio_nuevo] %', SQLERRM;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._novedades_negocio_nuevo() FROM PUBLIC, anon, authenticated;
