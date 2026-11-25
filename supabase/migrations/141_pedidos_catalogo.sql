-- ============================================================================
-- 141 — Pedidos del catálogo en línea (Pro y Premium)
-- ============================================================================
-- Hasta hoy el catálogo (124-125) no guardaba nada: el cliente armaba un carrito y se abría WhatsApp. Esto
-- guarda el pedido para que el negocio le dé seguimiento por estados, baje el stock al confirmar y avise al
-- cliente. Es la PRIMERA escritura anónima del catálogo, así que sigue el patrón del alta con QR de lealtad
-- (121):
--
--   * `crear_pedido_publico` es SOLO de service_role. La única puerta es `POST /api/catalogo/[slug]/pedido`,
--     que valida rate limit, honeypot y Turnstile antes de llamarla. `anon` no la puede llamar saltándose el
--     captcha y NO tiene acceso a las tablas.
--   * Los precios se RECALCULAN aquí con `_catalogo_productos` (nunca se confía en el cliente) y solo entran
--     productos visibles, no archivados, no ocultos y disponibles.
--   * Topes: 50 renglones, cantidad ≤ 9,999, 100 pedidos por día y negocio (hora CDMX), 5 pedidos «nuevos»
--     por celular. Demos y cuentas en solo lectura no reciben pedidos. Sin el plan (`pedidos`, migración 140)
--     tampoco.
--   * `pedido_publico(codigo)` (anon, para la página de seguimiento) solo devuelve folio, estado, renglones,
--     total y nombre del negocio: nunca teléfono, dirección ni notas.
--
-- Stock y dinero: «Confirmar» crea una VENTA real con el motor de siempre (`_crear_venta_desde_items`: stock
-- por sucursal, lotes FEFO, candados ordenados por id). Un pedido = una venta (`venta_id` único). Si el precio
-- del POS difiere del que vio el cliente (precio especial del catálogo, cambios de precio), la confirmación
-- se REVIERTE entera con `diferencia_de_precio` hasta que el negocio la acepte: nada queda a medias. Cancelar un
-- pedido confirmado usa `_cancelar_venta` (regresa stock, lotes y caja como «Cancelar venta», 137).
--
-- Aditiva: tablas y columna con default; `recibir_pedidos` nace apagado, así que ningún catálogo cambia hasta
-- que su dueño lo active. Todas las escrituras van por funciones SECURITY DEFINER (lección de la 138):
-- `authenticated` solo lee.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Permiso `orders.manage` (SUPER_ADMIN y ORG_ADMIN; concedible a un cajero)
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, 'orders.manage'
FROM (VALUES ('SUPER_ADMIN'::public.app_role), ('ORG_ADMIN'::public.app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role AND rp.permission = 'orders.manage'
);

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
    'catalog.manage',
    'orders.manage'
  ]));

-- ---------------------------------------------------------------------------
-- 2. Interruptor del catálogo: «Recibir pedidos en la página» (apagado de fábrica)
-- ---------------------------------------------------------------------------
ALTER TABLE public.catalogos_en_linea
  ADD COLUMN IF NOT EXISTS recibir_pedidos boolean NOT NULL DEFAULT false;

