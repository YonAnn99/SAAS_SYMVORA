-- 133: moneda del negocio (MXN por defecto, USD o EUR).
--
-- Pedido de un cliente de España. Solo cambia CÓMO SE MUESTRAN los montos: los
-- precios y ventas guardados son números y no se convierten. El IVA sigue en
-- 16 % (la tasa por negocio es una fase aparte).
--
-- Aditiva: columna con default, así que el código anterior (que no la pide)
-- sigue funcionando, y todo negocio existente queda en MXN.
--
-- La escribe la política `tenants_update` que ya existe
-- (`authorize('org.manage_settings')`), la misma que guarda nombre, teléfono y
-- dirección desde Configuración.

ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS moneda text NOT NULL DEFAULT 'MXN';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tenants_moneda_check'
  ) THEN
    ALTER TABLE public.tenants
      ADD CONSTRAINT tenants_moneda_check CHECK (moneda IN ('MXN', 'USD', 'EUR'));
  END IF;
END $$;

COMMENT ON COLUMN public.tenants.moneda IS
  'Moneda en que el negocio ve sus montos (MXN, USD, EUR). Solo formato: no convierte.';

-- El catálogo público y su vista previa pintan los precios con la moneda del
-- negocio. Mismo cuerpo que la 125 más la clave `moneda`.
CREATE OR REPLACE FUNCTION public._catalogo_encabezado(p_tenant uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
$$;
REVOKE ALL ON FUNCTION public._catalogo_encabezado(uuid) FROM PUBLIC, anon, authenticated;
