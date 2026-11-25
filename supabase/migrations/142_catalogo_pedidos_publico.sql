-- ============================================================================
-- 142 — El catálogo público avisa si recibe pedidos; el seguimiento trae el WhatsApp
-- ============================================================================
-- Sigue a la 141. Solo CREATE OR REPLACE de dos funciones (sin tocar tablas):
--   * `_catalogo_encabezado` suma `recibir_pedidos`: verdadero solo si el negocio lo activó Y su plan lo incluye.
--     La página pública decide con ello si pinta el formulario de pedido o el envío por WhatsApp de siempre.
--     Una respuesta sin la clave (pestañas viejas, vista previa anterior) se lee como `false`: compatible.
--   * `pedido_publico` suma `whatsapp` y `slug` del catálogo (ya son públicos en el catálogo) para el botón
--     «Escribir al negocio» de la página de seguimiento. Sigue sin devolver teléfono, dirección ni notas.
-- ============================================================================

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
