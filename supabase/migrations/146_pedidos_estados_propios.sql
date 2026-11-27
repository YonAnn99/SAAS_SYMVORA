-- ============================================================================
-- 146 — Pedidos al estilo Kyte: estados propios, pago aparte, editar, mensajes y pedidos desde el POS
-- ============================================================================
-- Sigue a la 141-145. ADITIVA en lo que toca datos: columnas nuevas con default o NULL, tabla nueva, y un cambio
-- controlado del CHECK de `pedidos_catalogo.estado` (los 4 estados viejos de avance pasan a `en_curso`, antes de
-- cambiar el CHECK, con su nombre guardado).
--
--   * `pedido_estados`: estados que el negocio crea/edita/desactiva. Cada uno apunta a un ESTADO BASE del motor
--     (`confirmado` | `en_curso` | `entregado` | `cancelado`). El motor (stock, caja, cancelación) solo mira la base.
--   * `pedidos_catalogo.estado` queda como estado BASE; `estado_id`, `estado_nombre` y `estado_color` son lo que se ve.
--   * La VENTA (stock + caja) ya no se registra al confirmar: se registra al marcar PAGADO (`registrar_pago_pedido`).
--     «Aceptar» (`aceptar_pedido`) solo verifica existencias con un ensayo que se deshace.
--   * Funciones NUEVAS (nombres distintos, sin overloads). Las viejas (`confirmar_pedido`, `cambiar_estado_pedido`)
--     responden un mensaje claro para pestañas abiertas con el código anterior.
--   * RLS: lectura con `orders.manage`; toda escritura por funciones SECURITY DEFINER (regla de la 138).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Estados propios del negocio
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pedido_estados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  color text NOT NULL DEFAULT '#1E3A8A',
  base text NOT NULL,
  aplica_a text NOT NULL DEFAULT 'ambos',
  orden integer NOT NULL DEFAULT 0,
  activo boolean NOT NULL DEFAULT true,
  es_sistema boolean NOT NULL DEFAULT false,
  creado_en timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pedido_estados_nombre_check CHECK (length(btrim(nombre)) BETWEEN 1 AND 30),
  CONSTRAINT pedido_estados_color_check CHECK (color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT pedido_estados_base_check CHECK (base IN ('confirmado', 'en_curso', 'entregado', 'cancelado')),
  CONSTRAINT pedido_estados_aplica_check CHECK (aplica_a IN ('ambos', 'recoger', 'domicilio'))
);
CREATE UNIQUE INDEX IF NOT EXISTS pedido_estados_nombre_key ON public.pedido_estados (tenant_id, lower(nombre));
CREATE INDEX IF NOT EXISTS pedido_estados_tenant_idx ON public.pedido_estados (tenant_id, orden);

ALTER TABLE public.pedido_estados ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS pedido_estados_select ON public.pedido_estados;
CREATE POLICY pedido_estados_select ON public.pedido_estados
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()) AND (SELECT public.authorize('orders.manage')));

REVOKE ALL ON public.pedido_estados FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.pedido_estados TO authenticated;
GRANT ALL ON public.pedido_estados TO service_role;

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.pedido_estados;
CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR UPDATE OR DELETE ON public.pedido_estados
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

