-- =============================================
-- 147: avisos de novedad con imagen (pedidos mejorados y ticket personalizable)
-- =============================================
-- APLICAR DESPUÉS DEL DEPLOY, con OK del dueño: interrumpe a todos los negocios reales
-- (campana). El panel «Novedades» y la ventana salen desde el código (lib/novedades.ts)
-- y funcionan aunque esta migración no esté aplicada.
--
-- Aditiva:
-- 1. Un aviso por negocio real (sin demos) para cada novedad, idempotente por
--    `datos->>'novedad'`:
--    - `pedidos-v2`: solo a quien tiene pedidos en su plan y el permiso `orders.manage`.
--    - `ticket-personalizable`: a quien puede editar Configuración (`org.manage_settings`).
-- 2. `_novedades_negocio_nuevo()` (139) suma estas dos: los negocios que se registren
--    hasta el 2026-12-18 también las reciben. Se conservan las ramas de la 134 y la 139.
--
-- Solo inserta filas de lectura. El cron `avisos-stock` las borra a los 30 días.

INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
SELECT
  t.id,
  'novedad',
  'Pedidos: estados propios, cobro aparte y seguimiento',
  'Crea tus estados con color, guarda pedidos desde el punto de venta y cóbralos después. El cliente ve su avance en línea.',
  '/orders',
  'orders.manage',
  jsonb_build_object('novedad', 'pedidos-v2')
FROM public.tenants t
WHERE t.demo_expira_en IS NULL
  AND public._plan_permite_pedidos(t.id)
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = t.id
      AND n.tipo = 'novedad'
      AND n.datos->>'novedad' = 'pedidos-v2'
  );

INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
SELECT
  t.id,
  'novedad',
  'Tu ticket, a tu medida',
  'Pon tu logo, teléfono, mensaje de agradecimiento y redes, y mira cómo queda antes de imprimir. Está en Configuración → Ticket.',
  '/settings?tab=ticket',
  'org.manage_settings',
  jsonb_build_object('novedad', 'ticket-personalizable')
FROM public.tenants t
WHERE t.demo_expira_en IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = t.id
      AND n.tipo = 'novedad'
      AND n.datos->>'novedad' = 'ticket-personalizable'
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

  -- 147: pedidos mejorados y ticket personalizable.
  IF public._hoy_mx() <= DATE '2026-12-18' THEN
    IF public._plan_permite_pedidos(NEW.id) THEN
      INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
      VALUES (
        NEW.id,
        'novedad',
        'Pedidos: estados propios, cobro aparte y seguimiento',
        'Crea tus estados con color, guarda pedidos desde el punto de venta y cóbralos después. El cliente ve su avance en línea.',
        '/orders',
        'orders.manage',
        jsonb_build_object('novedad', 'pedidos-v2')
      );
    END IF;
    INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, datos)
    VALUES (
      NEW.id,
      'novedad',
      'Tu ticket, a tu medida',
      'Pon tu logo, teléfono, mensaje de agradecimiento y redes, y mira cómo queda antes de imprimir. Está en Configuración → Ticket.',
      '/settings?tab=ticket',
      'org.manage_settings',
      jsonb_build_object('novedad', 'ticket-personalizable')
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[_novedades_negocio_nuevo] %', SQLERRM;
  RETURN NEW;
END;
$$;