-- ---------------------------------------------------------------------------
-- 3. Tablas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedidos_catalogo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  folio integer NOT NULL,
  codigo_seguimiento text NOT NULL,
  cliente_nombre text NOT NULL,
  cliente_telefono text NOT NULL,
  entrega text NOT NULL,
  direccion text,
  nota text,
  estado text NOT NULL DEFAULT 'nuevo',
  pagado boolean NOT NULL DEFAULT false,
  metodo_pago public.metodo_pago,
  total numeric(12,2) NOT NULL,
  cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  sucursal_id uuid REFERENCES public.sucursales(id) ON DELETE SET NULL,
  venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  acepto_aviso_en timestamptz,
  creado_en timestamptz NOT NULL DEFAULT now(),
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedidos_catalogo_folio_key UNIQUE (tenant_id, folio),
  CONSTRAINT pedidos_catalogo_codigo_key UNIQUE (codigo_seguimiento),
  CONSTRAINT pedidos_catalogo_venta_key UNIQUE (venta_id),
  CONSTRAINT pedidos_catalogo_entrega_check CHECK (entrega IN ('recoger', 'domicilio')),
  CONSTRAINT pedidos_catalogo_estado_check CHECK (estado IN (
    'nuevo', 'confirmado', 'pago', 'en_produccion', 'listo', 'en_camino', 'entregado', 'cancelado'
  )),
  CONSTRAINT pedidos_catalogo_codigo_formato CHECK (codigo_seguimiento ~ '^[23456789ABCDEFGHJKMNPQRSTVWXYZ]{12}$'),
  CONSTRAINT pedidos_catalogo_total_check CHECK (total >= 0),
  CONSTRAINT pedidos_catalogo_direccion_check CHECK (direccion IS NULL OR length(direccion) <= 200),
  CONSTRAINT pedidos_catalogo_nota_check CHECK (nota IS NULL OR length(nota) <= 300)
);

CREATE TABLE IF NOT EXISTS public.pedido_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_catalogo(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id uuid REFERENCES public.productos(id) ON DELETE SET NULL,
  variante_id uuid REFERENCES public.variantes_producto(id) ON DELETE SET NULL,
  nombre text NOT NULL,
  variante text,
  unidad text,
  cantidad numeric(10,3) NOT NULL,
  precio_unitario numeric(12,2) NOT NULL,
  CONSTRAINT pedido_items_cantidad_check CHECK (cantidad > 0 AND cantidad <= 9999),
  CONSTRAINT pedido_items_precio_check CHECK (precio_unitario >= 0)
);

CREATE TABLE IF NOT EXISTS public.pedido_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id uuid NOT NULL REFERENCES public.pedidos_catalogo(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  estado text NOT NULL,
  usuario_id uuid,
  nota text,
  creado_en timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pedidos_catalogo_tenant_creado_idx ON public.pedidos_catalogo (tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS pedidos_catalogo_tenant_estado_idx ON public.pedidos_catalogo (tenant_id, estado);
CREATE INDEX IF NOT EXISTS pedidos_catalogo_cliente_idx ON public.pedidos_catalogo (cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedidos_catalogo_sucursal_idx ON public.pedidos_catalogo (sucursal_id) WHERE sucursal_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedido_items_pedido_idx ON public.pedido_items (pedido_id);
CREATE INDEX IF NOT EXISTS pedido_items_tenant_idx ON public.pedido_items (tenant_id);
CREATE INDEX IF NOT EXISTS pedido_items_producto_idx ON public.pedido_items (producto_id) WHERE producto_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedido_items_variante_idx ON public.pedido_items (variante_id) WHERE variante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedido_eventos_pedido_idx ON public.pedido_eventos (pedido_id, creado_en);
CREATE INDEX IF NOT EXISTS pedido_eventos_tenant_idx ON public.pedido_eventos (tenant_id);

-- ---------------------------------------------------------------------------
-- 4. RLS: authenticated SOLO lee (con orders.manage); anon no toca nada
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pedidos_catalogo_select ON public.pedidos_catalogo;
CREATE POLICY pedidos_catalogo_select ON public.pedidos_catalogo
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('orders.manage')));

DROP POLICY IF EXISTS pedido_items_select ON public.pedido_items;
CREATE POLICY pedido_items_select ON public.pedido_items
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('orders.manage')));

DROP POLICY IF EXISTS pedido_eventos_select ON public.pedido_eventos;
CREATE POLICY pedido_eventos_select ON public.pedido_eventos
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('orders.manage')));

REVOKE ALL ON public.pedidos_catalogo, public.pedido_items, public.pedido_eventos FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pedidos_catalogo, public.pedido_items, public.pedido_eventos TO authenticated;
GRANT ALL ON public.pedidos_catalogo, public.pedido_items, public.pedido_eventos TO service_role;

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.pedidos_catalogo;
CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR UPDATE OR DELETE ON public.pedidos_catalogo
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

