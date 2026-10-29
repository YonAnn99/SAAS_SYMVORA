-- ===========================================================================
-- 124 — Catálogo en línea
-- ===========================================================================
--
-- Cada negocio puede publicar sus productos en una página pública:
-- www.symvora.com.mx/es/catalogo/<slug>. El cliente final arma una lista y la
-- manda al WhatsApp del negocio: NO hay pago en línea, ni pedido guardado, ni
-- movimiento de inventario. Por eso no existe ninguna escritura anónima.
--
-- Todo es aditivo:
--   - catalogos_en_linea: la configuración (uno por negocio). Se escribe desde
--     Configuración con RLS `authorize('org.manage_settings')`.
--   - productos.oculto_en_catalogo: para sacar un producto del catálogo. Default
--     false: el cliente viejo no la manda y todo producto activo se publica.
--
-- Las dos funciones `catalogo_publico*` son las ÚNICAS de esta migración que
-- puede llamar `anon`. Solo devuelven lo que se pinta en la página: nada de
-- costos, códigos internos, existencias exactas, ventas ni clientes. Un
-- catálogo apagado, de un negocio demo o en solo lectura no existe (NULL).

-- ---------------------------------------------------------------------------
-- 1. Tabla
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogos_en_linea (
  tenant_id         uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  activo            boolean NOT NULL DEFAULT false,
  slug              text NOT NULL,
  whatsapp          text,
  mostrar_precios   boolean NOT NULL DEFAULT true,
  mostrar_agotados  boolean NOT NULL DEFAULT true,
  mensaje           text,
  creado_en         timestamptz NOT NULL DEFAULT now(),
  actualizado_en    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogos_en_linea_slug_check
    CHECK (length(slug) BETWEEN 3 AND 40 AND slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT catalogos_en_linea_whatsapp_check
    CHECK (whatsapp IS NULL OR whatsapp ~ '^\+[1-9][0-9]{7,14}$'),
  -- Sin WhatsApp no hay a dónde mandar el pedido: no se puede activar.
  CONSTRAINT catalogos_en_linea_activo_check
    CHECK (NOT activo OR whatsapp IS NOT NULL),
  CONSTRAINT catalogos_en_linea_mensaje_check
    CHECK (mensaje IS NULL OR length(mensaje) <= 200)
);

COMMENT ON TABLE public.catalogos_en_linea IS
  'Catálogo público del negocio (/catalogo/<slug>). Pedido por WhatsApp; sin escrituras anónimas (migración 124).';

CREATE UNIQUE INDEX IF NOT EXISTS catalogos_en_linea_slug_key ON public.catalogos_en_linea (slug);

ALTER TABLE public.productos
  ADD COLUMN IF NOT EXISTS oculto_en_catalogo boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.productos.oculto_en_catalogo IS
  'true = no sale en el catálogo en línea (migración 124). Solo visual: no toca venta ni stock.';

-- actualizado_en
CREATE OR REPLACE FUNCTION public._catalogos_en_linea_actualizado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._catalogos_en_linea_actualizado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_catalogos_en_linea_actualizado ON public.catalogos_en_linea;
CREATE TRIGGER trg_catalogos_en_linea_actualizado
  BEFORE UPDATE ON public.catalogos_en_linea
  FOR EACH ROW EXECUTE FUNCTION public._catalogos_en_linea_actualizado();

-- Cuenta en solo lectura (096): tampoco cambia su catálogo.
DROP TRIGGER IF EXISTS trg_solo_lectura ON public.catalogos_en_linea;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.catalogos_en_linea
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

-- ---------------------------------------------------------------------------
-- 2. RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogos_en_linea ENABLE ROW LEVEL SECURITY;

-- anon no toca la tabla: la página pública va por `catalogo_publico*`.
REVOKE ALL ON public.catalogos_en_linea FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.catalogos_en_linea TO authenticated;

DROP POLICY IF EXISTS catalogos_en_linea_select ON public.catalogos_en_linea;
CREATE POLICY catalogos_en_linea_select ON public.catalogos_en_linea
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

DROP POLICY IF EXISTS catalogos_en_linea_insert ON public.catalogos_en_linea;
CREATE POLICY catalogos_en_linea_insert ON public.catalogos_en_linea
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('org.manage_settings')));

DROP POLICY IF EXISTS catalogos_en_linea_update ON public.catalogos_en_linea;
CREATE POLICY catalogos_en_linea_update ON public.catalogos_en_linea
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('org.manage_settings')))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('org.manage_settings')));

