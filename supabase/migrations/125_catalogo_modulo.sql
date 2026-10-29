-- ===========================================================================
-- 125 — Catálogo en línea como módulo propio
-- ===========================================================================
--
-- La 124 dejó el catálogo como pestaña de Configuración (sin desplegar). Pasa
-- a ser un módulo del menú (/online-catalog) con:
--   - permiso propio `catalog.manage` (SUPER_ADMIN, ORG_ADMIN; concedible a un
--     cajero desde Usuarios);
--   - personalización: color y portada del catálogo;
--   - por producto: ocultar, destacar y precio especial SOLO del catálogo (en el
--     punto de venta se cobra el precio normal);
--   - vista previa para el equipo aunque el catálogo esté apagado.
--
-- Lo de cada producto vive en `catalogo_productos`, NO en `productos`: escribir
-- en `productos` dispararía los avisos de «editó N productos» (108) y exigiría
-- `inventory.manage`. Sin fila = publicado, sin destacar, precio normal.
--
-- `productos.oculto_en_catalogo` (124) ya está desplegada: se conserva con un
-- trigger que copia sus cambios a `catalogo_productos` (ver la sección 3) y se
-- quitará en otra migración, después del deploy del módulo.

-- ---------------------------------------------------------------------------
-- 1. Permiso
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, 'catalog.manage'
FROM (VALUES ('SUPER_ADMIN'::public.app_role), ('ORG_ADMIN'::public.app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role AND rp.permission = 'catalog.manage'
);

-- Concedible por usuario: se redefine el CHECK entero (como en 055, 070, 077 y
-- 088). `src/__tests__/modules.test.ts` lee el de la migración más alta.
ALTER TABLE public.user_permission_overrides
  DROP CONSTRAINT IF EXISTS user_permission_overrides_permission_check;

ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT user_permission_overrides_permission_check
  CHECK (permission = ANY (ARRAY[
    'sales.create', 'sales.view_reports', 'sales.void', 'sales.view_all',
    'inventory.view', 'inventory.manage', 'purchases.manage',
    'cash.manage', 'finances.manage',
    'org.manage_settings', 'org.manage_branches',
    'activity.view',
    'billing.view', 'billing.create', 'billing.stamp', 'billing.cancel', 'billing.config',
    'catalog.manage'
  ]));

-- ---------------------------------------------------------------------------
-- 2. catalogos_en_linea: personalización y el permiso nuevo
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogos_en_linea
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS portada_url text;

ALTER TABLE public.catalogos_en_linea
  DROP CONSTRAINT IF EXISTS catalogos_en_linea_color_check;
ALTER TABLE public.catalogos_en_linea
  ADD CONSTRAINT catalogos_en_linea_color_check CHECK (color IS NULL OR color ~ '^#[0-9A-Fa-f]{6}$');

DROP POLICY IF EXISTS catalogos_en_linea_insert ON public.catalogos_en_linea;
CREATE POLICY catalogos_en_linea_insert ON public.catalogos_en_linea
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('catalog.manage')));

DROP POLICY IF EXISTS catalogos_en_linea_update ON public.catalogos_en_linea;
CREATE POLICY catalogos_en_linea_update ON public.catalogos_en_linea
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('catalog.manage')))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('catalog.manage')));

-- ---------------------------------------------------------------------------
-- 3. catalogo_productos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.catalogo_productos (
  producto_id      uuid PRIMARY KEY REFERENCES public.productos(id) ON DELETE CASCADE,
  tenant_id        uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  oculto           boolean NOT NULL DEFAULT false,
  destacado        boolean NOT NULL DEFAULT false,
  precio_especial  numeric(10,2),
  actualizado_en   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalogo_productos_precio_check CHECK (precio_especial IS NULL OR precio_especial > 0)
);

COMMENT ON TABLE public.catalogo_productos IS
  'Ajustes de un producto en el catálogo en línea (125). Sin fila = publicado, sin destacar, precio normal. Solo visual: el POS cobra el precio normal.';

CREATE INDEX IF NOT EXISTS catalogo_productos_tenant_idx ON public.catalogo_productos (tenant_id);

CREATE OR REPLACE FUNCTION public._catalogo_productos_actualizado()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._catalogo_productos_actualizado() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_catalogo_productos_actualizado ON public.catalogo_productos;
CREATE TRIGGER trg_catalogo_productos_actualizado
  BEFORE UPDATE ON public.catalogo_productos
  FOR EACH ROW EXECUTE FUNCTION public._catalogo_productos_actualizado();

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.catalogo_productos;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.catalogo_productos
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

ALTER TABLE public.catalogo_productos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogo_productos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalogo_productos TO authenticated;

