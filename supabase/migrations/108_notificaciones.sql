-- =============================================================================
-- 108 · Notificaciones: campana del header y aviso de stock por correo
--
-- QUE RESUELVE. Un producto podia quedar en "Stock bajo" o "Agotado" sin que
-- nadie se enterara (solo cambiaba la etiqueta de la tabla), y el dueño no
-- sabia, sin abrir la Bitacora, que alguien de su equipo cerro caja, creo
-- productos o hizo una orden de compra.
--
-- PIEZAS
--   * `notificaciones`: una fila por aviso, visible segun permisos (RLS).
--   * `notificaciones_lectura`: hasta cuando leyo cada usuario (no leidas =
--     `creado_en > leido_hasta`).
--   * Triggers que las generan. Estan en las TABLAS DE ORIGEN y no en
--     `activity_logs`: los registros de la Bitacora que manda el navegador
--     pueden fallar en silencio, y algunos eventos quedan duplicados (trigger +
--     cliente).
--   * `reclamar_avisos_stock` / `liberar_avisos_stock`: el correo inmediato de
--     stock (ruta `/api/notificaciones/correo-stock`), uno por negocio cada
--     15 minutos como maximo, sin duplicados aunque lo pidan varias pestañas.
--
-- QUIEN VE QUE (politica `notificaciones_select`)
--   * Stock (`permiso` NULL): todo el equipo, cajeros incluidos.
--   * Acciones de un colaborador (`actor_id` con valor): el permiso del modulo
--     (`inventory.manage`, `purchases.manage`, `finances.manage`) Y ADEMAS
--     `activity.view` (la Bitacora: "quien hizo que"). Sin lo segundo, el
--     cajero —que trae `purchases.manage` de fabrica— veria las compras de sus
--     compañeros. El SUPER_ADMIN pasa todos los `authorize()`: ve todo.
--   * Nadie recibe aviso de lo que hizo el mismo.
--   * Solo se avisa de acciones de quien NO es SUPER_ADMIN: el dueño no necesita
--     que le cuenten lo que hizo el.
--
-- REGLA DE ORO: UN AVISO NUNCA PUEDE TUMBAR LA OPERACION QUE LO DISPARA. Todos
-- los triggers atrapan cualquier error (`EXCEPTION WHEN OTHERS`) y siguen: una
-- venta, un cierre de caja o una compra valen mas que su notificacion.
-- =============================================================================

BEGIN;

-- =============================================
-- 1. Tablas
-- =============================================

CREATE TABLE IF NOT EXISTS public.notificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN (
    'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto',
    'compra', 'orden_compra', 'ajuste', 'traspaso'
  )),
  titulo TEXT NOT NULL,
  mensaje TEXT,
  -- Ruta del panel SIN idioma (`/products`); el cliente la abre con el `Link`
  -- de next-intl.
  enlace TEXT,
  -- NULL = todo el equipo. Con valor, ademas, `activity.view` si hay actor.
  permiso TEXT,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entidad_id UUID,
  -- `accion` (para agrupar), `cantidad` (agrupadas) y los datos del aviso.
  datos JSONB NOT NULL DEFAULT '{}'::jsonb,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Solo stock: cuando salio en un correo. NULL = pendiente.
  correo_enviado_en TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_tenant_creado
  ON public.notificaciones (tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_notificaciones_actor
  ON public.notificaciones (actor_id);
-- Correo pendiente de stock: lo busca el reclamo y el cron de respaldo.
CREATE INDEX IF NOT EXISTS idx_notificaciones_correo_pendiente
  ON public.notificaciones (tenant_id, creado_en)
  WHERE correo_enviado_en IS NULL AND tipo IN ('stock_bajo', 'stock_agotado');

CREATE TABLE IF NOT EXISTS public.notificaciones_lectura (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  leido_hasta TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tenant_id)
);
CREATE INDEX IF NOT EXISTS idx_notificaciones_lectura_tenant
  ON public.notificaciones_lectura (tenant_id);

-- =============================================
-- 2. RLS. Solo lectura para el navegador: las escrituras las hacen los
--    triggers y RPCs SECURITY DEFINER de abajo. Sin politicas de escritura y
--    con los privilegios revocados, el barrido de la 054 no las lista.
-- =============================================

ALTER TABLE public.notificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notificaciones_lectura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notificaciones_select ON public.notificaciones;
CREATE POLICY notificaciones_select ON public.notificaciones
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND actor_id IS DISTINCT FROM (SELECT auth.uid())
    AND (permiso IS NULL OR public.authorize(permiso))
    AND (actor_id IS NULL OR public.authorize('activity.view'))
  );