-- ---------------------------------------------------------------------------
-- 2. Columnas nuevas de pedidos, eventos y catálogo
-- ---------------------------------------------------------------------------
ALTER TABLE public.pedidos_catalogo
  ADD COLUMN IF NOT EXISTS estado_id uuid REFERENCES public.pedido_estados(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS estado_nombre text,
  ADD COLUMN IF NOT EXISTS estado_color text,
  ADD COLUMN IF NOT EXISTS pagado_en timestamptz,
  ADD COLUMN IF NOT EXISTS mensaje_cliente text,
  ADD COLUMN IF NOT EXISTS nota_interna text,
  ADD COLUMN IF NOT EXISTS origen text NOT NULL DEFAULT 'catalogo',
  ADD COLUMN IF NOT EXISTS actualizado_por uuid;

-- Los pedidos del mostrador no traen celular.
ALTER TABLE public.pedidos_catalogo ALTER COLUMN cliente_telefono DROP NOT NULL;
ALTER TABLE public.pedidos_catalogo ALTER COLUMN codigo_seguimiento DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_catalogo_origen_check') THEN
    ALTER TABLE public.pedidos_catalogo
      ADD CONSTRAINT pedidos_catalogo_origen_check CHECK (origen IN ('catalogo', 'pos'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedidos_catalogo_mensajes_check') THEN
    ALTER TABLE public.pedidos_catalogo
      ADD CONSTRAINT pedidos_catalogo_mensajes_check CHECK (
        (mensaje_cliente IS NULL OR length(mensaje_cliente) <= 300)
        AND (nota_interna IS NULL OR length(nota_interna) <= 300)
      );
  END IF;
END;
$$;

ALTER TABLE public.pedido_eventos
  ADD COLUMN IF NOT EXISTS etiqueta text,
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'estado';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pedido_eventos_tipo_check') THEN
    ALTER TABLE public.pedido_eventos
      ADD CONSTRAINT pedido_eventos_tipo_check CHECK (tipo IN ('estado', 'pago', 'edicion', 'mensaje'));
  END IF;
END;
$$;

ALTER TABLE public.catalogos_en_linea
  ADD COLUMN IF NOT EXISTS plazo_retiro_dias integer;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'catalogos_plazo_retiro_check') THEN
    ALTER TABLE public.catalogos_en_linea
      ADD CONSTRAINT catalogos_plazo_retiro_check CHECK (plazo_retiro_dias IS NULL OR plazo_retiro_dias BETWEEN 1 AND 30);
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Migrar los estados viejos al estado base `en_curso` (antes de cambiar el CHECK)
-- ---------------------------------------------------------------------------
UPDATE public.pedidos_catalogo SET estado_nombre = 'Pagado', estado = 'en_curso'
  WHERE estado = 'pago' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'En preparación', estado = 'en_curso'
  WHERE estado = 'en_produccion' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'Listo', estado = 'en_curso'
  WHERE estado = 'listo' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'En camino', estado = 'en_curso'
  WHERE estado = 'en_camino' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'Pedido recibido' WHERE estado = 'nuevo' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'Confirmado' WHERE estado = 'confirmado' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'Entregado' WHERE estado = 'entregado' AND estado_nombre IS NULL;
UPDATE public.pedidos_catalogo SET estado_nombre = 'Cancelado' WHERE estado = 'cancelado' AND estado_nombre IS NULL;
-- Los pedidos que ya llegaron a pagar (estado viejo `pago` o con venta) quedan marcados como pagados.
UPDATE public.pedidos_catalogo SET pagado = true WHERE venta_id IS NOT NULL OR estado_nombre = 'Pagado';

-- La línea de tiempo vieja muestra su etiqueta en español (los eventos anteriores no la traían).
UPDATE public.pedido_eventos SET etiqueta = CASE estado
    WHEN 'nuevo' THEN 'Pedido recibido' WHEN 'confirmado' THEN 'Confirmado' WHEN 'pago' THEN 'Pagado'
    WHEN 'en_produccion' THEN 'En preparación' WHEN 'listo' THEN 'Listo' WHEN 'en_camino' THEN 'En camino'
    WHEN 'entregado' THEN 'Entregado' WHEN 'cancelado' THEN 'Cancelado' ELSE estado END
  WHERE etiqueta IS NULL;

ALTER TABLE public.pedidos_catalogo DROP CONSTRAINT IF EXISTS pedidos_catalogo_estado_check;
ALTER TABLE public.pedidos_catalogo
  ADD CONSTRAINT pedidos_catalogo_estado_check CHECK (estado IN ('nuevo', 'confirmado', 'en_curso', 'entregado', 'cancelado'));

-- ---------------------------------------------------------------------------
-- 4. Ayudantes internos
-- ---------------------------------------------------------------------------
-- Quién puede gestionar pedidos de este negocio: sesión, membresía, permiso y plan. Se llama antes de cada escritura.
CREATE OR REPLACE FUNCTION public._pedido_gestion_tenant(p_tenant uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.tenant_id = p_tenant AND tm.user_id = v_uid) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;
  IF NOT public.authorize('orders.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para gestionar pedidos';
  END IF;
  IF NOT public._plan_permite_pedidos(p_tenant) THEN
    RAISE EXCEPTION 'plan_sin_pedidos' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public._pedido_gestion_tenant(uuid) FROM PUBLIC, anon, authenticated;

-- Estados por defecto de un negocio (la primera vez que abre el módulo). Idempotente.
CREATE OR REPLACE FUNCTION public.sembrar_estados_pedido(p_tenant uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_n integer;
BEGIN
  PERFORM public._pedido_gestion_tenant(p_tenant);
  INSERT INTO public.pedido_estados (tenant_id, nombre, color, base, aplica_a, orden, es_sistema)
  SELECT p_tenant, d.nombre, d.color, d.base, d.aplica_a, d.orden, d.es_sistema
  FROM (VALUES
    ('Confirmado', '#0D9488', 'confirmado', 'ambos', 10, true),
    ('En preparación', '#CA8A04', 'en_curso', 'ambos', 20, false),
    ('Listo para retirar', '#2563EB', 'en_curso', 'recoger', 30, false),
    ('En camino', '#7C3AED', 'en_curso', 'domicilio', 40, false),
    ('Entregado', '#16A34A', 'entregado', 'ambos', 50, true),
    ('Cancelado', '#DB2777', 'cancelado', 'ambos', 60, true)
  ) AS d(nombre, color, base, aplica_a, orden, es_sistema)
  WHERE NOT EXISTS (SELECT 1 FROM public.pedido_estados e WHERE e.tenant_id = p_tenant)
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.sembrar_estados_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sembrar_estados_pedido(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Administrar estados (crear, editar, reordenar, eliminar)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardar_estado_pedido(
  p_tenant uuid,
  p_id uuid,
  p_nombre text,
  p_color text,
  p_base text,
  p_aplica_a text,
  p_activo boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_fila public.pedido_estados%ROWTYPE;
  v_sistema boolean;
BEGIN
  PERFORM public._pedido_gestion_tenant(p_tenant);
  IF length(v_nombre) NOT BETWEEN 1 AND 30 THEN
    RAISE EXCEPTION 'El nombre del estado va de 1 a 30 letras';
  END IF;
  IF p_color IS NULL OR p_color !~ '^#[0-9A-Fa-f]{6}$' THEN
    RAISE EXCEPTION 'Elige un color válido';
  END IF;
  IF p_base NOT IN ('confirmado', 'en_curso', 'entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Estado base no válido';
  END IF;
  IF p_aplica_a NOT IN ('ambos', 'recoger', 'domicilio') THEN
    RAISE EXCEPTION 'Elige a qué tipo de pedido aplica';
  END IF;

  IF p_id IS NULL THEN
    IF (SELECT count(*) FROM public.pedido_estados WHERE tenant_id = p_tenant) >= 15 THEN
      RAISE EXCEPTION 'Máximo 15 estados por negocio';
    END IF;
    INSERT INTO public.pedido_estados (tenant_id, nombre, color, base, aplica_a, orden, activo)
    VALUES (p_tenant, v_nombre, p_color, p_base, p_aplica_a,
            coalesce((SELECT max(orden) FROM public.pedido_estados WHERE tenant_id = p_tenant), 0) + 10, p_activo)
    RETURNING * INTO v_fila;
  ELSE
    SELECT * INTO v_fila FROM public.pedido_estados WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Estado no encontrado';
    END IF;
    v_sistema := v_fila.es_sistema;
    IF v_sistema AND (p_base <> v_fila.base OR p_aplica_a <> v_fila.aplica_a OR NOT p_activo) THEN
      RAISE EXCEPTION 'Este estado es del sistema: puedes cambiarle nombre y color, no su función ni desactivarlo';
    END IF;
    UPDATE public.pedido_estados
    SET nombre = v_nombre, color = p_color,
        base = CASE WHEN v_sistema THEN v_fila.base ELSE p_base END,
        aplica_a = CASE WHEN v_sistema THEN v_fila.aplica_a ELSE p_aplica_a END,
        activo = CASE WHEN v_sistema THEN true ELSE p_activo END
    WHERE id = p_id
    RETURNING * INTO v_fila;
  END IF;

  -- Lo que ya se le puso a un pedido conserva su nombre y color (copia en el pedido), así que renombrar no rompe nada.
  RETURN jsonb_build_object('id', v_fila.id, 'nombre', v_fila.nombre, 'color', v_fila.color, 'base', v_fila.base,
                            'aplica_a', v_fila.aplica_a, 'activo', v_fila.activo);
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_estado_pedido(uuid, uuid, text, text, text, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_estado_pedido(uuid, uuid, text, text, text, text, boolean) TO authenticated, service_role;

-- Borra un estado que nadie usa; si ya lo usó algún pedido, solo se desactiva (el historial conserva su nombre).
CREATE OR REPLACE FUNCTION public.eliminar_estado_pedido(p_tenant uuid, p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_fila public.pedido_estados%ROWTYPE;
  v_usado boolean;
BEGIN
  PERFORM public._pedido_gestion_tenant(p_tenant);
  SELECT * INTO v_fila FROM public.pedido_estados WHERE id = p_id AND tenant_id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Estado no encontrado';
  END IF;
  IF v_fila.es_sistema THEN
    RAISE EXCEPTION 'Este estado es del sistema y no se puede borrar';
  END IF;
  SELECT EXISTS (SELECT 1 FROM public.pedidos_catalogo WHERE estado_id = p_id) INTO v_usado;
  IF v_usado THEN
    UPDATE public.pedido_estados SET activo = false WHERE id = p_id;
    RETURN jsonb_build_object('accion', 'desactivado');
  END IF;
  DELETE FROM public.pedido_estados WHERE id = p_id;
  RETURN jsonb_build_object('accion', 'borrado');
END;
$$;
REVOKE ALL ON FUNCTION public.eliminar_estado_pedido(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.eliminar_estado_pedido(uuid, uuid) TO authenticated, service_role;

-- Nuevo orden: `p_ids` en el orden deseado (los que no vengan quedan al final).
CREATE OR REPLACE FUNCTION public.ordenar_estados_pedido(p_tenant uuid, p_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  PERFORM public._pedido_gestion_tenant(p_tenant);
  UPDATE public.pedido_estados e
  SET orden = x.pos * 10
  FROM (SELECT id, ord AS pos FROM unnest(p_ids) WITH ORDINALITY AS u(id, ord)) x
  WHERE e.id = x.id AND e.tenant_id = p_tenant;
END;
$$;
REVOKE ALL ON FUNCTION public.ordenar_estados_pedido(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ordenar_estados_pedido(uuid, uuid[]) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Mover un pedido por sus estados propios (no paga, no mueve stock)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._pedido_para_gestionar(p_id uuid)
RETURNS public.pedidos_catalogo
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
BEGIN
  SELECT * INTO v_pedido FROM public.pedidos_catalogo WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido no encontrado';
  END IF;
  PERFORM public._pedido_gestion_tenant(v_pedido.tenant_id);
  RETURN v_pedido;
END;
$$;
REVOKE ALL ON FUNCTION public._pedido_para_gestionar(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._pedido_evento(
  p_pedido uuid, p_tenant uuid, p_estado text, p_etiqueta text, p_color text, p_tipo text, p_nota text
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  INSERT INTO public.pedido_eventos (pedido_id, tenant_id, estado, usuario_id, nota, etiqueta, color, tipo)
  VALUES (p_pedido, p_tenant, p_estado, auth.uid(), p_nota, p_etiqueta, p_color, p_tipo);
$$;
REVOKE ALL ON FUNCTION public._pedido_evento(uuid, uuid, text, text, text, text, text) FROM PUBLIC, anon, authenticated;

-- Cambia el estado propio de un pedido ya aceptado. Un estado «cancelado» va por `cancelar_pedido`.
CREATE OR REPLACE FUNCTION public.mover_pedido_estado(p_id uuid, p_estado_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_estado public.pedido_estados%ROWTYPE;
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  SELECT * INTO v_estado FROM public.pedido_estados WHERE id = p_estado_id AND tenant_id = v_pedido.tenant_id;
  IF NOT FOUND OR NOT v_estado.activo THEN
    RAISE EXCEPTION 'Ese estado no está disponible';
  END IF;
  IF v_pedido.estado IN ('nuevo', 'cancelado') THEN
    RAISE EXCEPTION 'Primero acepta el pedido';
  END IF;
  IF v_estado.base = 'cancelado' THEN
    RAISE EXCEPTION 'Para cancelar usa la acción de cancelar';
  END IF;
  IF v_estado.aplica_a = 'recoger' AND v_pedido.entrega = 'domicilio' THEN
    RAISE EXCEPTION 'Ese estado es solo para pedidos de recoger';
  END IF;
  IF v_estado.aplica_a = 'domicilio' AND v_pedido.entrega = 'recoger' THEN
    RAISE EXCEPTION 'Ese estado es solo para pedidos a domicilio';
  END IF;

  UPDATE public.pedidos_catalogo
  SET estado = v_estado.base, estado_id = v_estado.id, estado_nombre = v_estado.nombre,
      estado_color = v_estado.color, actualizado_en = now(), actualizado_por = auth.uid()
  WHERE id = p_id;
  PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, v_estado.base, v_estado.nombre, v_estado.color, 'estado', NULL);
  RETURN jsonb_build_object('id', p_id, 'estado', v_estado.nombre);
END;
$$;
REVOKE ALL ON FUNCTION public.mover_pedido_estado(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mover_pedido_estado(uuid, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. Aceptar: valida existencias con un ensayo que se deshace (sin venta, sin stock, sin caja)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.aceptar_pedido(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_estado public.pedido_estados%ROWTYPE;
  v_items jsonb;
  v_ensayo jsonb;
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  IF v_pedido.estado <> 'nuevo' THEN
    RAISE EXCEPTION 'Solo se acepta un pedido nuevo';
  END IF;
  IF coalesce(public.acceso_tenant(v_pedido.tenant_id), 'solo_lectura') = 'solo_lectura' THEN
    RAISE EXCEPTION 'Tu cuenta esta en solo lectura. Reactiva tu plan para aceptar pedidos.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id = p_id AND producto_id IS NULL) THEN
    RAISE EXCEPTION 'Un producto del pedido ya no existe en tu catalogo';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('productId', producto_id, 'varianteId', variante_id, 'cantidad', cantidad))
  INTO v_items FROM public.pedido_items WHERE pedido_id = p_id;

  -- Ensayo: si no alcanzan las existencias, la función de venta lanza el error y todo se deshace.
  -- Si alcanzan, se lanza un error propio para deshacer igualmente y se responde «ok».
  BEGIN
    PERFORM public._crear_venta_desde_items(
      p_tenant_id => v_pedido.tenant_id,
      p_usuario_id => auth.uid(),
      p_cliente_id => NULL,
      p_metodo_pago => 'EFECTIVO',
      p_items => v_items,
      p_include_iva => false,
      p_notas => 'Ensayo de pedido #' || v_pedido.folio
    );
    RAISE SQLSTATE 'PD146' USING MESSAGE = 'ensayo_ok';
  EXCEPTION WHEN SQLSTATE 'PD146' THEN
    v_ensayo := jsonb_build_object('ok', true);
  END;

  SELECT * INTO v_estado FROM public.pedido_estados
  WHERE tenant_id = v_pedido.tenant_id AND base = 'confirmado' AND es_sistema AND activo
  ORDER BY orden LIMIT 1;

  UPDATE public.pedidos_catalogo
  SET estado = 'confirmado', estado_id = v_estado.id, estado_nombre = coalesce(v_estado.nombre, 'Confirmado'),
      estado_color = coalesce(v_estado.color, '#0D9488'), actualizado_en = now(), actualizado_por = auth.uid()
  WHERE id = p_id;
  PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, 'confirmado', coalesce(v_estado.nombre, 'Confirmado'),
    coalesce(v_estado.color, '#0D9488'), 'estado', NULL);
  RETURN v_ensayo || jsonb_build_object('id', p_id);
END;
$$;
REVOKE ALL ON FUNCTION public.aceptar_pedido(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.aceptar_pedido(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 8. Pagar: aquí SÍ se registra la venta (stock + caja), una sola vez
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_pago_pedido(
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
    RAISE EXCEPTION 'Tu cuenta esta en solo lectura. Reactiva tu plan para cobrar pedidos.';
  END IF;

  -- Doble clic o reintento: el pedido ya tiene venta, no se crea otra.
  IF v_pedido.venta_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', p_id, 'venta_id', v_pedido.venta_id, 'ya_pagado', true);
  END IF;
  IF v_pedido.estado IN ('nuevo', 'cancelado') THEN
    RAISE EXCEPTION 'Primero acepta el pedido';
  END IF;
  IF p_metodo_pago NOT IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA') THEN
    RAISE EXCEPTION 'Elige efectivo, tarjeta o transferencia';
  END IF;

  SELECT jsonb_agg(jsonb_build_object('productId', producto_id, 'varianteId', variante_id, 'cantidad', cantidad))
  INTO v_items FROM public.pedido_items WHERE pedido_id = p_id;
  IF v_items IS NULL OR EXISTS (SELECT 1 FROM public.pedido_items WHERE pedido_id = p_id AND producto_id IS NULL) THEN
    RAISE EXCEPTION 'Un producto del pedido ya no existe en tu catalogo';
  END IF;

  IF v_pedido.cliente_telefono IS NOT NULL THEN
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
  END IF;

  v_venta := public._crear_venta_desde_items(
    p_tenant_id => v_pedido.tenant_id,
    p_usuario_id => v_uid,
    p_cliente_id => v_cliente_id,
    p_metodo_pago => p_metodo_pago,
    p_items => v_items,
    p_include_iva => false,
    p_notas => 'Pedido #' || v_pedido.folio || CASE WHEN v_pedido.origen = 'pos' THEN ' del punto de venta' ELSE ' del catalogo en linea' END,
    p_idempotency_key => v_pedido.id
  );
  v_venta_id := (v_venta ->> 'id')::uuid;

  IF NOT p_acepta_diferencia AND abs((v_venta ->> 'total')::numeric - v_pedido.total) > 0.01 THEN
    RAISE EXCEPTION 'diferencia_de_precio:%:%', v_pedido.total, (v_venta ->> 'total')::numeric
      USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.pedidos_catalogo
  SET pagado = true, pagado_en = now(), metodo_pago = p_metodo_pago, venta_id = v_venta_id,
      sucursal_id = coalesce(sucursal_id, (v_venta ->> 'sucursal_id')::uuid),
      cliente_id = coalesce(cliente_id, v_cliente_id), actualizado_en = now(), actualizado_por = v_uid
  WHERE id = p_id;
  PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, v_pedido.estado, 'Pagado', '#16A34A', 'pago',
    CASE p_metodo_pago WHEN 'EFECTIVO' THEN 'Efectivo' WHEN 'TARJETA' THEN 'Tarjeta' ELSE 'Transferencia' END);

  RETURN jsonb_build_object('id', p_id, 'venta_id', v_venta_id, 'total', (v_venta ->> 'total')::numeric);
END;
$$;
REVOKE ALL ON FUNCTION public.registrar_pago_pedido(uuid, public.metodo_pago, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_pedido(uuid, public.metodo_pago, boolean) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Editar productos de un pedido (solo mientras no esté pagado ni cerrado)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.editar_pedido(p_id uuid, p_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_total numeric(12,2);
  v_n integer;
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  IF v_pedido.pagado OR v_pedido.venta_id IS NOT NULL THEN
    RAISE EXCEPTION 'Este pedido ya está pagado: no se puede editar';
  END IF;
  IF v_pedido.estado IN ('entregado', 'cancelado') THEN
    RAISE EXCEPTION 'Este pedido ya no se puede editar';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'El pedido debe tener de 1 a 50 productos';
  END IF;

  DROP TABLE IF EXISTS pg_temp._edicion_lineas;
  CREATE TEMP TABLE _edicion_lineas (
    producto_id uuid NOT NULL, variante_id uuid, cantidad numeric(10,3) NOT NULL,
    nombre text, variante text, unidad text, precio numeric(12,2)
  ) ON COMMIT DROP;
  INSERT INTO pg_temp._edicion_lineas (producto_id, variante_id, cantidad)
  SELECT (e->>'producto_id')::uuid, NULLIF(e->>'variante_id', '')::uuid, round(sum((e->>'cantidad')::numeric), 3)
  FROM jsonb_array_elements(p_items) e GROUP BY 1, 2;
  IF EXISTS (SELECT 1 FROM pg_temp._edicion_lineas WHERE cantidad <= 0 OR cantidad > 9999) THEN
    RAISE EXCEPTION 'Revisa las cantidades';
  END IF;

  -- Precios y nombres de la base, con el mismo catálogo que vio el cliente.
  UPDATE pg_temp._edicion_lineas l
  SET nombre = r.nombre, variante = r.etiqueta, unidad = r.unidad, precio = r.precio
  FROM (
    SELECT l2.producto_id, l2.variante_id, cp.nombre, vv.v ->> 'etiqueta' AS etiqueta,
           coalesce(vv.v ->> 'unidad_medida', cp.unidad_medida) AS unidad,
           CASE WHEN l2.variante_id IS NOT NULL THEN (vv.v ->> 'precio')::numeric
                ELSE coalesce(cp.precio_especial, cp.precio_min) END AS precio
    FROM pg_temp._edicion_lineas l2
    JOIN public._catalogo_productos(v_pedido.tenant_id) cp ON cp.id = l2.producto_id
    LEFT JOIN LATERAL (
      SELECT x AS v FROM jsonb_array_elements(cp.variantes) x
      WHERE l2.variante_id IS NOT NULL AND (x ->> 'id')::uuid = l2.variante_id LIMIT 1
    ) vv ON true
    WHERE ((jsonb_array_length(cp.variantes) > 0 AND l2.variante_id IS NOT NULL AND vv.v IS NOT NULL)
           OR (jsonb_array_length(cp.variantes) = 0 AND l2.variante_id IS NULL))
  ) r
  WHERE l.producto_id = r.producto_id AND l.variante_id IS NOT DISTINCT FROM r.variante_id;

  SELECT count(*) INTO v_n FROM pg_temp._edicion_lineas WHERE precio IS NOT NULL;
  IF v_n <> (SELECT count(*) FROM pg_temp._edicion_lineas) THEN
    RAISE EXCEPTION 'Hay productos que ya no están disponibles';
  END IF;
  SELECT round(sum(precio * cantidad), 2) INTO v_total FROM pg_temp._edicion_lineas;

  DELETE FROM public.pedido_items WHERE pedido_id = p_id;
  INSERT INTO public.pedido_items (pedido_id, tenant_id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio_unitario)
  SELECT p_id, v_pedido.tenant_id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio FROM pg_temp._edicion_lineas;
  UPDATE public.pedidos_catalogo SET total = v_total, actualizado_en = now(), actualizado_por = auth.uid() WHERE id = p_id;
  PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, v_pedido.estado, 'Pedido editado', '#64748B', 'edicion',
    'Total: ' || v_total::text);
  RETURN jsonb_build_object('id', p_id, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.editar_pedido(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.editar_pedido(uuid, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 10. Mensajes por pedido
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.guardar_mensaje_pedido(p_id uuid, p_mensaje_cliente text, p_nota_interna text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_msg text := NULLIF(btrim(p_mensaje_cliente), '');
  v_nota text := NULLIF(btrim(p_nota_interna), '');
BEGIN
  v_pedido := public._pedido_para_gestionar(p_id);
  IF (v_msg IS NOT NULL AND length(v_msg) > 300) OR (v_nota IS NOT NULL AND length(v_nota) > 300) THEN
    RAISE EXCEPTION 'Cada mensaje va de 1 a 300 caracteres';
  END IF;
  UPDATE public.pedidos_catalogo
  SET mensaje_cliente = v_msg, nota_interna = v_nota, actualizado_en = now(), actualizado_por = auth.uid()
  WHERE id = p_id;
  IF v_msg IS DISTINCT FROM v_pedido.mensaje_cliente THEN
    PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, v_pedido.estado, 'Mensaje para el cliente', '#64748B', 'mensaje', v_msg);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.guardar_mensaje_pedido(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_mensaje_pedido(uuid, text, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 11. Cancelar (ahora con estado propio «Cancelado» y la venta si ya existe)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_pedido(p_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_pedido public.pedidos_catalogo%ROWTYPE;
  v_motivo text := NULLIF(btrim(p_motivo), '');
  v_estado public.pedido_estados%ROWTYPE;
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

  SELECT * INTO v_estado FROM public.pedido_estados
  WHERE tenant_id = v_pedido.tenant_id AND base = 'cancelado' AND es_sistema LIMIT 1;
  UPDATE public.pedidos_catalogo
  SET estado = 'cancelado', estado_id = v_estado.id, estado_nombre = coalesce(v_estado.nombre, 'Cancelado'),
      estado_color = coalesce(v_estado.color, '#DB2777'), actualizado_en = now(), actualizado_por = auth.uid()
  WHERE id = p_id;
  PERFORM public._pedido_evento(p_id, v_pedido.tenant_id, 'cancelado', coalesce(v_estado.nombre, 'Cancelado'),
    coalesce(v_estado.color, '#DB2777'), 'estado', v_motivo);
  RETURN jsonb_build_object('id', p_id, 'venta', v_resultado);
END;
$$;
REVOKE ALL ON FUNCTION public.cancelar_pedido(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_pedido(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 12. Pedido del mostrador (desde el punto de venta): nace confirmado, sin tocar stock ni caja hasta pagar
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_pedido_interno(
  p_tenant uuid,
  p_cliente_nombre text,
  p_telefono text,
  p_entrega text,
  p_direccion text,
  p_mensaje_cliente text,
  p_nota_interna text,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_nombre text := btrim(coalesce(p_cliente_nombre, ''));
  v_telefono text := NULLIF(btrim(coalesce(p_telefono, '')), '');
  v_direccion text := NULLIF(btrim(coalesce(p_direccion, '')), '');
  v_estado public.pedido_estados%ROWTYPE;
  v_total numeric(12,2);
  v_folio integer;
  v_pedido_id uuid;
  v_codigo text;
BEGIN
  PERFORM public._pedido_gestion_tenant(p_tenant);
  IF length(v_nombre) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Escribe el nombre del cliente';
  END IF;
  IF p_entrega NOT IN ('recoger', 'domicilio') THEN
    RAISE EXCEPTION 'Elige si recoge o se le lleva';
  END IF;
  IF p_entrega = 'domicilio' AND (v_direccion IS NULL OR length(v_direccion) < 5) THEN
    RAISE EXCEPTION 'Escribe la dirección de entrega';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'El pedido debe tener de 1 a 50 productos';
  END IF;

  DROP TABLE IF EXISTS pg_temp._interno_lineas;
  CREATE TEMP TABLE _interno_lineas (
    producto_id uuid NOT NULL, variante_id uuid, cantidad numeric(10,3) NOT NULL,
    nombre text, variante text, unidad text, precio numeric(12,2)
  ) ON COMMIT DROP;
  INSERT INTO pg_temp._interno_lineas (producto_id, variante_id, cantidad)
  SELECT (e->>'producto_id')::uuid, NULLIF(e->>'variante_id', '')::uuid, round(sum((e->>'cantidad')::numeric), 3)
  FROM jsonb_array_elements(p_items) e GROUP BY 1, 2;
  IF EXISTS (SELECT 1 FROM pg_temp._interno_lineas WHERE cantidad <= 0 OR cantidad > 9999) THEN
    RAISE EXCEPTION 'Revisa las cantidades';
  END IF;
  UPDATE pg_temp._interno_lineas l
  SET nombre = r.nombre, variante = r.etiqueta, unidad = r.unidad, precio = r.precio
  FROM (
    SELECT l2.producto_id, l2.variante_id, cp.nombre, vv.v ->> 'etiqueta' AS etiqueta,
           coalesce(vv.v ->> 'unidad_medida', cp.unidad_medida) AS unidad,
           CASE WHEN l2.variante_id IS NOT NULL THEN (vv.v ->> 'precio')::numeric
                ELSE coalesce(cp.precio_especial, cp.precio_min) END AS precio
    FROM pg_temp._interno_lineas l2
    JOIN public._catalogo_productos(p_tenant) cp ON cp.id = l2.producto_id
    LEFT JOIN LATERAL (
      SELECT x AS v FROM jsonb_array_elements(cp.variantes) x
      WHERE l2.variante_id IS NOT NULL AND (x ->> 'id')::uuid = l2.variante_id LIMIT 1
    ) vv ON true
    WHERE ((jsonb_array_length(cp.variantes) > 0 AND l2.variante_id IS NOT NULL AND vv.v IS NOT NULL)
           OR (jsonb_array_length(cp.variantes) = 0 AND l2.variante_id IS NULL))
  ) r
  WHERE l.producto_id = r.producto_id AND l.variante_id IS NOT DISTINCT FROM r.variante_id;
  IF EXISTS (SELECT 1 FROM pg_temp._interno_lineas WHERE precio IS NULL) THEN
    RAISE EXCEPTION 'Hay productos que ya no están disponibles';
  END IF;
  SELECT round(sum(precio * cantidad), 2) INTO v_total FROM pg_temp._interno_lineas;

  SELECT * INTO v_estado FROM public.pedido_estados
  WHERE tenant_id = p_tenant AND base = 'confirmado' AND es_sistema AND activo ORDER BY orden LIMIT 1;

  SELECT coalesce(max(folio), 0) + 1 INTO v_folio FROM public.pedidos_catalogo WHERE tenant_id = p_tenant;
  FOR i IN 1..5 LOOP
    EXIT WHEN v_pedido_id IS NOT NULL;
    BEGIN
      INSERT INTO public.pedidos_catalogo (
        tenant_id, folio, codigo_seguimiento, cliente_nombre, cliente_telefono, entrega, direccion, nota,
        total, estado, estado_id, estado_nombre, estado_color, origen, mensaje_cliente, nota_interna, actualizado_por
      ) VALUES (
        p_tenant, v_folio, public._codigo_tarjeta_lealtad(), v_nombre, v_telefono, p_entrega, v_direccion,
        NULLIF(btrim(coalesce(p_mensaje_cliente, '')), ''), v_total, 'confirmado', v_estado.id,
        coalesce(v_estado.nombre, 'Confirmado'), coalesce(v_estado.color, '#0D9488'), 'pos',
        NULLIF(btrim(coalesce(p_mensaje_cliente, '')), ''), NULLIF(btrim(coalesce(p_nota_interna, '')), ''), auth.uid()
      ) RETURNING id, codigo_seguimiento INTO v_pedido_id, v_codigo;
    EXCEPTION WHEN unique_violation THEN
      v_pedido_id := NULL;
    END;
  END LOOP;
  IF v_pedido_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo guardar el pedido, intenta de nuevo';
  END IF;

  INSERT INTO public.pedido_items (pedido_id, tenant_id, producto_id, variante_id, nombre, variante, unidad, cantidad, precio_unitario)
  SELECT v_pedido_id, p_tenant, producto_id, variante_id, nombre, variante, unidad, cantidad, precio FROM pg_temp._interno_lineas;
  PERFORM public._pedido_evento(v_pedido_id, p_tenant, 'confirmado', coalesce(v_estado.nombre, 'Confirmado'),
    coalesce(v_estado.color, '#0D9488'), 'estado', 'Creado en el punto de venta');
  RETURN jsonb_build_object('id', v_pedido_id, 'folio', v_folio, 'codigo_seguimiento', v_codigo, 'total', v_total);
END;
$$;
REVOKE ALL ON FUNCTION public.crear_pedido_interno(uuid, text, text, text, text, text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crear_pedido_interno(uuid, text, text, text, text, text, text, jsonb) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 13. Funciones viejas: mensaje claro para pestañas abiertas con el código anterior
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirmar_pedido(p_id uuid, p_metodo_pago public.metodo_pago, p_acepta_diferencia boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'El módulo de pedidos cambió: recarga la página para seguir.';
END;
$$;

CREATE OR REPLACE FUNCTION public.cambiar_estado_pedido(p_id uuid, p_estado text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'El módulo de pedidos cambió: recarga la página para seguir.';
END;
$$;

-- ---------------------------------------------------------------------------
-- 14. Seguimiento público: estado propio, eventos con fecha, mensaje y plazo (sin teléfono, dirección ni notas internas)
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
    'estado_nombre', coalesce(p.estado_nombre, p.estado),
    'estado_color', p.estado_color,
    'entrega', p.entrega,
    'pagado', p.pagado,
    'creado_en', p.creado_en,
    'actualizado_en', p.actualizado_en,
    'negocio', t.nombre_comercial,
    'logo_url', t.logo_url,
    'direccion_negocio', NULLIF(btrim(t.direccion), ''),
    'moneda', t.moneda,
    'color', c.color,
    'slug', c.slug,
    'whatsapp', c.whatsapp,
    'costo_envio', p.costo_envio,
    'plazo_retiro_dias', c.plazo_retiro_dias,
    'mensaje_cliente', p.mensaje_cliente,
    'total', CASE WHEN coalesce(c.mostrar_precios, true) THEN p.total END,
    'eventos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('etiqueta', coalesce(e.etiqueta, e.estado), 'color', e.color, 'tipo', e.tipo, 'en', e.creado_en)
                       ORDER BY e.creado_en)
      FROM public.pedido_eventos e WHERE e.pedido_id = p.id AND e.tipo <> 'mensaje'
    ), '[]'::jsonb),
    'items', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'nombre', i.nombre, 'variante', i.variante, 'unidad', i.unidad, 'cantidad', i.cantidad,
        'precio', CASE WHEN coalesce(c.mostrar_precios, true) THEN i.precio_unitario END,
        'imagen', pr.imagen_url
      ) ORDER BY i.nombre)
      FROM public.pedido_items i LEFT JOIN public.productos pr ON pr.id = i.producto_id
      WHERE i.pedido_id = p.id
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