-- ---------------------------------------------------------------------------
-- 3. Funciones públicas
-- ---------------------------------------------------------------------------

-- Búsqueda sin acentos ni mayúsculas (no hay extensión unaccent).
CREATE OR REPLACE FUNCTION public._catalogo_normalizar(p_texto text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT translate(lower(coalesce(p_texto, '')), 'áéíóúüñàèìòù', 'aeiouunaeiou');
$$;
REVOKE ALL ON FUNCTION public._catalogo_normalizar(text) FROM PUBLIC, anon, authenticated;

-- El negocio dueño de un catálogo publicable (activo, real y con acceso), o NULL.
CREATE OR REPLACE FUNCTION public._catalogo_tenant(p_slug text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.tenant_id
  FROM public.catalogos_en_linea c
  JOIN public.tenants tn ON tn.id = c.tenant_id
  WHERE c.slug = lower(btrim(p_slug))
    AND c.activo
    AND tn.demo_expira_en IS NULL
    AND public.acceso_tenant(tn.id) <> 'solo_lectura';
$$;
REVOKE ALL ON FUNCTION public._catalogo_tenant(text) FROM PUBLIC, anon, authenticated;

-- Productos publicables de un negocio, ya resueltos (precio, disponibilidad y
-- variantes). Interna: la usan las dos funciones públicas.
CREATE OR REPLACE FUNCTION public._catalogo_productos(p_tenant uuid)
RETURNS TABLE (
  id uuid,
  nombre text,
  descripcion text,
  categoria text,
  imagen_url text,
  unidad_medida text,
  contenido_cantidad numeric,
  contenido_unidad text,
  es_servicio boolean,
  precio_min numeric,
  precio_max numeric,
  disponible boolean,
  variantes jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH vars AS (
    SELECT
      v.producto_id,
      jsonb_agg(
        jsonb_build_object(
          'id', v.id,
          'etiqueta', COALESCE(
            NULLIF((SELECT string_agg(btrim(a->>'valor'), ' · ')
                    FROM jsonb_array_elements(
                      CASE WHEN jsonb_typeof(v.atributos) = 'array' THEN v.atributos ELSE '[]'::jsonb END
                    ) a
                    WHERE btrim(coalesce(a->>'valor', '')) <> ''), ''),
            NULLIF(concat_ws(' · ', NULLIF(btrim(v.talla), ''), NULLIF(btrim(v.color), '')), ''),
            'Variante'
          ),
          'precio', COALESCE(NULLIF(v.precio_venta, 0), p.precio_venta),
          'imagen_url', v.imagen_url,
          'unidad_medida', COALESCE(v.unidad_medida, p.unidad_medida)::text,
          'disponible', p.es_servicio OR v.stock_actual > 0
        )
        ORDER BY (p.es_servicio OR v.stock_actual > 0) DESC, v.creado_en
      ) AS lista,
      min(COALESCE(NULLIF(v.precio_venta, 0), p.precio_venta)) AS pmin,
      max(COALESCE(NULLIF(v.precio_venta, 0), p.precio_venta)) AS pmax,
      bool_or(p.es_servicio OR v.stock_actual > 0) AS alguna
    FROM public.variantes_producto v
    JOIN public.productos p ON p.id = v.producto_id
    WHERE v.tenant_id = p_tenant
      AND v.archivado_en IS NULL
      AND p.archivado_en IS NULL
    GROUP BY v.producto_id
  )
  SELECT
    p.id,
    p.nombre,
    NULLIF(btrim(p.descripcion), ''),
    NULLIF(btrim(p.categoria), ''),
    p.imagen_url,
    p.unidad_medida::text,
    p.contenido_cantidad,
    p.contenido_unidad::text,
    p.es_servicio,
    COALESCE(vars.pmin, p.precio_venta),
    COALESCE(vars.pmax, p.precio_venta),
    CASE WHEN vars.producto_id IS NOT NULL THEN vars.alguna
         ELSE p.es_servicio OR p.stock_actual > 0 END,
    COALESCE(vars.lista, '[]'::jsonb)
  FROM public.productos p
  LEFT JOIN vars ON vars.producto_id = p.id
  WHERE p.tenant_id = p_tenant
    AND p.archivado_en IS NULL
    AND NOT p.oculto_en_catalogo
    -- Un producto con variantes sin ninguna activa se vendería como general a
    -- $0: no se publica (misma regla que el POS).
    AND (NOT p.permite_variantes OR vars.producto_id IS NOT NULL OR p.precio_venta > 0);
$$;
REVOKE ALL ON FUNCTION public._catalogo_productos(uuid) FROM PUBLIC, anon, authenticated;

-- Encabezado del catálogo: negocio, contacto, categorías y total.
CREATE OR REPLACE FUNCTION public.catalogo_publico(p_slug text)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH t AS (SELECT public._catalogo_tenant(p_slug) AS id),
  prods AS (
    SELECT cp.*
    FROM t
    JOIN public.catalogos_en_linea c ON c.tenant_id = t.id
    CROSS JOIN LATERAL public._catalogo_productos(t.id) cp
    WHERE c.mostrar_agotados OR cp.disponible
  )
  SELECT jsonb_build_object(
    'slug', c.slug,
    'negocio', tn.nombre_comercial,
    'logo_url', tn.logo_url,
    'color', tn.color_primario,
    'direccion', NULLIF(btrim(tn.direccion), ''),
    'whatsapp', c.whatsapp,
    'mensaje', NULLIF(btrim(c.mensaje), ''),
    'mostrar_precios', c.mostrar_precios,
    'total', (SELECT count(*) FROM prods),
    'categorias', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('nombre', x.categoria, 'total', x.n) ORDER BY x.categoria)
      FROM (SELECT categoria, count(*) AS n FROM prods WHERE categoria IS NOT NULL GROUP BY categoria) x
    ), '[]'::jsonb)
  )
  FROM t
  JOIN public.catalogos_en_linea c ON c.tenant_id = t.id
  JOIN public.tenants tn ON tn.id = t.id;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico(text) TO anon, authenticated;