DROP POLICY IF EXISTS notificaciones_lectura_select ON public.notificaciones_lectura;
CREATE POLICY notificaciones_lectura_select ON public.notificaciones_lectura
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON public.notificaciones FROM anon, authenticated;
REVOKE ALL ON public.notificaciones_lectura FROM anon, authenticated;
GRANT SELECT ON public.notificaciones TO authenticated;
GRANT SELECT ON public.notificaciones_lectura TO authenticated;
GRANT ALL ON public.notificaciones TO service_role;
GRANT ALL ON public.notificaciones_lectura TO service_role;

-- La campana se entera al instante por Realtime (respeta la RLS de arriba).
DO $pub$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'notificaciones'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notificaciones;
  END IF;
END
$pub$;

-- =============================================
-- 3. Ayudantes
-- =============================================

-- El negocio demo se reinicia en cada visita: no se le generan avisos.
CREATE OR REPLACE FUNCTION public._notif_tenant_activo(p_tenant_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.tenant_memberships tm
    JOIN auth.users u ON u.id = tm.user_id
    WHERE tm.tenant_id = p_tenant_id AND u.email = 'demo@symvora.com'
  );
$fn$;

-- Quien hizo la accion, SOLO si es un colaborador (no SUPER_ADMIN) del negocio.
-- Devuelve NULL si no hay a quien atribuirla o si es el dueño.
CREATE OR REPLACE FUNCTION public._notif_colaborador(p_tenant_id UUID, p_usuario UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT tm.user_id
  FROM public.tenant_memberships tm
  WHERE tm.tenant_id = p_tenant_id
    AND tm.user_id = p_usuario
    AND tm.role <> 'SUPER_ADMIN';
$fn$;

CREATE OR REPLACE FUNCTION public._notif_nombre(p_usuario UUID)
RETURNS TEXT
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(
    NULLIF(public.nombre_de_usuario(u.raw_user_meta_data), ''),
    split_part(u.email, '@', 1),
    'Alguien'
  )
  FROM auth.users u WHERE u.id = p_usuario;
$fn$;

CREATE OR REPLACE FUNCTION public._notif_mxn(p_monto NUMERIC)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $fn$
  SELECT CASE WHEN p_monto < 0 THEN '-' ELSE '' END
         || to_char(abs(COALESCE(p_monto, 0)), 'FM$999,999,990.00');
$fn$;

-- "3 pzas", "0.75 kg". Misma abreviatura que `abreviatura()` de lib/unidades.ts.
CREATE OR REPLACE FUNCTION public._notif_cantidad(p_cantidad NUMERIC, p_unidad TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $fn$
  SELECT trim_scale(COALESCE(p_cantidad, 0))::text || ' ' ||
    CASE COALESCE(p_unidad, 'PIEZA')
      WHEN 'KG' THEN 'kg'
      WHEN 'GRAMO' THEN 'g'
      WHEN 'LITRO' THEN 'l'
      WHEN 'MILILITRO' THEN 'ml'
      WHEN 'METRO' THEN 'm'
      WHEN 'CAJA' THEN CASE WHEN p_cantidad = 1 THEN 'caja' ELSE 'cajas' END
      WHEN 'PAQUETE' THEN CASE WHEN p_cantidad = 1 THEN 'paq' ELSE 'paqs' END
      WHEN 'PAR' THEN CASE WHEN p_cantidad = 1 THEN 'par' ELSE 'pares' END
      WHEN 'DOCENA' THEN CASE WHEN p_cantidad = 1 THEN 'doc' ELSE 'docs' END
      ELSE CASE WHEN p_cantidad = 1 THEN 'pza' ELSE 'pzas' END
    END;
$fn$;

-- Misma regla que `stockStatus()` (features/inventory/stock-status.ts):
-- 0 = ok, 1 = bajo, 2 = agotado. Con minimo 0 nunca hay "bajo".
CREATE OR REPLACE FUNCTION public._notif_estado_stock(p_actual NUMERIC, p_minimo NUMERIC)
RETURNS INT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $fn$
  SELECT CASE
    WHEN COALESCE(p_actual, 0) <= 0 THEN 2
    WHEN COALESCE(p_actual, 0) <= COALESCE(p_minimo, 0) THEN 1
    ELSE 0
  END;
$fn$;

-- "Coca-Cola · 600 ml · Regular": producto + valores de los atributos.
CREATE OR REPLACE FUNCTION public._notif_nombre_variante(p_producto TEXT, p_atributos JSONB, p_talla TEXT, p_color TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $fn$
  SELECT COALESCE(p_producto, 'Producto') || COALESCE(' · ' || NULLIF(
    COALESCE(
      (SELECT string_agg(e.value, ' · ' ORDER BY e.key)
       FROM jsonb_each_text(CASE WHEN jsonb_typeof(p_atributos) = 'object' THEN p_atributos ELSE '{}'::jsonb END) e
       WHERE NULLIF(e.value, '') IS NOT NULL),
      concat_ws(' · ', NULLIF(p_talla, ''), NULLIF(p_color, ''))
    ), ''), '');
$fn$;

-- Registra la accion de un colaborador. Si el MISMO actor hizo la MISMA accion
-- hace menos de 10 minutos, se suma a esa notificacion ("Ana creo 12
-- productos") en vez de crear otra: una importacion de CSV no llena la campana.
-- `p_titulo_varios` lleva `%s` donde va la cantidad.
CREATE OR REPLACE FUNCTION public._notif_accion(
  p_tenant_id UUID,
  p_actor UUID,
  p_tipo TEXT,
  p_accion TEXT,
  p_titulo TEXT,
  p_titulo_varios TEXT,
  p_mensaje TEXT,
  p_enlace TEXT,
  p_permiso TEXT,
  p_entidad_id UUID,
  p_datos JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_existente public.notificaciones%ROWTYPE;
  v_cantidad INT;
BEGIN
  IF p_actor IS NULL OR NOT public._notif_tenant_activo(p_tenant_id) THEN
    RETURN;
  END IF;

  IF p_titulo_varios IS NOT NULL THEN
    SELECT * INTO v_existente
    FROM public.notificaciones n
    WHERE n.tenant_id = p_tenant_id
      AND n.actor_id = p_actor
      AND n.tipo = p_tipo
      AND n.datos->>'accion' = p_accion
      AND n.creado_en > NOW() - INTERVAL '10 minutes'
    ORDER BY n.creado_en DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND THEN
      v_cantidad := COALESCE((v_existente.datos->>'cantidad')::INT, 1) + 1;
      UPDATE public.notificaciones
      SET titulo = format(p_titulo_varios, v_cantidad),
          mensaje = p_mensaje,
          entidad_id = p_entidad_id,
          datos = v_existente.datos || COALESCE(p_datos, '{}'::jsonb)
                  || jsonb_build_object('accion', p_accion, 'cantidad', v_cantidad),
          -- Vuelve a "no leida" y sube arriba de la lista.
          creado_en = NOW()
      WHERE id = v_existente.id;
      RETURN;
    END IF;
  END IF;

  INSERT INTO public.notificaciones (
    tenant_id, tipo, titulo, mensaje, enlace, permiso, actor_id, entidad_id, datos
  ) VALUES (
    p_tenant_id, p_tipo, p_titulo, p_mensaje, p_enlace, p_permiso, p_actor, p_entidad_id,
    COALESCE(p_datos, '{}'::jsonb) || jsonb_build_object('accion', p_accion, 'cantidad', 1)
  );
END;
$fn$;

-- Aviso de stock (todo el equipo). Un mismo producto/variante no repite el
-- mismo aviso en 12 horas: si sube y baja varias veces en el dia, un solo aviso.
CREATE OR REPLACE FUNCTION public._notif_stock(
  p_tenant_id UUID,
  p_producto_id UUID,
  p_variante_id UUID,
  p_nombre TEXT,
  p_actual NUMERIC,
  p_minimo NUMERIC,
  p_unidad TEXT,
  p_estado INT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tipo TEXT := CASE WHEN p_estado = 2 THEN 'stock_agotado' ELSE 'stock_bajo' END;
  v_entidad UUID := COALESCE(p_variante_id, p_producto_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = p_tenant_id
      AND n.entidad_id = v_entidad
      AND n.tipo = v_tipo
      AND n.creado_en > NOW() - INTERVAL '12 hours'
  ) THEN
    RETURN;
  END IF;

  IF NOT public._notif_tenant_activo(p_tenant_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.notificaciones (
    tenant_id, tipo, titulo, mensaje, enlace, permiso, entidad_id, datos
  ) VALUES (
    p_tenant_id,
    v_tipo,
    CASE WHEN p_estado = 2 THEN 'Se agotó: ' ELSE 'Stock bajo: ' END || p_nombre,
    CASE
      WHEN p_estado = 2 AND COALESCE(p_minimo, 0) > 0
        THEN 'Sin existencias. Stock mínimo: ' || public._notif_cantidad(p_minimo, p_unidad) || '.'
      WHEN p_estado = 2 THEN 'Sin existencias.'
      ELSE 'Quedan ' || public._notif_cantidad(p_actual, p_unidad)
           || ' (mínimo ' || public._notif_cantidad(p_minimo, p_unidad) || ').'
    END,
    '/products',
    NULL,
    v_entidad,
    jsonb_build_object(
      'producto_id', p_producto_id,
      'variante_id', p_variante_id,
      'nombre', p_nombre,
      'stock', p_actual,
      'minimo', p_minimo,
      'unidad', COALESCE(p_unidad, 'PIEZA')
    )
  );
END;
$fn$;

-- =============================================
-- 4. Stock: avisa cuando el estado EMPEORA (ok -> bajo, ok/bajo -> agotado).
--    Es sobre el stock TOTAL, el mismo que muestra la tabla de productos.
--    Corre dentro de cada venta: lo comun (nada empeora) es una comparacion.
-- =============================================

CREATE OR REPLACE FUNCTION public._notif_trg_stock_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_nuevo INT;
BEGIN
  BEGIN
    IF NEW.es_servicio OR NEW.archivado_en IS NOT NULL THEN
      RETURN NULL;
    END IF;
    v_nuevo := public._notif_estado_stock(NEW.stock_actual, NEW.stock_minimo);
    IF v_nuevo <= public._notif_estado_stock(OLD.stock_actual, OLD.stock_minimo) THEN
      RETURN NULL;
    END IF;
    -- El producto general de uno con variantes no se vende solo: su
    -- `stock_actual` es el stock sin variante (casi siempre 0). Avisan sus
    -- variantes.
    IF EXISTS (SELECT 1 FROM public.variantes_producto v WHERE v.producto_id = NEW.id) THEN
      RETURN NULL;
    END IF;
    PERFORM public._notif_stock(
      NEW.tenant_id, NEW.id, NULL, NEW.nombre,
      NEW.stock_actual, NEW.stock_minimo, NEW.unidad_medida::text, v_nuevo
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de stock de producto omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

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

DROP TRIGGER IF EXISTS trg_notif_stock_producto ON public.productos;
CREATE TRIGGER trg_notif_stock_producto
  AFTER UPDATE OF stock_actual, stock_minimo ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_stock_producto();

DROP TRIGGER IF EXISTS trg_notif_stock_variante ON public.variantes_producto;
CREATE TRIGGER trg_notif_stock_variante
  AFTER UPDATE OF stock_actual, stock_minimo ON public.variantes_producto
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_stock_variante();

-- =============================================
-- 5. Acciones de colaboradores
-- =============================================

-- Cierre de caja (manual o automatico de madrugada). La caja es de quien la
-- abrio (`usuario_id`), cierre quien la cierre.
CREATE OR REPLACE FUNCTION public._notif_trg_caja()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_dif NUMERIC;
BEGIN
  BEGIN
    v_actor := public._notif_colaborador(NEW.tenant_id, NEW.usuario_id);
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    v_dif := COALESCE(NEW.diferencia, COALESCE(NEW.saldo_real, 0) - COALESCE(NEW.saldo_esperado, 0));
    PERFORM public._notif_accion(
      NEW.tenant_id, v_actor, 'caja_cerrada', 'cerrar',
      CASE WHEN auth.uid() IS NULL
        THEN 'Caja de ' || v_nombre || ' cerrada automáticamente'
        ELSE v_nombre || ' cerró su caja' END,
      NULL,
      'Ventas ' || public._notif_mxn(NEW.total_ventas)
        || ' · Esperado ' || public._notif_mxn(NEW.saldo_esperado)
        || ' · Contado ' || public._notif_mxn(NEW.saldo_real)
        || CASE
             WHEN abs(v_dif) < 0.005 THEN ' · Cuadra'
             WHEN v_dif < 0 THEN ' · Faltan ' || public._notif_mxn(abs(v_dif))
             ELSE ' · Sobran ' || public._notif_mxn(v_dif)
           END,
      '/activity', 'finances.manage', NEW.id,
      jsonb_build_object('diferencia', v_dif)
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de cierre de caja omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_caja ON public.cajas;
CREATE TRIGGER trg_notif_caja
  AFTER UPDATE OF estado ON public.cajas
  FOR EACH ROW
  WHEN (OLD.estado = 'ABIERTA' AND NEW.estado = 'CERRADA')
  EXECUTE FUNCTION public._notif_trg_caja();

-- Productos: alta, baja, archivo/restauracion y edicion de nombre, precio,
-- costo o categoria. Las actualizaciones de stock no pasan por aqui (el
-- trigger solo escucha esas columnas).
CREATE OR REPLACE FUNCTION public._notif_trg_producto()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_fila public.productos%ROWTYPE;
  v_actor UUID;
  v_nombre TEXT;
  v_cambios TEXT[] := '{}';
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_fila := OLD;
    ELSE
      v_fila := NEW;
    END IF;
    v_actor := public._notif_colaborador(v_fila.tenant_id, auth.uid());
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);

    IF TG_OP = 'INSERT' THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'crear',
        v_nombre || ' creó el producto ' || v_fila.nombre, v_nombre || ' creó %s productos',
        'Último: ' || v_fila.nombre || ' · ' || public._notif_mxn(v_fila.precio_venta),
        '/products', 'inventory.manage', v_fila.id);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'eliminar',
        v_nombre || ' eliminó el producto ' || v_fila.nombre, v_nombre || ' eliminó %s productos',
        'Último: ' || v_fila.nombre,
        '/products', 'inventory.manage', v_fila.id);
    ELSIF OLD.archivado_en IS NULL AND NEW.archivado_en IS NOT NULL THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'archivar',
        v_nombre || ' archivó el producto ' || v_fila.nombre, v_nombre || ' archivó %s productos',
        'Último: ' || v_fila.nombre,
        '/products', 'inventory.manage', v_fila.id);
    ELSIF OLD.archivado_en IS NOT NULL AND NEW.archivado_en IS NULL THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'restaurar',
        v_nombre || ' restauró el producto ' || v_fila.nombre, v_nombre || ' restauró %s productos',
        'Último: ' || v_fila.nombre,
        '/products', 'inventory.manage', v_fila.id);
    ELSE
      IF OLD.precio_venta IS DISTINCT FROM NEW.precio_venta THEN
        v_cambios := v_cambios || ('Precio ' || public._notif_mxn(OLD.precio_venta) || ' → ' || public._notif_mxn(NEW.precio_venta));
      END IF;
      IF OLD.costo_compra IS DISTINCT FROM NEW.costo_compra THEN
        v_cambios := v_cambios || ('Costo ' || public._notif_mxn(OLD.costo_compra) || ' → ' || public._notif_mxn(NEW.costo_compra));
      END IF;
      IF OLD.nombre IS DISTINCT FROM NEW.nombre THEN
        v_cambios := v_cambios || ('Antes: ' || OLD.nombre);
      END IF;
      IF OLD.categoria IS DISTINCT FROM NEW.categoria THEN
        v_cambios := v_cambios || ('Categoría: ' || COALESCE(NULLIF(NEW.categoria, ''), 'sin categoría'));
      END IF;
      IF cardinality(v_cambios) = 0 THEN
        RETURN NULL;
      END IF;
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'editar',
        v_nombre || ' editó el producto ' || v_fila.nombre, v_nombre || ' editó %s productos',
        v_fila.nombre || ': ' || array_to_string(v_cambios, ' · '),
        '/products', 'inventory.manage', v_fila.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de producto omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_producto_alta_baja ON public.productos;
CREATE TRIGGER trg_notif_producto_alta_baja
  AFTER INSERT OR DELETE ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_producto();

DROP TRIGGER IF EXISTS trg_notif_producto_edicion ON public.productos;
CREATE TRIGGER trg_notif_producto_edicion
  AFTER UPDATE OF nombre, precio_venta, costo_compra, categoria, archivado_en ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_producto();

-- Variantes: alta, baja y cambio de precio o costo.
CREATE OR REPLACE FUNCTION public._notif_trg_variante()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_fila public.variantes_producto%ROWTYPE;
  v_actor UUID;
  v_nombre TEXT;
  v_variante TEXT;
  v_cambios TEXT[] := '{}';
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      v_fila := OLD;
    ELSE
      v_fila := NEW;
    END IF;
    v_actor := public._notif_colaborador(v_fila.tenant_id, auth.uid());
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    v_variante := public._notif_nombre_variante(
      (SELECT p.nombre FROM public.productos p WHERE p.id = v_fila.producto_id),
      v_fila.atributos, v_fila.talla, v_fila.color
    );

    IF TG_OP = 'INSERT' THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'crear_variante',
        v_nombre || ' agregó la variante ' || v_variante, v_nombre || ' agregó %s variantes',
        'Última: ' || v_variante || ' · ' || public._notif_mxn(v_fila.precio_venta),
        '/products', 'inventory.manage', v_fila.id);
    ELSIF TG_OP = 'DELETE' THEN
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'eliminar_variante',
        v_nombre || ' eliminó la variante ' || v_variante, v_nombre || ' eliminó %s variantes',
        'Última: ' || v_variante,
        '/products', 'inventory.manage', v_fila.id);
    ELSE
      IF OLD.precio_venta IS DISTINCT FROM NEW.precio_venta THEN
        v_cambios := v_cambios || ('Precio ' || public._notif_mxn(OLD.precio_venta) || ' → ' || public._notif_mxn(NEW.precio_venta));
      END IF;
      IF OLD.costo_compra IS DISTINCT FROM NEW.costo_compra THEN
        v_cambios := v_cambios || ('Costo ' || public._notif_mxn(OLD.costo_compra) || ' → ' || public._notif_mxn(NEW.costo_compra));
      END IF;
      IF cardinality(v_cambios) = 0 THEN
        RETURN NULL;
      END IF;
      PERFORM public._notif_accion(v_fila.tenant_id, v_actor, 'producto', 'editar_variante',
        v_nombre || ' editó la variante ' || v_variante, v_nombre || ' editó %s variantes',
        v_variante || ': ' || array_to_string(v_cambios, ' · '),
        '/products', 'inventory.manage', v_fila.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de variante omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_variante_alta_baja ON public.variantes_producto;
CREATE TRIGGER trg_notif_variante_alta_baja
  AFTER INSERT OR DELETE ON public.variantes_producto
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_variante();

DROP TRIGGER IF EXISTS trg_notif_variante_edicion ON public.variantes_producto;
CREATE TRIGGER trg_notif_variante_edicion
  AFTER UPDATE OF precio_venta, costo_compra ON public.variantes_producto
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_variante();

-- Ordenes de compra: creada, recibida (parcial o total) y cancelada.
CREATE OR REPLACE FUNCTION public._notif_trg_orden_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_orden TEXT;
  v_accion TEXT;
  v_verbo TEXT;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(auth.uid(), NEW.usuario_id));
      v_accion := 'crear';
      v_verbo := 'creó';
    ELSE
      v_actor := public._notif_colaborador(NEW.tenant_id, auth.uid());
      IF NEW.estado::text IN ('RECIBIDA_TOTAL', 'RECIBIDA_PARCIAL') THEN
        v_accion := 'recibir';
        v_verbo := CASE WHEN NEW.estado::text = 'RECIBIDA_PARCIAL' THEN 'recibió parcialmente' ELSE 'recibió' END;
      ELSIF NEW.estado::text = 'CANCELADA' THEN
        v_accion := 'cancelar';
        v_verbo := 'canceló';
      ELSE
        RETURN NULL;
      END IF;
    END IF;
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    v_orden := COALESCE(NULLIF(NEW.numero_orden, ''), 'OC ' || left(NEW.id::text, 8));
    PERFORM public._notif_accion(
      NEW.tenant_id, v_actor, 'orden_compra', v_accion,
      v_nombre || ' ' || v_verbo || ' la orden de compra ' || v_orden,
      NULL,
      'Total ' || public._notif_mxn(NEW.total)
        || COALESCE(' · Proveedor: ' || (SELECT pr.nombre FROM public.proveedores pr WHERE pr.id = NEW.proveedor_id), ''),
      '/purchase-orders', 'purchases.manage', NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de orden de compra omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_orden_compra_alta ON public.ordenes_compra;
CREATE TRIGGER trg_notif_orden_compra_alta
  AFTER INSERT ON public.ordenes_compra
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_orden_compra();

DROP TRIGGER IF EXISTS trg_notif_orden_compra_estado ON public.ordenes_compra;
CREATE TRIGGER trg_notif_orden_compra_estado
  AFTER UPDATE OF estado ON public.ordenes_compra
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public._notif_trg_orden_compra();

-- Compras directas: registrada y cancelada. La compra que nace al recibir una
-- orden (`orden_compra_id`) no avisa: ya aviso la orden.
CREATE OR REPLACE FUNCTION public._notif_trg_compra()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_detalle TEXT;
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      IF NEW.orden_compra_id IS NOT NULL THEN
        RETURN NULL;
      END IF;
      v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(auth.uid(), NEW.usuario_id));
    ELSIF NEW.estado::text = 'CANCELADA' THEN
      v_actor := public._notif_colaborador(NEW.tenant_id, auth.uid());
    ELSE
      RETURN NULL;
    END IF;
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    v_detalle := 'Total ' || public._notif_mxn(NEW.total)
      || COALESCE(' · Factura ' || NULLIF(NEW.numero_factura, ''), '')
      || COALESCE(' · Proveedor: ' || (SELECT pr.nombre FROM public.proveedores pr WHERE pr.id = NEW.proveedor_id), '');
    IF TG_OP = 'INSERT' THEN
      PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'compra', 'registrar',
        v_nombre || ' registró una compra', v_nombre || ' registró %s compras',
        v_detalle, '/purchases', 'purchases.manage', NEW.id);
    ELSE
      PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'compra', 'cancelar',
        v_nombre || ' canceló una compra', v_nombre || ' canceló %s compras',
        v_detalle, '/purchases', 'purchases.manage', NEW.id);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de compra omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_compra_alta ON public.compras;
