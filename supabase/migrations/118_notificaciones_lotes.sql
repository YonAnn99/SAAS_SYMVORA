-- =============================================================================
-- 118: Notificaciones de lotes y caducidades (sobre 108/116/117)
-- =============================================================================
-- Avisos nuevos en la campana:
--   * lote_por_caducar / lote_caducado: un lote con existencias entra a los
--     15 dias previos a su caducidad, o ya caduco. Todo el equipo. Los genera
--     `revisar_caducidades` (al abrir la app y en el cron diario de las 8:00).
--   * lote: un COLABORADOR registro, edito o elimino un lote (inventory.manage).
--   * insumo_faltante: se cobro un servicio y algun insumo no tenia existencias
--     (inventory.manage). Uno por venta.
-- REGLA de la 108: todo trigger de aviso atrapa sus errores; un aviso nunca
-- tumba una venta, una compra ni un ajuste.
-- =============================================================================

-- 1. Tipos nuevos (solo se agregan valores).
ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN (
  'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto',
  'compra', 'orden_compra', 'ajuste', 'traspaso',
  'lote_por_caducar', 'lote_caducado', 'lote', 'insumo_faltante'
));

-- "Vacuna triple · 10 ml": el articulo de un lote (producto y, si tiene, variante).
CREATE OR REPLACE FUNCTION public._notif_articulo(p_producto_id UUID, p_variante_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT CASE
    WHEN p_variante_id IS NULL THEN p.nombre
    ELSE (SELECT public._notif_nombre_variante(p.nombre, v.atributos, v.talla, v.color)
          FROM public.variantes_producto v WHERE v.id = p_variante_id)
  END
  FROM public.productos p
  WHERE p.id = p_producto_id;
$fn$;

CREATE OR REPLACE FUNCTION public._notif_fecha(p_fecha DATE)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO ''
AS $fn$
  SELECT to_char(p_fecha, 'DD/MM/YYYY');
$fn$;

REVOKE ALL ON FUNCTION public._notif_articulo(UUID, UUID) FROM PUBLIC, anon, authenticated;

-- =============================================================================
-- 2. revisar_caducidades: lotes por caducar (15 dias) y caducados
-- =============================================================================
-- Con sesion: solo el negocio pedido y solo si el usuario es miembro.
-- Sin sesion (cron con service_role): todos los negocios reales (sin demos).
-- Un aviso por lote, estado y fecha: si editan la caducidad, se evalua de nuevo.
CREATE OR REPLACE FUNCTION public.revisar_caducidades(p_tenant_id UUID DEFAULT NULL)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_hoy DATE := public._hoy_mx();
  v_dias CONSTANT INT := 15;
  v_lote RECORD;
  v_tipo TEXT;
  v_dias_faltan INT;
  v_creados INT := 0;
BEGIN
  IF auth.uid() IS NOT NULL THEN
    IF p_tenant_id IS NULL OR p_tenant_id NOT IN (SELECT public.user_tenant_ids()) THEN
      RAISE EXCEPTION 'No perteneces a este negocio';
    END IF;
  END IF;

  FOR v_lote IN
    SELECT l.id, l.tenant_id, l.producto_id, l.variante_id, l.numero_lote, l.fecha_caducidad,
           string_agg(s.nombre || ' ' || trim_scale(e.cantidad)::text, ' · ' ORDER BY s.nombre) AS donde,
           SUM(e.cantidad) AS total
    FROM public.lotes l
    JOIN public.tenants t ON t.id = l.tenant_id AND t.demo_expira_en IS NULL
    JOIN public.existencias_lote e ON e.lote_id = l.id AND e.cantidad > 0
    JOIN public.sucursales s ON s.id = e.sucursal_id
    WHERE (p_tenant_id IS NULL OR l.tenant_id = p_tenant_id)
      AND l.fecha_caducidad IS NOT NULL
      AND l.fecha_caducidad <= v_hoy + v_dias
    GROUP BY l.id
  LOOP
    v_tipo := CASE WHEN v_lote.fecha_caducidad < v_hoy THEN 'lote_caducado' ELSE 'lote_por_caducar' END;

    CONTINUE WHEN EXISTS (
      SELECT 1 FROM public.notificaciones n
      WHERE n.tenant_id = v_lote.tenant_id
        AND n.entidad_id = v_lote.id
        AND n.tipo = v_tipo
        AND n.datos->>'fecha_caducidad' = v_lote.fecha_caducidad::text
    );
    CONTINUE WHEN NOT public._notif_tenant_activo(v_lote.tenant_id);

    v_dias_faltan := v_lote.fecha_caducidad - v_hoy;

    INSERT INTO public.notificaciones (
      tenant_id, tipo, titulo, mensaje, enlace, permiso, entidad_id, datos
    ) VALUES (
      v_lote.tenant_id,
      v_tipo,
      CASE WHEN v_tipo = 'lote_caducado' THEN 'Lote caducado: ' ELSE 'Por caducar: ' END
        || COALESCE(public._notif_articulo(v_lote.producto_id, v_lote.variante_id), 'Producto')
        || ' (' || v_lote.numero_lote || ')',
      CASE
        WHEN v_tipo = 'lote_caducado' THEN
          'Caducó el ' || public._notif_fecha(v_lote.fecha_caducidad) || '. Hay ' || v_lote.donde
            || '. No se puede vender: retíralo con un ajuste.'
        WHEN v_dias_faltan = 0 THEN
          'Caduca hoy. Hay ' || v_lote.donde || '.'
        ELSE
          'Caduca el ' || public._notif_fecha(v_lote.fecha_caducidad) || ' (en ' || v_dias_faltan
            || CASE WHEN v_dias_faltan = 1 THEN ' día' ELSE ' días' END || '). Hay ' || v_lote.donde || '.'
      END,
      '/products?tab=lots',
      NULL,
      v_lote.id,
      jsonb_build_object(
        'lote_id', v_lote.id,
        'producto_id', v_lote.producto_id,
        'variante_id', v_lote.variante_id,
        'numero_lote', v_lote.numero_lote,
        'fecha_caducidad', v_lote.fecha_caducidad::text,
        'cantidad', v_lote.total
      )
    );
    v_creados := v_creados + 1;
  END LOOP;

  RETURN v_creados;
END;
$fn$;

REVOKE ALL ON FUNCTION public.revisar_caducidades(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revisar_caducidades(UUID) TO authenticated, service_role;

-- =============================================================================
-- 3. Acciones de colaboradores en lotes (tipo `lote`, inventory.manage)
-- =============================================================================

-- Alta manual (registrar_lote): sus movimientos ENTRADA / ASIGNACION. Las
-- compras ya avisan como "compra" y no se repiten aqui.
CREATE OR REPLACE FUNCTION public._notif_trg_lote_alta()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_lote public.lotes%ROWTYPE;
  v_articulo TEXT;
BEGIN
  BEGIN
    IF NEW.tipo NOT IN ('ENTRADA', 'ASIGNACION') THEN
      RETURN NULL;
    END IF;
    v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(auth.uid(), NEW.usuario_id));
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    SELECT * INTO v_lote FROM public.lotes l WHERE l.id = NEW.lote_id;
    v_articulo := COALESCE(public._notif_articulo(v_lote.producto_id, v_lote.variante_id), 'un producto');
    PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'lote', 'registrar_lote',
      v_nombre || ' registró el lote ' || v_lote.numero_lote || ' de ' || v_articulo,
      v_nombre || ' registró %s lotes',
      v_articulo || ' · lote ' || v_lote.numero_lote || ': ' || trim_scale(NEW.cantidad)::text
        || CASE WHEN NEW.tipo = 'ENTRADA' THEN ' (mercancía nueva)' ELSE ' (ya en inventario)' END
        || COALESCE(' · caduca ' || public._notif_fecha(v_lote.fecha_caducidad), ''),
      '/products?tab=lots', 'inventory.manage', v_lote.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de alta de lote omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_lote_alta ON public.movimientos_lote;
CREATE TRIGGER trg_notif_lote_alta
  AFTER INSERT ON public.movimientos_lote
  FOR EACH ROW
  WHEN (NEW.tipo IN ('ENTRADA', 'ASIGNACION'))
  EXECUTE FUNCTION public._notif_trg_lote_alta();

-- Edicion y baja. La cantidad la mueve un trigger (no es una edicion), y
-- `_entrar_lote` solo llena una caducidad VACIA: ninguna de las dos avisa.
CREATE OR REPLACE FUNCTION public._notif_trg_lote_cambio()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_actor UUID;
  v_nombre TEXT;
  v_articulo TEXT;
  v_cambios TEXT[] := ARRAY[]::TEXT[];
BEGIN
  BEGIN
    IF TG_OP = 'DELETE' THEN
      -- Borrado en cascada (producto o negocio demo): no es una accion de alguien.
      IF pg_trigger_depth() > 1 THEN
        RETURN NULL;
      END IF;
      v_actor := public._notif_colaborador(OLD.tenant_id, auth.uid());
      IF v_actor IS NULL THEN
        RETURN NULL;
      END IF;
      v_nombre := public._notif_nombre(v_actor);
      v_articulo := COALESCE(public._notif_articulo(OLD.producto_id, OLD.variante_id), 'un producto');
      PERFORM public._notif_accion(OLD.tenant_id, v_actor, 'lote', 'eliminar_lote',
        v_nombre || ' eliminó el lote ' || OLD.numero_lote || ' de ' || v_articulo,
        v_nombre || ' eliminó %s lotes',
        'Sus piezas siguen en el inventario, sin lote.',
        '/products?tab=lots', 'inventory.manage', OLD.id);
      RETURN NULL;
    END IF;

    IF NEW.numero_lote IS DISTINCT FROM OLD.numero_lote THEN
      v_cambios := v_cambios || ('número ' || OLD.numero_lote || ' → ' || NEW.numero_lote);
    END IF;
    IF OLD.fecha_caducidad IS NOT NULL AND NEW.fecha_caducidad IS DISTINCT FROM OLD.fecha_caducidad THEN
      v_cambios := v_cambios || ('caducidad ' || public._notif_fecha(OLD.fecha_caducidad) || ' → '
        || COALESCE(public._notif_fecha(NEW.fecha_caducidad), 'sin fecha'));
    END IF;
    IF NEW.costo_unitario IS DISTINCT FROM OLD.costo_unitario THEN
      v_cambios := v_cambios || ('costo ' || public._notif_mxn(OLD.costo_unitario) || ' → '
        || public._notif_mxn(NEW.costo_unitario));
    END IF;
    IF cardinality(v_cambios) = 0 THEN
      RETURN NULL;
    END IF;

    v_actor := public._notif_colaborador(NEW.tenant_id, auth.uid());
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    v_nombre := public._notif_nombre(v_actor);
    v_articulo := COALESCE(public._notif_articulo(NEW.producto_id, NEW.variante_id), 'un producto');
    PERFORM public._notif_accion(NEW.tenant_id, v_actor, 'lote', 'editar_lote',
      v_nombre || ' editó el lote ' || NEW.numero_lote || ' de ' || v_articulo,
      v_nombre || ' editó %s lotes',
      array_to_string(v_cambios, ' · '),
      '/products?tab=lots', 'inventory.manage', NEW.id);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de lote omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_lote_edicion ON public.lotes;
CREATE TRIGGER trg_notif_lote_edicion
  AFTER UPDATE OF numero_lote, fecha_caducidad, costo_unitario ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_lote_cambio();

DROP TRIGGER IF EXISTS trg_notif_lote_baja ON public.lotes;
CREATE TRIGGER trg_notif_lote_baja
  AFTER DELETE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_lote_cambio();

-- =============================================================================
-- 4. Insumos faltantes al cobrar un servicio (uno por venta)
-- =============================================================================
-- Por SENTENCIA: la venta inserta todos sus insumos en un solo INSERT, asi que
-- sale un aviso por venta con todo lo que falto. Sin actor: lo ve tambien
-- quien cobro (tiene que corregir el conteo).
CREATE OR REPLACE FUNCTION public._notif_trg_insumos_faltantes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_grupo RECORD;
BEGIN
  BEGIN
    FOR v_grupo IN
      SELECT n.tenant_id, n.venta_id,
             string_agg(DISTINCT sp.nombre, ', ') AS servicios,
             string_agg(
               trim_scale(n.faltante)::text || ' ' || COALESCE(public._notif_articulo(n.producto_id, n.variante_id), 'insumo'),
               ' · '
             ) AS faltantes,
             (SELECT s.nombre FROM public.ventas v JOIN public.sucursales s ON s.id = v.sucursal_id
              WHERE v.id = n.venta_id) AS sucursal
      FROM nuevos n
      JOIN public.productos sp ON sp.id = n.servicio_id
      WHERE n.faltante > 0
      GROUP BY n.tenant_id, n.venta_id
    LOOP
      CONTINUE WHEN NOT public._notif_tenant_activo(v_grupo.tenant_id);
      INSERT INTO public.notificaciones (
        tenant_id, tipo, titulo, mensaje, enlace, permiso, entidad_id, datos
      ) VALUES (
        v_grupo.tenant_id,
        'insumo_faltante',
        'Faltaron insumos al cobrar ' || v_grupo.servicios,
        v_grupo.faltantes || ': no había existencias'
          || COALESCE(' en ' || v_grupo.sucursal, '') || '. Revisa el conteo con un ajuste.',
        '/reports',
        'inventory.manage',
        v_grupo.venta_id,
        jsonb_build_object('venta_id', v_grupo.venta_id)
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de insumos faltantes omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_notif_insumos_faltantes ON public.detalle_venta_insumos;
CREATE TRIGGER trg_notif_insumos_faltantes
  AFTER INSERT ON public.detalle_venta_insumos
  REFERENCING NEW TABLE AS nuevos
  FOR EACH STATEMENT EXECUTE FUNCTION public._notif_trg_insumos_faltantes();

REVOKE ALL ON FUNCTION public._notif_trg_lote_alta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_lote_cambio() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._notif_trg_insumos_faltantes() FROM PUBLIC, anon, authenticated;