DROP POLICY IF EXISTS catalogo_productos_select ON public.catalogo_productos;
CREATE POLICY catalogo_productos_select ON public.catalogo_productos
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- El producto tiene que ser DEL MISMO negocio: la FK sola no lo garantiza.
DROP POLICY IF EXISTS catalogo_productos_insert ON public.catalogo_productos;
CREATE POLICY catalogo_productos_insert ON public.catalogo_productos
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND (SELECT public.authorize('catalog.manage'))
    AND EXISTS (SELECT 1 FROM public.productos p
                WHERE p.id = catalogo_productos.producto_id AND p.tenant_id = catalogo_productos.tenant_id)
  );

DROP POLICY IF EXISTS catalogo_productos_update ON public.catalogo_productos;
CREATE POLICY catalogo_productos_update ON public.catalogo_productos
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('catalog.manage')))
  WITH CHECK (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND (SELECT public.authorize('catalog.manage'))
    AND EXISTS (SELECT 1 FROM public.productos p
                WHERE p.id = catalogo_productos.producto_id AND p.tenant_id = catalogo_productos.tenant_id)
  );

DROP POLICY IF EXISTS catalogo_productos_delete ON public.catalogo_productos;
CREATE POLICY catalogo_productos_delete ON public.catalogo_productos
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('catalog.manage')));

-- `productos.oculto_en_catalogo` (124) YA ESTÁ DESPLEGADA: el formulario de
-- producto la manda en cada guardado. No se puede quitar todavía (rompería
-- guardar productos en las pestañas abiertas). Transición en dos pasos:
--   1. (aquí) lo que haya se pasa a `catalogo_productos` y un trigger copia cada
--      cambio de la columna mientras siga habiendo código viejo;
--   2. (otra migración, después del deploy del módulo) se quitan trigger y columna.
-- Las funciones del catálogo ya solo leen `catalogo_productos`.
INSERT INTO public.catalogo_productos (producto_id, tenant_id, oculto)
SELECT p.id, p.tenant_id, true
FROM public.productos p
WHERE p.oculto_en_catalogo
ON CONFLICT (producto_id) DO UPDATE SET oculto = true;

CREATE OR REPLACE FUNCTION public._productos_oculto_a_catalogo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  BEGIN
    INSERT INTO public.catalogo_productos (producto_id, tenant_id, oculto)
    VALUES (NEW.id, NEW.tenant_id, NEW.oculto_en_catalogo)
    ON CONFLICT (producto_id) DO UPDATE SET oculto = EXCLUDED.oculto;
  EXCEPTION WHEN OTHERS THEN
    -- Un ajuste del catálogo nunca puede tumbar el guardado de un producto.
    NULL;
  END;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public._productos_oculto_a_catalogo() FROM PUBLIC, anon, authenticated;

-- Solo cuando CAMBIA: un guardado del producto que reenvía el mismo valor no
-- debe deshacer lo que se decidió después en el módulo.
DROP TRIGGER IF EXISTS trg_productos_oculto_a_catalogo ON public.productos;
CREATE TRIGGER trg_productos_oculto_a_catalogo
  AFTER INSERT ON public.productos
  FOR EACH ROW
  WHEN (NEW.oculto_en_catalogo)
  EXECUTE FUNCTION public._productos_oculto_a_catalogo();

DROP TRIGGER IF EXISTS trg_productos_oculto_a_catalogo_upd ON public.productos;
CREATE TRIGGER trg_productos_oculto_a_catalogo_upd
  AFTER UPDATE OF oculto_en_catalogo ON public.productos
  FOR EACH ROW
  WHEN (OLD.oculto_en_catalogo IS DISTINCT FROM NEW.oculto_en_catalogo)
  EXECUTE FUNCTION public._productos_oculto_a_catalogo();

-- ---------------------------------------------------------------------------
-- 4. Funciones internas (sin EXECUTE para nadie)
-- ---------------------------------------------------------------------------