CREATE TRIGGER trg_notif_compra_alta
  AFTER INSERT ON public.compras
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_compra();

DROP TRIGGER IF EXISTS trg_notif_compra_estado ON public.compras;
CREATE TRIGGER trg_notif_compra_estado
  AFTER UPDATE OF estado ON public.compras
  FOR EACH ROW
  WHEN (OLD.estado IS DISTINCT FROM NEW.estado)
  EXECUTE FUNCTION public._notif_trg_compra();

-- Ajustes de inventario.
CREATE OR REPLACE FUNCTION public._notif_trg_ajuste()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_producto public.productos%ROWTYPE;
  v_articulo TEXT;
  v_unidad TEXT;
BEGIN
  BEGIN
    v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(auth.uid(), NEW.usuario_id));
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    SELECT * INTO v_producto FROM public.productos p WHERE p.id = NEW.producto_id;
    v_articulo := v_producto.nombre;
    v_unidad := v_producto.unidad_medida::text;
    IF NEW.variante_id IS NOT NULL THEN
      SELECT public._notif_nombre_variante(v_producto.nombre, v.atributos, v.talla, v.color),
             COALESCE(v.unidad_medida::text, v_producto.unidad_medida::text)
      INTO v_articulo, v_unidad
      FROM public.variantes_producto v WHERE v.id = NEW.variante_id;
    END IF;
    PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'ajuste', 'ajustar',
      v_nombre || ' ajustó el inventario de ' || COALESCE(v_articulo, 'un producto'),
      v_nombre || ' hizo %s ajustes de inventario',
      COALESCE(v_articulo, 'Producto') || ': '
        || public._notif_cantidad(NEW.cantidad_anterior, v_unidad) || ' → '
        || public._notif_cantidad(NEW.cantidad_nueva, v_unidad)
        || COALESCE(' · ' || NULLIF(NEW.motivo::text, ''), ''),
      '/products?tab=adjustments', 'inventory.manage', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de ajuste omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_ajuste ON public.ajustes_inventario;
