-- ============================================================================
-- 144 — Costo de envío a domicilio de los pedidos del catálogo
-- ============================================================================
-- Sigue a la 141-142. ADITIVA: dos columnas NULL, un trigger y dos CREATE OR REPLACE.
--   * `catalogos_en_linea.costo_envio`: lo fija el admin en Catálogo en línea → Personalizar.
--       NULL = «el negocio confirma el costo»; 0 = envío gratis; n = costo.
--   * `pedidos_catalogo.costo_envio`: COPIA del costo vigente al crear un pedido a domicilio (si el admin lo cambia
--     después, los pedidos hechos conservan el que vio su cliente). Un pedido para recoger lo deja NULL.
--     Se copia con un trigger BEFORE INSERT en vez de reescribir `crear_pedido_publico` (función grande y probada).
--   * `_catalogo_encabezado` y `pedido_publico` lo exponen (la página pública lo pinta). Una respuesta sin la
--     clave (pestañas viejas) se lee como «sin costo definido»: compatible.
-- El envío NO entra a la venta: `confirmar_pedido` y `_crear_venta_desde_items` no se tocan.
-- ============================================================================

ALTER TABLE public.catalogos_en_linea
  ADD COLUMN IF NOT EXISTS costo_envio numeric(12,2);
ALTER TABLE public.pedidos_catalogo
  ADD COLUMN IF NOT EXISTS costo_envio numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogos_costo_envio_check') THEN
    ALTER TABLE public.catalogos_en_linea
      ADD CONSTRAINT catalogos_costo_envio_check CHECK (costo_envio IS NULL OR (costo_envio >= 0 AND costo_envio <= 99999));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_costo_envio_check') THEN
    ALTER TABLE public.pedidos_catalogo
      ADD CONSTRAINT pedidos_costo_envio_check CHECK (costo_envio IS NULL OR (costo_envio >= 0 AND costo_envio <= 99999));
  END IF;
END;
$$;

-- Copia el costo vigente del catálogo al pedido a domicilio (solo al crearlo).
CREATE OR REPLACE FUNCTION public._pedido_copiar_costo_envio()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.entrega = 'domicilio' THEN
    IF NEW.costo_envio IS NULL THEN
      SELECT c.costo_envio INTO NEW.costo_envio
      FROM public.catalogos_en_linea c WHERE c.tenant_id = NEW.tenant_id;
    END IF;
  ELSE
    NEW.costo_envio := NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._pedido_copiar_costo_envio() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_pedido_copiar_costo_envio ON public.pedidos_catalogo;
CREATE TRIGGER trg_pedido_copiar_costo_envio
  BEFORE INSERT ON public.pedidos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public._pedido_copiar_costo_envio();

-- El encabezado público suma `costo_envio` (misma función de la 142 + una clave).
CREATE OR REPLACE FUNCTION public._catalogo_encabezado(p_tenant uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO ''
AS $function$
  WITH prods AS (
    SELECT cp.*
    FROM public.tenants tn
    LEFT JOIN public.catalogos_en_linea c ON c.tenant_id = tn.id
    CROSS JOIN LATERAL public._catalogo_productos(tn.id) cp
    WHERE tn.id = p_tenant
      AND (COALESCE(c.mostrar_agotados, true) OR cp.disponible)
  )
  SELECT jsonb_build_object(
    'slug', c.slug,
    'activo', COALESCE(c.activo, false),
    'negocio', tn.nombre_comercial,
    'logo_url', tn.logo_url,
    'color', COALESCE(c.color, tn.color_primario),
    'portada_url', c.portada_url,
    'direccion', NULLIF(btrim(tn.direccion), ''),
    'whatsapp', c.whatsapp,
    'mensaje', NULLIF(btrim(c.mensaje), ''),
    'mostrar_precios', COALESCE(c.mostrar_precios, true),
    'moneda', tn.moneda,
    'recibir_pedidos', COALESCE(c.recibir_pedidos, false) AND public._plan_permite_pedidos(tn.id),
    'costo_envio', c.costo_envio,
    'total', (SELECT count(*) FROM prods),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nombre', x.categoria, 'total', x.n) ORDER BY x.categoria)
      FROM (SELECT categoria, count(*) AS n FROM prods WHERE categoria IS NOT NULL GROUP BY categoria) x
    ), '[]'::jsonb),
    'destacados', COALESCE(public._catalogo_pagina(tn.id, NULL, NULL, 0, 12, true)->'productos', '[]'::jsonb)
  )
  FROM public.tenants tn
  LEFT JOIN public.catalogos_en_linea c ON c.tenant_id = tn.id
  WHERE tn.id = p_tenant;
$function$;

-- El seguimiento público suma `costo_envio` del PEDIDO (la copia). Sigue sin teléfono, dirección ni notas.
CREATE OR REPLACE FUNCTION public.pedido_publico(p_codigo text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'folio', p.folio,
    'estado', p.estado,
    'entrega', p.entrega,
    'pagado', p.pagado,
    'creado_en', p.creado_en,
    'negocio', t.nombre_comercial,
    'moneda', t.moneda,
    'color', c.color,
    'slug', c.slug,
    'whatsapp', c.whatsapp,
    'costo_envio', p.costo_envio,
    'total', CASE WHEN coalesce(c.mostrar_precios, true) THEN p.total END,
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'nombre', i.nombre, 'variante', i.variante, 'unidad', i.unidad, 'cantidad', i.cantidad,
        'precio', CASE WHEN coalesce(c.mostrar_precios, true) THEN i.precio_unitario END
      ) ORDER BY i.nombre)
      FROM public.pedido_items i WHERE i.pedido_id = p.id
    ), '[]'::jsonb)
  )
  FROM public.pedidos_catalogo p
  JOIN public.tenants t ON t.id = p.tenant_id
  LEFT JOIN public.catalogos_en_linea c ON c.tenant_id = p.tenant_id
  WHERE p.codigo_seguimiento = upper(btrim(coalesce(p_codigo, '')))
    AND p_codigo ~* '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$';
$$;