-- Cambia la forma de la tabla que devuelve: DROP + CREATE.
DROP FUNCTION IF EXISTS public._catalogo_productos(uuid);
CREATE FUNCTION public._catalogo_productos(p_tenant uuid)
RETURNS TABLE (
  id uuid, nombre text, descripcion text, categoria text, imagen_url text, unidad_medida text,
  contenido_cantidad numeric, contenido_unidad text, es_servicio boolean,
  precio_min numeric, precio_max numeric, precio_especial numeric,
  disponible boolean, destacado boolean, variantes jsonb
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
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
    p.id, p.nombre, NULLIF(btrim(p.descripcion), ''), NULLIF(btrim(p.categoria), ''), p.imagen_url,
    p.unidad_medida::text, p.contenido_cantidad, p.contenido_unidad::text, p.es_servicio,
    COALESCE(vars.pmin, p.precio_venta), COALESCE(vars.pmax, p.precio_venta),
    -- Precio especial solo en productos sin variantes.
    CASE WHEN vars.producto_id IS NULL THEN cp.precio_especial END,
    CASE WHEN vars.producto_id IS NOT NULL THEN vars.alguna
         ELSE p.es_servicio OR p.stock_actual > 0 END,
    COALESCE(cp.destacado, false),
    COALESCE(vars.lista, '[]'::jsonb)
  FROM public.productos p
  LEFT JOIN vars ON vars.producto_id = p.id
  LEFT JOIN public.catalogo_productos cp ON cp.producto_id = p.id
  WHERE p.tenant_id = p_tenant
    AND p.archivado_en IS NULL
    AND NOT COALESCE(cp.oculto, false)
    -- Un producto con variantes sin ninguna activa se vendería como general a
    -- $0: no se publica (misma regla que el POS).
    AND (NOT p.permite_variantes OR vars.producto_id IS NOT NULL OR p.precio_venta > 0);
$$;
REVOKE ALL ON FUNCTION public._catalogo_productos(uuid) FROM PUBLIC, anon, authenticated;

-- Una página de productos (o solo los destacados). Sin catálogo configurado
-- usa los valores por defecto: así la vista previa funciona desde el inicio.
CREATE OR REPLACE FUNCTION public._catalogo_pagina(
  p_tenant uuid,
  p_busqueda text,
  p_categoria text,
  p_offset integer,
  p_limite integer,
  p_solo_destacados boolean DEFAULT false
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  WITH conf AS (
    SELECT COALESCE(c.mostrar_precios, true) AS mostrar_precios,
           COALESCE(c.mostrar_agotados, true) AS mostrar_agotados
    FROM public.tenants tn
    LEFT JOIN public.catalogos_en_linea c ON c.tenant_id = tn.id
    WHERE tn.id = p_tenant
  ),
  filtrados AS (
    SELECT cp.*
    FROM conf
    CROSS JOIN LATERAL public._catalogo_productos(p_tenant) cp
    WHERE (conf.mostrar_agotados OR cp.disponible)
      AND (NOT p_solo_destacados OR cp.destacado)
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
    ORDER BY f.destacado DESC, f.disponible DESC, lower(f.nombre), f.id
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
        'precio_especial', CASE WHEN conf.mostrar_precios THEN pg.precio_especial END,
        'disponible', pg.disponible,
        'destacado', pg.destacado,
        'variantes', CASE WHEN conf.mostrar_precios THEN pg.variantes
          ELSE (SELECT COALESCE(jsonb_agg(v - 'precio'), '[]'::jsonb) FROM jsonb_array_elements(pg.variantes) v) END
      ) ORDER BY pg.destacado DESC, pg.disponible DESC, lower(pg.nombre), pg.id)
      FROM pagina pg, conf
    ), '[]'::jsonb)
  ) END;
$$;
REVOKE ALL ON FUNCTION public._catalogo_pagina(uuid, text, text, integer, integer, boolean) FROM PUBLIC, anon, authenticated;

-- Encabezado: negocio, personalización, contacto, categorías, total y
-- destacados. NULL si el negocio no existe.
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

-- ---------------------------------------------------------------------------
-- 5. Funciones públicas (anon): misma firma que en la 124
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.catalogo_publico(p_slug text)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public._catalogo_encabezado(t.id)
  FROM (SELECT public._catalogo_tenant(p_slug) AS id) t
  WHERE t.id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico(text) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_publico_productos(
  p_slug text,
  p_busqueda text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_offset integer DEFAULT 0,
  p_limite integer DEFAULT 48
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public._catalogo_pagina(t.id, p_busqueda, p_categoria, p_offset, p_limite, false)
  FROM (SELECT public._catalogo_tenant(p_slug) AS id) t
  WHERE t.id IS NOT NULL;
$$;
REVOKE ALL ON FUNCTION public.catalogo_publico_productos(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalogo_publico_productos(text, text, text, integer, integer) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. Vista previa (equipo con catalog.manage; aunque el catálogo esté apagado)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._catalogo_tenant_propio()
RETURNS uuid LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_tenant uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.authorize('catalog.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para ver el catálogo en línea' USING ERRCODE = '42501';
  END IF;
  SELECT tm.tenant_id INTO v_tenant
  FROM public.tenant_memberships tm
  WHERE tm.user_id = auth.uid()
  LIMIT 1;
  RETURN v_tenant;
END;
$$;
REVOKE ALL ON FUNCTION public._catalogo_tenant_propio() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_vista_previa()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public._catalogo_encabezado(public._catalogo_tenant_propio());
$$;
REVOKE ALL ON FUNCTION public.catalogo_vista_previa() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_vista_previa() TO authenticated;

CREATE OR REPLACE FUNCTION public.catalogo_vista_previa_productos(
  p_busqueda text DEFAULT NULL,
  p_categoria text DEFAULT NULL,
  p_offset integer DEFAULT 0
)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public._catalogo_pagina(public._catalogo_tenant_propio(), p_busqueda, p_categoria, p_offset, 48, false);
$$;
REVOKE ALL ON FUNCTION public.catalogo_vista_previa_productos(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.catalogo_vista_previa_productos(text, text, integer) TO authenticated;