CREATE TRIGGER trg_notif_ajuste
  AFTER INSERT ON public.ajustes_inventario
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_ajuste();

-- Traspasos entre sucursales.
CREATE OR REPLACE FUNCTION public._notif_trg_traspaso()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
BEGIN
  BEGIN
    v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(auth.uid(), NEW.usuario_id));
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'traspaso', 'traspasar',
      v_nombre || ' hizo un traspaso entre sucursales',
      v_nombre || ' hizo %s traspasos entre sucursales',
      COALESCE((SELECT s.nombre FROM public.sucursales s WHERE s.id = NEW.sucursal_origen_id), '¿?')
        || ' → '
        || COALESCE((SELECT s.nombre FROM public.sucursales s WHERE s.id = NEW.sucursal_destino_id), '¿?'),
      '/branches', 'inventory.manage', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de traspaso omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_traspaso ON public.traspasos;
CREATE TRIGGER trg_notif_traspaso
  AFTER INSERT ON public.traspasos
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_traspaso();

-- =============================================
-- 6. RPCs
-- =============================================

-- "Ya las vi": la campana lo llama al abrirse. Devuelve el nuevo `leido_hasta`.
CREATE OR REPLACE FUNCTION public.marcar_notificaciones_leidas(p_tenant_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_ahora TIMESTAMPTZ := NOW();
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = v_uid AND tm.tenant_id = p_tenant_id
  ) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  INSERT INTO public.notificaciones_lectura (user_id, tenant_id, leido_hasta)
  VALUES (v_uid, p_tenant_id, v_ahora)
  ON CONFLICT (user_id, tenant_id) DO UPDATE SET leido_hasta = EXCLUDED.leido_hasta;

  RETURN v_ahora;