-- Una página de productos (búsqueda y categoría opcionales). Precio NULL si el
-- negocio no muestra precios. Máximo 60 por página.
CREATE OR REPLACE FUNCTION public.catalogo_publico_productos(
  p_slug text,
  p_busqueda text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limite integer DEFAULT 48
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH t AS (SELECT public._catalogo_tenant(p_slug) AS id),
  conf AS (
    SELECT c.* FROM t JOIN public.catalogos_en_linea c ON c.tenant_id = t.id
  ),
  filtrados AS (
    SELECT cp.*
    FROM t
    CROSS JOIN conf
    CROSS JOIN LATERAL public._catalogo_productos(t.id) cp
    WHERE (conf.mostrar_agotados OR cp.disponible)
      AND (p_categoria IS NULL OR btrim(p_categoria) = '' OR cp.categoria = btrim(p_categoria))
      AND (
        p_busqueda IS NULL OR btrim(p_busqueda) = ''
        OR public._catalogo_normalizar(concat_ws(' ', cp.nombre, cp.descripcion, cp.categoria))
           LIKE '%' || public._catalogo_normalizar(left(btrim(p_busqueda), 80)) || '%'
      )
  ),
  pagina AS (
    SELECT f.*
    FROM filtrados f
    ORDER BY f.disponible DESC, lower(f.nombre), f.id
    OFFSET greatest(coalesce(p_offset, 0), 0)
    LIMIT least(greatest(coalesce(p_limite, 48), 1), 60)
  )
  SELECT CASE WHEN NOT EXISTS (SELECT 1 FROM conf) THEN NULL ELSE jsonb_build_object(
    'total', (SELECT count(*) FROM filtrados),
    'productos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id,
        'nombre', pg.nombre,
        'descripcion', pg.descripcion,
        'categoria', pg.categoria,
        'imagen_url', pg.imagen_url,
        'unidad_medida', pg.unidad_medida,
        'contenido_cantidad', pg.contenido_cantidad,
        'contenido_unidad', pg.contenido_unidad,
        'es_servicio', pg.es_servicio,
        'precio_min', CASE WHEN conf.mostrar_precios THEN pg.precio_min END,
        'precio_max', CASE WHEN conf.mostrar_precios THEN pg.precio_max END,
        'disponible', pg.disponible,
        'variantes', CASE WHEN conf.mostrar_precios THEN pg.variantes
          ELSE (SELECT COALESCE(jsonb_agg(v - 'precio'), '[]'::jsonb) FROM jsonb_array_elements(pg.variantes) v) END
      ) ORDER BY pg.disponible DESC, lower(pg.nombre), pg.id)
      FROM pagina pg, conf
    ), '[]'::jsonb)
  ) END;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico_productos(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico_productos(text, text, text, integer, integer) TO anon, authenticated;