-- ---------------------------------------------------------------------------
-- 5. Plan: no se puede encender «recibir pedidos» sin el plan (Básico)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._plan_permite_pedidos(p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce((public.plan_funciones(p_tenant_id) ->> 'pedidos'), 'true') <> 'false';
$$;

REVOKE ALL ON FUNCTION public._plan_permite_pedidos(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._plan_permite_pedidos(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public._plan_exige_pedidos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.recibir_pedidos AND (TG_OP = 'INSERT' OR NOT OLD.recibir_pedidos) THEN
    IF NOT public._plan_permite_pedidos(NEW.tenant_id) THEN
      RAISE EXCEPTION 'plan_sin_pedidos' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._plan_exige_pedidos() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_plan_pedidos ON public.catalogos_en_linea;
CREATE TRIGGER trg_plan_pedidos BEFORE INSERT OR UPDATE ON public.catalogos_en_linea
  FOR EACH ROW EXECUTE FUNCTION public._plan_exige_pedidos();

-- ---------------------------------------------------------------------------
-- 6. Aviso en la campana: pedido nuevo
-- ---------------------------------------------------------------------------
ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones
  ADD CONSTRAINT notificaciones_tipo_check
  CHECK (tipo = ANY (ARRAY[
    'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto', 'compra', 'orden_compra', 'ajuste', 'traspaso',
    'lote_por_caducar', 'lote_caducado', 'lote', 'insumo_faltante', 'lealtad_alta', 'novedad', 'venta_cancelada',
    'pedido_nuevo'
  ]));

-- ---------------------------------------------------------------------------
-- 7. Crear un pedido desde el catálogo público (SOLO service_role)
-- ---------------------------------------------------------------------------
-- p_items: [{"producto_id": uuid, "variante_id": uuid|null, "cantidad": numeric}]
CREATE OR REPLACE FUNCTION public.crear_pedido_publico(
  p_slug text,
  p_nombre text,
  p_telefono text,
  p_entrega text,
  p_direccion text,
  p_nota text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  c_tope_diario CONSTANT integer := 100;
  c_tope_nuevos_por_celular CONSTANT integer := 5;
  v_cat public.catalogos_en_linea%ROWTYPE;
  v_nombre text := btrim(regexp_replace(coalesce(p_nombre, ''), '\s+', ' ', 'g'));
  v_telefono text := btrim(coalesce(p_telefono, ''));
  v_digitos text := right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 10);
  v_direccion text := NULLIF(btrim(regexp_replace(coalesce(p_direccion, ''), '[[:cntrl:]]+', ' ', 'g')), '');
  v_nota text := NULLIF(btrim(regexp_replace(coalesce(p_nota, ''), '[[:cntrl:]]+', ' ', 'g')), '');
  v_inicio_dia timestamptz := date_trunc('day', now() AT TIME ZONE 'America/Mexico_City') AT TIME ZONE 'America/Mexico_City';
  v_n integer;
  v_pedidos_hoy integer;
  v_nuevos integer;
  v_resueltos integer;
  v_total numeric(12,2);
  v_folio integer;
  v_pedido_id uuid;
  v_codigo text;
BEGIN
  IF length(v_nombre) NOT BETWEEN 2 AND 60 OR v_nombre ~* '(https?:|www\.|[<>/@])' THEN
    RAISE EXCEPTION 'Escribe tu nombre (de 2 a 60 letras)';
  END IF;
  IF v_telefono !~ '^\+[0-9]{8,15}$' OR length(v_digitos) < 10 THEN
    RAISE EXCEPTION 'Revisa tu numero de celular';
  END IF;
  IF p_entrega NOT IN ('recoger', 'domicilio') THEN
    RAISE EXCEPTION 'Elige si recoges o te lo llevan';
  END IF;
  IF p_entrega = 'domicilio' THEN
    IF v_direccion IS NULL OR length(v_direccion) NOT BETWEEN 5 AND 200 THEN
      RAISE EXCEPTION 'Escribe tu direccion de entrega';
    END IF;
  ELSE
    v_direccion := NULL;
  END IF;
  IF v_nota IS NOT NULL AND length(v_nota) > 300 THEN
    RAISE EXCEPTION 'La nota es demasiado larga';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Tu pedido esta vacio o es demasiado grande';
  END IF;

  -- Bloqueado: dos pedidos al mismo tiempo no se saltan el tope diario y el folio no se repite.
  SELECT * INTO v_cat FROM public.catalogos_en_linea
  WHERE slug = lower(btrim(coalesce(p_slug, ''))) FOR UPDATE;
  IF v_cat.tenant_id IS NULL OR NOT v_cat.activo OR NOT v_cat.recibir_pedidos THEN
    RAISE EXCEPTION 'Este catalogo no recibe pedidos';
  END IF;
  IF EXISTS (SELECT 1 FROM public.tenants t WHERE t.id = v_cat.tenant_id AND t.demo_expira_en IS NOT NULL)
     OR coalesce(public.acceso_tenant(v_cat.tenant_id), 'solo_lectura') = 'solo_lectura'
     OR NOT public._plan_permite_pedidos(v_cat.tenant_id) THEN
    RAISE EXCEPTION 'Los pedidos no estan disponibles por ahora';
  END IF;

  SELECT count(*) INTO v_pedidos_hoy FROM public.pedidos_catalogo
  WHERE tenant_id = v_cat.tenant_id AND creado_en >= v_inicio_dia;
  IF v_pedidos_hoy >= c_tope_diario THEN
    RAISE EXCEPTION 'Hoy ya no se pueden recibir mas pedidos aqui';
  END IF;
  SELECT count(*) INTO v_nuevos FROM public.pedidos_catalogo
  WHERE tenant_id = v_cat.tenant_id AND estado = 'nuevo'
    AND right(regexp_replace(cliente_telefono, '\D', '', 'g'), 10) = v_digitos;
  IF v_nuevos >= c_tope_nuevos_por_celular THEN
    RAISE EXCEPTION 'Ya tienes pedidos esperando confirmacion con este celular';
  END IF;

  -- Renglones: se agrupan por producto/variante y se resuelven contra el catalogo PUBLICO (visible, no archivado,
  -- no oculto, disponible). El precio sale de aqui, nunca del cliente.
  DROP TABLE IF EXISTS pg_temp._pedido_lineas;
  CREATE TEMP TABLE _pedido_lineas (
    producto_id uuid NOT NULL,
    variante_id uuid,
    cantidad numeric(10,3) NOT NULL,
    nombre text,
    variante text,
    unidad text,
    precio numeric(12,2)
  ) ON COMMIT DROP;

  INSERT INTO pg_temp._pedido_lineas (producto_id, variante_id, cantidad)
  SELECT (e->>'producto_id')::uuid, NULLIF(e->>'variante_id', '')::uuid, round(sum((e->>'cantidad')::numeric), 3)
  FROM jsonb_array_elements(p_items) e
  GROUP BY 1, 2;

  IF EXISTS (SELECT 1 FROM pg_temp._pedido_lineas WHERE cantidad <= 0 OR cantidad > 9999) THEN
    RAISE EXCEPTION 'Revisa las cantidades de tu pedido';
  END IF;
  SELECT count(*) INTO v_n FROM pg_temp._pedido_lineas;

  UPDATE pg_temp._pedido_lineas l
  SET nombre = r.nombre, variante = r.etiqueta, unidad = r.unidad, precio = r.precio
  FROM (
    SELECT l2.producto_id, l2.variante_id,
           cp.nombre,
           vv.v ->> 'etiqueta' AS etiqueta,
           coalesce(vv.v ->> 'unidad_medida', cp.unidad_medida) AS unidad,
           CASE WHEN l2.variante_id IS NOT NULL THEN (vv.v ->> 'precio')::numeric
                ELSE coalesce(cp.precio_especial, cp.precio_min) END AS precio
    FROM pg_temp._pedido_lineas l2
    JOIN public._catalogo_productos(v_cat.tenant_id) cp ON cp.id = l2.producto_id
    LEFT JOIN LATERAL (
      SELECT x AS v FROM jsonb_array_elements(cp.variantes) x
      WHERE l2.variante_id IS NOT NULL AND (x ->> 'id')::uuid = l2.variante_id
      LIMIT 1
    ) vv ON true
    WHERE
      -- con variantes se exige una variante valida; sin variantes, ninguna
      ((jsonb_array_length(cp.variantes) > 0 AND l2.variante_id IS NOT NULL AND vv.v IS NOT NULL)
       OR (jsonb_array_length(cp.variantes) = 0 AND l2.variante_id IS NULL))
      AND (CASE WHEN l2.variante_id IS NOT NULL THEN coalesce((vv.v ->> 'disponible')::boolean, false)
                ELSE cp.disponible END)
  ) r
  WHERE l.producto_id = r.producto_id AND l.variante_id IS NOT DISTINCT FROM r.variante_id;

  SELECT count(*) INTO v_resueltos FROM pg_temp._pedido_lineas WHERE precio IS NOT NULL;
  IF v_resueltos <> v_n THEN
    RAISE EXCEPTION 'Hay productos de tu pedido que ya no estan disponibles';
  END IF;

  SELECT round(sum(precio * cantidad), 2) INTO v_total FROM pg_temp._pedido_lineas;

  SELECT coalesce(max(folio), 0) + 1 INTO v_folio FROM public.pedidos_catalogo WHERE tenant_id = v_cat.tenant_id;

  FOR i IN 1..5 LOOP
    EXIT WHEN v_pedido_id IS NOT NULL;
    BEGIN
      INSERT INTO public.pedidos_catalogo (
        tenant_id, folio, codigo_seguimiento, cliente_nombre, cliente_telefono, entrega, direccion, nota,
        total, acepto_aviso_en
      ) VALUES (
        v_cat.tenant_id, v_folio, public._codigo_tarjeta_lealtad(), v_nombre, v_telefono, p_entrega, v_direccion,
        v_nota, v_total, now()
      ) RETURNING id, codigo_seguimiento INTO v_pedido_id, v_codigo;
    EXCEPTION WHEN unique_violation THEN
      v_pedido_id := NULL;
    END;
  END LOOP;
  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo guardar el pedido, intenta de nuevo';
  END IF;

  INSERT INTO public.pedido_items (pedido_id, tenant_id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio_unitario)
  SELECT v_pedido_id, v_cat.tenant_id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio
  FROM pg_temp._pedido_lineas;

  INSERT INTO public.pedido_eventos (pedido_id, tenant_id, estado) VALUES (v_pedido_id, v_cat.tenant_id, 'nuevo');

  -- Un aviso nunca puede tumbar un pedido.
  BEGIN
    IF public._notif_tenant_activo(v_cat.tenant_id) THEN
      INSERT INTO public.notificaciones (tenant_id, tipo, titulo, mensaje, enlace, permiso, entidad_id, datos)
      VALUES (
        v_cat.tenant_id, 'pedido_nuevo',
        format('Nuevo pedido #%s de %s', v_folio, split_part(v_nombre, ' ', 1)),
        CASE p_entrega WHEN 'domicilio' THEN 'A domicilio' ELSE 'Para recoger' END,
        '/orders', 'orders.manage', v_pedido_id,
        jsonb_build_object('folio', v_folio, 'total', v_total)
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'crear_pedido_publico: aviso no creado: %', SQLERRM;
  END;

  RETURN jsonb_build_object('folio', v_folio, 'codigo_seguimiento', v_codigo, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.crear_pedido_publico(text, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.crear_pedido_publico(text, text, text, text, text, text, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- 8. Seguimiento público: SOLO lo que se pinta (sin teléfono, dirección ni notas)
-- ---------------------------------------------------------------------------
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

REVOKE ALL ON FUNCTION public.pedido_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pedido_publico(text) TO anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Acciones del negocio (authenticated, permiso orders.manage)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pedido_para_gestionar(p_id uuid)
RETURNS public.pedidos_catalogo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido public.pedidos_catalogo%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO v_pedido FROM public.pedidos_catalogo WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = v_pedido.tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;
  IF NOT public.authorize('orders.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar pedidos';
  END IF;
  IF NOT public._plan_permite_pedidos(v_pedido.tenant_id) THEN
    RAISE EXCEPTION 'plan_sin_pedidos' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_pedido;
END;
$$;

REVOKE ALL ON FUNCTION public._pedido_para_gestionar(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._pedido_para_gestionar(uuid) TO service_role;

-- Avanzar un pedido ya confirmado: pago -> en_produccion -> listo -> en_camino -> entregado. Se puede saltar
-- lo que no aplique y corregir hacia atras entre estos; `nuevo`, `confirmado` y `cancelado` tienen su propia
-- funcion (mueven stock) y `entregado`/`cancelado` son finales.
CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(p_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
BEGIN
  IF p_estado NOT IN ('pago', 'en_produccion', 'listo', 'en_camino', 'entregado') THEN
    RAISE EXCEPTION 'Estado no permitido';
  END IF;
  v_pedido := public._pedido_para_gestionar(p_id);
  IF v_pedido.estado IN ('nuevo', 'cancelado', 'entregado') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede mover a ese estado';
  END IF;
  IF p_estado = 'en_camino' AND v_pedido.entrega = 'recoger' THEN
    RAISE EXCEPTION 'Este pedido es para recoger, no sale a domicilio';
  END IF;

  UPDATE public.pedidos_catalogo
  SET estado = p_estado,
      pagado = pagado OR p_estado = 'pago',
      actualizado_en = now()
  WHERE id = p_id;
  INSERT INTO public.pedido_eventos (pedido_id, tenant_id, estado, usuario_id)
  VALUES (p_id, v_pedido.tenant_id, p_estado, auth.uid());

  RETURN jsonb_build_object('id', p_id, 'estado', p_estado);
END;
$$;

REVOKE ALL ON FUNCTION public.cambiar_estado_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cambiar_estado_pedido(uuid, text) TO authenticated, service_role;

-- Confirmar = crear la venta (el stock baja aqui). Si el total del POS no coincide con el del pedido y el negocio
-- no lo ha aceptado, se lanza `diferencia_de_precio:<pedido>:<venta>` y TODO se revierte (no queda venta, stock
-- ni cliente a medias): sirve de ensayo.
CREATE OR REPLACE FUNCTION public.confirmar_pedido(
  p_id uuid,
  p_metodo_pago public.metodo_pago,
  p_acepta_diferencia boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_items jsonb;
  v_sin_producto integer;
  v_cliente_id uuid;
  v_digitos text;
  v_venta jsonb;
  v_venta_id uuid;
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  IF NOT public.authorize('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;
  IF coalesce(public.acceso_tenant(v_pedido.tenant_id), 'solo_lectura') = 'solo_lectura' THEN
    RAISE EXCEPTION 'Tu cuenta esta en solo lectura. Reactiva tu plan para confirmar pedidos.';
  END IF;

  -- Reintento o doble clic: la venta ya existe, no se crea otra.
  IF v_pedido.venta_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', p_id, 'venta_id', v_pedido.venta_id, 'ya_confirmado', true);
  END IF;
  IF v_pedido.estado <> 'nuevo' THEN
    RAISE EXCEPTION 'Solo se puede confirmar un pedido nuevo';
  END IF;
  IF p_metodo_pago NOT IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'Elige efectivo, tarjeta o transferencia';
  END IF;

  SELECT count(*) FILTER (WHERE producto_id IS NULL),
         jsonb_agg(jsonb_build_object(
           'productId', producto_id, 'varianteId', variante_id, 'cantidad', cantidad
         ))
  INTO v_sin_producto, v_items
  FROM public.pedido_items WHERE pedido_id = p_id;
  IF v_items IS NULL OR v_sin_producto > 0 THEN
    RAISE EXCEPTION 'Un producto del pedido ya no existe en tu catalogo';
  END IF;

  -- Cliente: el mismo celular (ultimos 10 digitos) o uno nuevo.
  v_digitos := right(regexp_replace(v_pedido.cliente_telefono, '\D', '', 'g'), 10);
  SELECT c.id INTO v_cliente_id FROM public.clientes c
  WHERE c.tenant_id = v_pedido.tenant_id
    AND right(regexp_replace(coalesce(c.telefono, ''), '\D', '', 'g'), 10) = v_digitos
  ORDER BY c.creado_en LIMIT 1;
  IF v_cliente_id IS NULL THEN
    INSERT INTO public.clientes (tenant_id, nombre, telefono, direccion)
    VALUES (v_pedido.tenant_id, v_pedido.cliente_nombre, v_pedido.cliente_telefono, v_pedido.direccion)
    RETURNING id INTO v_cliente_id;
  END IF;

  v_venta := public._crear_venta_desde_items(
    p_tenant_id => v_pedido.tenant_id,
    p_usuario_id => v_uid,
    p_cliente_id => v_cliente_id,
    p_metodo_pago => p_metodo_pago,
    p_items => v_items,
    p_include_iva => false,
    p_notas => 'Pedido #' || v_pedido.folio || ' del catalogo en linea',
    p_idempotency_key => v_pedido.id
  );
  v_venta_id := (v_venta ->> 'id')::uuid;

  IF NOT p_acepta_diferencia AND abs((v_venta ->> 'total')::numeric - v_pedido.total) > 0.01 THEN
    RAISE EXCEPTION 'diferencia_de_precio:%:%', v_pedido.total, (v_venta ->> 'total')::numeric
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.pedidos_catalogo
  SET estado = 'confirmado', venta_id = v_venta_id, cliente_id = v_cliente_id,
      sucursal_id = (v_venta ->> 'sucursal_id')::uuid, metodo_pago = p_metodo_pago, actualizado_en = now()
  WHERE id = p_id;
  INSERT INTO public.pedido_eventos (pedido_id, tenant_id, estado, usuario_id)
  VALUES (p_id, v_pedido.tenant_id, 'confirmado', v_uid);

  RETURN jsonb_build_object('id', p_id, 'venta_id', v_venta_id, 'total', (v_venta ->> 'total')::numeric);
END;
$$;

REVOKE ALL ON FUNCTION public.confirmar_pedido(uuid, public.metodo_pago, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confirmar_pedido(uuid, public.metodo_pago, boolean) TO authenticated, service_role;

-- Cancelar: antes de confirmar solo cambia el estado; despues cancela la venta (regresa stock, lotes y caja).
CREATE OR REPLACE FUNCTION public.cancelar_pedido(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_motivo text := NULLIF(btrim(p_motivo), '');
  v_resultado jsonb := '{}'::jsonb;
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Escribe el motivo de la cancelacion';
  END IF;
  IF length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo es demasiado largo (maximo 300 caracteres)';
  END IF;
  IF v_pedido.estado IN ('cancelado', 'entregado') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede cancelar';
  END IF;

  IF v_pedido.venta_id IS NOT NULL THEN
    PERFORM public._puede_cancelar_venta(v_pedido.venta_id);
    v_resultado := public._cancelar_venta(v_pedido.venta_id, 'Pedido #' || v_pedido.folio || ': ' || v_motivo, auth.uid());
  END IF;

  UPDATE public.pedidos_catalogo SET estado = 'cancelado', actualizado_en = now() WHERE id = p_id;
  INSERT INTO public.pedido_eventos (pedido_id, tenant_id, estado, usuario_id, nota)
  VALUES (p_id, v_pedido.tenant_id, 'cancelado', auth.uid(), v_motivo);

  RETURN jsonb_build_object('id', p_id, 'venta', v_resultado);
END;
$$;

REVOKE ALL ON FUNCTION public.cancelar_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid, text) TO authenticated, service_role;