END;
$fn$;

-- Correo de stock: toma (marca como enviados) los avisos pendientes del negocio,
-- si no se le mando otro correo hace menos de `p_intervalo_segundos`.
-- El candado por negocio evita que dos peticiones simultaneas manden dos
-- correos. Respuestas:
--   {"avisos": [...]}  -> mandar el correo con estos avisos
--   {"avisos": []}     -> nada pendiente
--   {"esperar": 412}   -> hay pendientes, pero el ultimo correo fue hace poco
CREATE OR REPLACE FUNCTION public.reclamar_avisos_stock(
  p_tenant_id UUID,
  p_intervalo_segundos INT DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_ultimo TIMESTAMPTZ;
  v_avisos JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('avisos_stock:' || p_tenant_id::text));

  IF NOT EXISTS (
    SELECT 1 FROM public.notificaciones n
    WHERE n.tenant_id = p_tenant_id
      AND n.tipo IN ('stock_bajo', 'stock_agotado')
      AND n.correo_enviado_en IS NULL
      AND n.creado_en > NOW() - INTERVAL '24 hours'
  ) THEN
    RETURN jsonb_build_object('avisos', '[]'::jsonb);
  END IF;

  SELECT max(n.correo_enviado_en) INTO v_ultimo
  FROM public.notificaciones n
  WHERE n.tenant_id = p_tenant_id
    AND n.tipo IN ('stock_bajo', 'stock_agotado')
    AND n.correo_enviado_en IS NOT NULL;

  IF v_ultimo IS NOT NULL AND v_ultimo > NOW() - make_interval(secs => p_intervalo_segundos) THEN
    RETURN jsonb_build_object(
      'esperar',
      ceil(extract(epoch FROM (v_ultimo + make_interval(secs => p_intervalo_segundos) - NOW())))::INT
    );
  END IF;

  WITH tomados AS (
    UPDATE public.notificaciones n
    SET correo_enviado_en = NOW()
    WHERE n.tenant_id = p_tenant_id
      AND n.tipo IN ('stock_bajo', 'stock_agotado')
      AND n.correo_enviado_en IS NULL
      AND n.creado_en > NOW() - INTERVAL '24 hours'
    RETURNING n.id, n.tipo, n.datos, n.creado_en
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id,
    'tipo', t.tipo,
    'nombre', t.datos->>'nombre',
    'stock', (t.datos->>'stock')::NUMERIC,
    'minimo', (t.datos->>'minimo')::NUMERIC,
    'unidad', t.datos->>'unidad',
    'creado_en', t.creado_en
  -- 'stock_agotado' < 'stock_bajo': los agotados van primero en el correo.
  ) ORDER BY t.tipo, t.creado_en), '[]'::jsonb)
  INTO v_avisos
  FROM tomados t;

  RETURN jsonb_build_object('avisos', v_avisos);
END;
$fn$;

-- Si el correo fallo, los avisos vuelven a quedar pendientes.
CREATE OR REPLACE FUNCTION public.liberar_avisos_stock(p_ids UUID[])
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  UPDATE public.notificaciones SET correo_enviado_en = NULL WHERE id = ANY(p_ids);
$fn$;

-- =============================================
-- 7. Privilegios. Las funciones internas y las del correo no se exponen a la
--    API; `marcar_notificaciones_leidas` solo a usuarios con sesion.
-- =============================================

REVOKE ALL ON FUNCTION public._notif_tenant_activo(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_colaborador(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_nombre(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_accion(UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_stock(UUID, UUID, UUID, TEXT, NUMERIC, NUMERIC, TEXT, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_stock_producto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_stock_variante() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_caja() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_producto() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_variante() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_orden_compra() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_compra() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_ajuste() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_traspaso() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.reclamar_avisos_stock(UUID, INT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_avisos_stock(UUID[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reclamar_avisos_stock(UUID, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_avisos_stock(UUID[]) TO service_role;

REVOKE ALL ON FUNCTION public.marcar_notificaciones_leidas(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_notificaciones_leidas(UUID) TO authenticated, service_role;

COMMIT;
