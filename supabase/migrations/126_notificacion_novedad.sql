-- =============================================
-- 126: aviso de novedad en la campana (Catálogo en línea)
-- =============================================
-- Los negocios que ya usan SYMVORA se enteran del módulo nuevo sin depender de
-- las redes. Es una de las cuatro vías de `src/lib/novedades.ts` (la etiqueta
-- del menú, la ventana al entrar y el correo van por código).
--
-- Aditiva:
-- 1. El CHECK de `notificaciones.tipo` suma 'novedad' (lista vigente de la 121).
-- 2. Un aviso por negocio real (sin demos), solo para quien puede abrir el
--    módulo (`permiso = 'catalog.manage'`: SUPER_ADMIN y ORG_ADMIN, o el cajero
--    al que se lo concedieron). Sin actor: la RLS no le pide `activity.view`.
--    Idempotente por `datos->>'novedad'`.
--
-- No toca datos del negocio: solo inserta una fila de lectura. El cron
-- `avisos-stock` la borra a los 30 días, como a cualquier otro aviso.
-- Una pestaña con el código anterior la pinta con el icono por defecto.

ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN (
  'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto',
  'compra', 'orden_compra', 'ajuste', 'traspaso',
  'lote_por_caducar', 'lote_caducado', 'lote', 'insumo_faltante',
  'lealtad_alta', 'novedad'
));

INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
SELECT
  t.id,
  'novedad',
  'Nuevo: Catálogo en línea',
  'Comparte tus productos con un enlace y recibe pedidos por WhatsApp. Ya viene incluido en tu plan.',
  '/online-catalog',
  'catalog.manage',
  jsonb_build_object('novedad', 'catalogo-en-linea')
FROM public.tenants t
WHERE t.demo_expira_en IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = t.id
      AND n.tipo = 'novedad'
      AND n.datos->>'novedad' = 'catalogo-en-linea'
  );
