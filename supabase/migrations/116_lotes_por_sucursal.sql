-- =============================================================================
-- 116: Lotes por sucursal (existencias por lote, consumo FEFO y kardex)
-- =============================================================================
-- Hasta aqui `lotes` era un registro por producto (numero, caducidad, costo) sin
-- sucursal: la venta no lo descontaba y el traspaso no lo movia. Para una
-- farmacia o una veterinaria con varias ubicaciones (la casa y la maleta del
-- veterinario) hace falta saber CUANTO de CADA lote hay EN CADA ubicacion.
--
-- Regla central: la existencia de un producto en una sucursal sigue siendo
-- `stock_sucursal.cantidad` (nada cambia para quien no usa lotes). Los lotes
-- REPARTEN esa existencia:  SUM(existencias_lote) <= stock_sucursal.cantidad.
-- Lo que sobra es stock "sin lote" (el de antes de esta funcion).
--
--   * La venta consume FEFO: primero el lote que caduca antes, solo lotes
--     vigentes; despues lo que este sin lote. Las piezas de lotes CADUCADOS no
--     se venden (decision de negocio: medicamentos y vacunas).
--   * El traspaso mueve los lotes con su caducidad a la sucursal destino.
--   * La compra puede traer numero de lote y caducidad por renglon.
--   * Cualquier otra ruta que baje el stock (cancelar compra, ajuste sin lote,
--     fijar existencias) la cuadra un trigger: nunca quedan mas lotes que stock.
--
-- Al aplicar esta migracion habia 0 lotes en produccion: no hay datos que
-- convertir. Las funciones se reescriben COMPLETAS con la misma firma (los
-- GRANT se conservan con CREATE OR REPLACE), partiendo de pg_get_functiondef.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. lotes: variante y unicidad por variante
-- -----------------------------------------------------------------------------
ALTER TABLE public.lotes
  ADD COLUMN IF NOT EXISTS variante_id UUID
  REFERENCES public.variantes_producto(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_lotes_variante ON public.lotes(variante_id)
  WHERE variante_id IS NOT NULL;

-- El mismo numero de lote puede existir en dos presentaciones (variantes) del
-- mismo producto. Con 0 filas, cambiar la unicidad solo la relaja.
ALTER TABLE public.lotes DROP CONSTRAINT IF EXISTS lotes_tenant_id_producto_id_numero_lote_key;
CREATE UNIQUE INDEX IF NOT EXISTS lotes_numero_unico
  ON public.lotes (tenant_id, producto_id, variante_id, numero_lote) NULLS NOT DISTINCT;

-- -----------------------------------------------------------------------------
-- 2. existencias_lote: cuanto de cada lote hay en cada sucursal
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.existencias_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id),
  cantidad DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (lote_id, sucursal_id)
);

CREATE INDEX IF NOT EXISTS idx_existencias_lote_sucursal ON public.existencias_lote(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_existencias_lote_tenant ON public.existencias_lote(tenant_id);

-- -----------------------------------------------------------------------------
-- 3. movimientos_lote: el kardex del lote (de donde vino y a donde se fue)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.movimientos_lote (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lote_id UUID NOT NULL REFERENCES public.lotes(id) ON DELETE CASCADE,
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id),
  cantidad DECIMAL(10,3) NOT NULL CHECK (cantidad <> 0),
  tipo TEXT NOT NULL CHECK (tipo IN (
    'ENTRADA', 'ASIGNACION', 'COMPRA', 'CANCELACION_COMPRA', 'VENTA', 'INSUMO',
    'TRASPASO_SALIDA', 'TRASPASO_ENTRADA', 'AJUSTE', 'CUADRE'
  )),
  venta_id UUID REFERENCES public.ventas(id) ON DELETE CASCADE,
  compra_id UUID REFERENCES public.compras(id) ON DELETE CASCADE,
  traspaso_id UUID REFERENCES public.traspasos(id) ON DELETE CASCADE,
  ajuste_id UUID REFERENCES public.ajustes_inventario(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Un indice por llave foranea (regla de la 105).
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_lote ON public.movimientos_lote(lote_id, creado_en);
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_tenant ON public.movimientos_lote(tenant_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_sucursal ON public.movimientos_lote(sucursal_id);
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_venta ON public.movimientos_lote(venta_id) WHERE venta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_compra ON public.movimientos_lote(compra_id) WHERE compra_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_traspaso ON public.movimientos_lote(traspaso_id) WHERE traspaso_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_ajuste ON public.movimientos_lote(ajuste_id) WHERE ajuste_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_lote_usuario ON public.movimientos_lote(usuario_id) WHERE usuario_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 4. RLS: solo lectura para el equipo. Se escribe UNICAMENTE por RPC.
-- -----------------------------------------------------------------------------
ALTER TABLE public.existencias_lote ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimientos_lote ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS existencias_lote_select ON public.existencias_lote;
CREATE POLICY existencias_lote_select ON public.existencias_lote
  FOR SELECT TO authenticated
  USING (sucursal_id IN (SELECT public.mis_sucursales()));

DROP POLICY IF EXISTS movimientos_lote_select ON public.movimientos_lote;
CREATE POLICY movimientos_lote_select ON public.movimientos_lote
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (SELECT public.user_tenant_ids())
    AND sucursal_id IN (SELECT public.mis_sucursales())
  );

REVOKE ALL ON public.existencias_lote, public.movimientos_lote FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.existencias_lote, public.movimientos_lote FROM authenticated;
GRANT SELECT ON public.existencias_lote, public.movimientos_lote TO authenticated;

-- Cuenta en solo lectura (096).
DROP TRIGGER IF EXISTS trg_solo_lectura ON public.existencias_lote;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.existencias_lote
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.movimientos_lote;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.movimientos_lote
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

-- -----------------------------------------------------------------------------
-- 5. lotes.cantidad = SUM(existencias_lote). Nadie la escribe a mano.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._sincronizar_cantidad_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_lote UUID := COALESCE(NEW.lote_id, OLD.lote_id);
  v_total DECIMAL(10,3);
BEGIN
  SELECT COALESCE(SUM(e.cantidad), 0) INTO v_total
  FROM public.existencias_lote e
  WHERE e.lote_id = v_lote;

  PERFORM set_config('app.sync_lote', '1', true);
  UPDATE public.lotes
  SET cantidad = v_total,
      estado = CASE WHEN v_total > 0 THEN 'ACTIVO' ELSE 'AGOTADO' END,
      actualizado_en = NOW()
  WHERE id = v_lote;
  PERFORM set_config('app.sync_lote', '0', true);

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_existencias_lote_sync ON public.existencias_lote;
CREATE TRIGGER trg_existencias_lote_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.existencias_lote
  FOR EACH ROW EXECUTE FUNCTION public._sincronizar_cantidad_lote();

-- Una pestana abierta con el codigo anterior inserta lotes con cantidad y los
-- edita directo. La cantidad ya no se escribe asi: sale de las existencias.
-- Numero, fechas y costo se siguen editando directo (RLS inventory.manage).
CREATE OR REPLACE FUNCTION public._proteger_cantidad_lote()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF current_setting('app.sync_lote', true) IS DISTINCT FROM '1' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.cantidad := 0;
      NEW.estado := 'AGOTADO';
    ELSE
      NEW.cantidad := OLD.cantidad;
      NEW.estado := OLD.estado;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_lotes_proteger_cantidad ON public.lotes;
CREATE TRIGGER trg_lotes_proteger_cantidad
  BEFORE INSERT OR UPDATE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public._proteger_cantidad_lote();

-- Un lote que ya se vendio o se traspaso es historia: borrarlo borraria su
-- kardex (CASCADE). Dentro de un borrado en cascada (negocio demo) se permite.
CREATE OR REPLACE FUNCTION public._impedir_borrar_lote_con_historia()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $fn$
BEGIN
  IF pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.movimientos_lote m
    WHERE m.lote_id = OLD.id
      AND m.tipo IN ('VENTA', 'INSUMO', 'TRASPASO_SALIDA', 'TRASPASO_ENTRADA')
  ) THEN
    RAISE EXCEPTION 'El lote "%" ya tiene ventas o traspasos: no se puede eliminar', OLD.numero_lote
      USING ERRCODE = '23503';
  END IF;
  RETURN OLD;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_lotes_impedir_borrar ON public.lotes;
CREATE TRIGGER trg_lotes_impedir_borrar
  BEFORE DELETE ON public.lotes
  FOR EACH ROW EXECUTE FUNCTION public._impedir_borrar_lote_con_historia();

-- -----------------------------------------------------------------------------
-- 6. Funciones internas de lotes
-- -----------------------------------------------------------------------------

-- "Hoy" del negocio: la caducidad es una fecha de calendario en Mexico.
CREATE OR REPLACE FUNCTION public._hoy_mx()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $fn$
  SELECT (NOW() AT TIME ZONE 'America/Mexico_City')::DATE;
$fn$;

-- Suma (o resta) existencia de UN lote en UNA sucursal y deja el movimiento.
CREATE OR REPLACE FUNCTION public._sumar_existencia_lote(
  p_lote_id UUID,
  p_sucursal_id UUID,
  p_cantidad DECIMAL,
  p_tipo TEXT,
  p_venta_id UUID DEFAULT NULL,
  p_compra_id UUID DEFAULT NULL,
  p_traspaso_id UUID DEFAULT NULL,
  p_ajuste_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant UUID;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad = 0 THEN
    RETURN;
  END IF;

  SELECT l.tenant_id INTO v_tenant FROM public.lotes l WHERE l.id = p_lote_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Lote no encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.sucursales s WHERE s.id = p_sucursal_id AND s.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece al negocio del lote';
  END IF;

  -- Entrada: upsert. Salida: UPDATE (un INSERT con cantidad negativa violaria
  -- el CHECK antes de llegar al ON CONFLICT). El CHECK (cantidad >= 0) frena
  -- cualquier resta de mas.
  IF p_cantidad > 0 THEN
    INSERT INTO public.existencias_lote (tenant_id, lote_id, sucursal_id, cantidad)
    VALUES (v_tenant, p_lote_id, p_sucursal_id, p_cantidad)
    ON CONFLICT (lote_id, sucursal_id) DO UPDATE
      SET cantidad = public.existencias_lote.cantidad + EXCLUDED.cantidad,
          actualizado_en = NOW();
  ELSE
    UPDATE public.existencias_lote
    SET cantidad = cantidad + p_cantidad,
        actualizado_en = NOW()
    WHERE lote_id = p_lote_id AND sucursal_id = p_sucursal_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El lote no tiene existencias en esta sucursal';
    END IF;
  END IF;

  INSERT INTO public.movimientos_lote (
    tenant_id, lote_id, sucursal_id, cantidad, tipo,
    venta_id, compra_id, traspaso_id, ajuste_id, usuario_id
  ) VALUES (
    v_tenant, p_lote_id, p_sucursal_id, p_cantidad, p_tipo,
    p_venta_id, p_compra_id, p_traspaso_id, p_ajuste_id, auth.uid()
  );
END;
$fn$;

-- Consume FEFO de los lotes de (sucursal, producto, variante) y devuelve de
-- que lotes salio. Solo lotes vigentes, salvo p_incluir_vencidos (cuadre y la
-- ultima parte de un traspaso). Lo que no alcance a cubrir es stock sin lote:
-- quien llama decide si eso esta permitido.
CREATE OR REPLACE FUNCTION public._consumir_lotes(
  p_sucursal_id UUID,
  p_producto_id UUID,
  p_variante_id UUID,
  p_cantidad DECIMAL,
  p_tipo TEXT,
  p_venta_id UUID DEFAULT NULL,
  p_compra_id UUID DEFAULT NULL,
  p_traspaso_id UUID DEFAULT NULL,
  p_ajuste_id UUID DEFAULT NULL,
  p_incluir_vencidos BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (o_lote_id UUID, o_cantidad DECIMAL)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_resto DECIMAL(10,3) := p_cantidad;
  v_toma DECIMAL(10,3);
  v_hoy DATE := public._hoy_mx();
  v_ex RECORD;
BEGIN
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RETURN;
  END IF;

  FOR v_ex IN
    SELECT e.id, e.lote_id, e.cantidad
    FROM public.existencias_lote e
    JOIN public.lotes l ON l.id = e.lote_id
    WHERE e.sucursal_id = p_sucursal_id
      AND l.producto_id = p_producto_id
      AND l.variante_id IS NOT DISTINCT FROM p_variante_id
      AND e.cantidad > 0
      AND (p_incluir_vencidos OR l.fecha_caducidad IS NULL OR l.fecha_caducidad >= v_hoy)
    ORDER BY l.fecha_caducidad ASC NULLS LAST, l.creado_en, l.id
    FOR UPDATE OF e
  LOOP
    EXIT WHEN v_resto <= 0;
    v_toma := LEAST(v_resto, v_ex.cantidad);

    PERFORM public._sumar_existencia_lote(
      v_ex.lote_id, p_sucursal_id, -v_toma, p_tipo,
      p_venta_id, p_compra_id, p_traspaso_id, p_ajuste_id
    );

    o_lote_id := v_ex.lote_id;
    o_cantidad := v_toma;
    RETURN NEXT;

    v_resto := v_resto - v_toma;
  END LOOP;
END;
$fn$;

-- Total en lotes (vigentes y caducados) de (sucursal, producto, variante).
CREATE OR REPLACE FUNCTION public._cantidad_en_lotes(
  p_sucursal_id UUID, p_producto_id UUID, p_variante_id UUID
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(SUM(e.cantidad), 0)
  FROM public.existencias_lote e
  JOIN public.lotes l ON l.id = e.lote_id
  WHERE e.sucursal_id = p_sucursal_id
    AND l.producto_id = p_producto_id
    AND l.variante_id IS NOT DISTINCT FROM p_variante_id;
$fn$;

-- Lo que hay en lotes YA CADUCADOS: eso no se vende.
CREATE OR REPLACE FUNCTION public._cantidad_vencida(
  p_sucursal_id UUID, p_producto_id UUID, p_variante_id UUID
)
RETURNS DECIMAL
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE(SUM(e.cantidad), 0)
  FROM public.existencias_lote e
  JOIN public.lotes l ON l.id = e.lote_id
  WHERE e.sucursal_id = p_sucursal_id
    AND l.producto_id = p_producto_id
    AND l.variante_id IS NOT DISTINCT FROM p_variante_id
    AND l.fecha_caducidad < public._hoy_mx();
$fn$;

-- Alta (o reuso por numero) de un lote y entrada de existencia en una sucursal.
-- No mueve stock_sucursal: eso lo hace quien llama (compra, entrada manual).
CREATE OR REPLACE FUNCTION public._entrar_lote(
  p_tenant_id UUID,
  p_sucursal_id UUID,
  p_producto_id UUID,
  p_variante_id UUID,
  p_numero TEXT,
  p_fecha_caducidad DATE,
  p_fecha_fabricacion DATE,
  p_costo_unitario DECIMAL,
  p_cantidad DECIMAL,
  p_tipo TEXT,
  p_compra_id UUID DEFAULT NULL,
  p_ajuste_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_numero TEXT := NULLIF(btrim(p_numero), '');
  v_lote UUID;
BEGIN
  IF v_numero IS NULL THEN
    RAISE EXCEPTION 'El lote necesita un numero';
  END IF;
  IF length(v_numero) > 60 THEN
    RAISE EXCEPTION 'El numero de lote es demasiado largo';
  END IF;
  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad del lote debe ser mayor que cero';
  END IF;

  SELECT l.id INTO v_lote
  FROM public.lotes l
  WHERE l.tenant_id = p_tenant_id
    AND l.producto_id = p_producto_id
    AND l.variante_id IS NOT DISTINCT FROM p_variante_id
    AND l.numero_lote = v_numero
  FOR UPDATE;

  IF v_lote IS NULL THEN
    INSERT INTO public.lotes (
      tenant_id, producto_id, variante_id, numero_lote, cantidad,
      fecha_caducidad, fecha_fabricacion, costo_unitario
    ) VALUES (
      p_tenant_id, p_producto_id, p_variante_id, v_numero, 0,
      p_fecha_caducidad, p_fecha_fabricacion, COALESCE(p_costo_unitario, 0)
    )
    RETURNING id INTO v_lote;
  ELSE
    -- El mismo lote que vuelve a entrar: se completan las fechas que faltaban.
    UPDATE public.lotes
    SET fecha_caducidad = COALESCE(fecha_caducidad, p_fecha_caducidad),
        fecha_fabricacion = COALESCE(fecha_fabricacion, p_fecha_fabricacion),
        actualizado_en = NOW()
    WHERE id = v_lote;
  END IF;

  PERFORM public._sumar_existencia_lote(
    v_lote, p_sucursal_id, p_cantidad, p_tipo,
    NULL, p_compra_id, NULL, p_ajuste_id
  );

  -- Con su primer lote, el producto pasa a "Maneja lotes y caducidad".
  UPDATE public.productos
  SET permite_lotes = TRUE
  WHERE id = p_producto_id AND NOT COALESCE(permite_lotes, FALSE);

  RETURN v_lote;
END;
$fn$;

-- Ninguna de las internas se llama desde el navegador.
REVOKE ALL ON FUNCTION public._sincronizar_cantidad_lote() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._sumar_existencia_lote(UUID, UUID, DECIMAL, TEXT, UUID, UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._consumir_lotes(UUID, UUID, UUID, DECIMAL, TEXT, UUID, UUID, UUID, UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cantidad_en_lotes(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._cantidad_vencida(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._entrar_lote(UUID, UUID, UUID, UUID, TEXT, DATE, DATE, DECIMAL, DECIMAL, TEXT, UUID, UUID) FROM PUBLIC, anon, authenticated;

-- -----------------------------------------------------------------------------
-- 7. Cuadre: si el stock baja por una ruta que no sabe de lotes, los lotes
--    nunca quedan por encima del stock. Consume FEFO (los caducados primero).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._cuadrar_lotes_con_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_en_lotes DECIMAL(10,3);
  v_stock DECIMAL(10,3) := GREATEST(NEW.cantidad, 0);
BEGIN
  v_en_lotes := public._cantidad_en_lotes(NEW.sucursal_id, NEW.producto_id, NEW.variante_id);
  IF v_en_lotes > v_stock THEN
    PERFORM 1 FROM public._consumir_lotes(
      NEW.sucursal_id, NEW.producto_id, NEW.variante_id, v_en_lotes - v_stock, 'CUADRE',
      p_incluir_vencidos => TRUE
    );
  END IF;
  RETURN NULL;
END;
$fn$;

REVOKE ALL ON FUNCTION public._cuadrar_lotes_con_stock() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_stock_sucursal_cuadre_lotes ON public.stock_sucursal;
CREATE TRIGGER trg_stock_sucursal_cuadre_lotes
  AFTER UPDATE OF cantidad ON public.stock_sucursal
  FOR EACH ROW
  WHEN (NEW.cantidad < OLD.cantidad)
  EXECUTE FUNCTION public._cuadrar_lotes_con_stock();

-- -----------------------------------------------------------------------------
-- 8. registrar_lote: alta manual desde la pestana Lotes
-- -----------------------------------------------------------------------------
-- p_suma_stock = FALSE ("ya lo tengo en inventario"): reparte stock sin lote
--   que ya existe; no puede pasar de lo que hay sin lote en esa sucursal.
-- p_suma_stock = TRUE ("entrada nueva"): ademas suma al inventario, con su
--   registro en ajustes_inventario para que el stock no aparezca de la nada.
CREATE OR REPLACE FUNCTION public.registrar_lote(
  p_producto_id UUID,
  p_variante_id UUID,
  p_sucursal_id UUID,
  p_numero TEXT,
  p_fecha_caducidad DATE,
  p_fecha_fabricacion DATE,
  p_costo_unitario NUMERIC,
  p_cantidad NUMERIC,
  p_suma_stock BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant UUID;
  v_nombre TEXT;
  v_servicio BOOLEAN;
  v_sucursal UUID;
  v_stock DECIMAL(10,3);
  v_sin_lote DECIMAL(10,3);
  v_ajuste UUID;
  v_lote UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Mismo candado que la venta: serializa con un cobro del mismo producto.
  SELECT p.tenant_id, p.nombre, COALESCE(p.es_servicio, FALSE)
  INTO v_tenant, v_nombre, v_servicio
  FROM public.productos p
  WHERE p.id = p_producto_id AND p.archivado_en IS NULL
  FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado';
  END IF;

  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar lotes';
  END IF;

  IF v_servicio THEN
    RAISE EXCEPTION '"%" es un servicio: no maneja lotes', v_nombre;
  END IF;

  IF p_variante_id IS NOT NULL THEN
    PERFORM 1 FROM public.variantes_producto v
    WHERE v.id = p_variante_id AND v.producto_id = p_producto_id AND v.tenant_id = v_tenant
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'La variante no pertenece a "%"', v_nombre;
    END IF;
  ELSIF EXISTS (
    SELECT 1 FROM public.variantes_producto v
    WHERE v.producto_id = p_producto_id AND v.archivado_en IS NULL
  ) THEN
    RAISE EXCEPTION '"%" tiene variantes: elige a cual pertenece el lote', v_nombre;
  END IF;

  IF p_cantidad IS NULL OR p_cantidad <= 0 THEN
    RAISE EXCEPTION 'La cantidad del lote debe ser mayor que cero';
  END IF;

  v_sucursal := public._sucursal_para_usuario(v_tenant, p_sucursal_id);
  v_stock := public.stock_disponible(v_sucursal, p_producto_id, p_variante_id, 0);

  IF p_suma_stock THEN
    INSERT INTO public.ajustes_inventario (
      tenant_id, producto_id, variante_id, motivo,
      cantidad_anterior, cantidad_ajuste, cantidad_nueva,
      notas, usuario_id, sucursal_id
    ) VALUES (
      v_tenant, p_producto_id, p_variante_id, 'OTRO',
      v_stock, p_cantidad, v_stock + p_cantidad,
      'Entrada del lote ' || btrim(p_numero), auth.uid(), v_sucursal
    ) RETURNING id INTO v_ajuste;

    PERFORM public.mover_stock(v_sucursal, p_producto_id, p_variante_id, p_cantidad);

    v_lote := public._entrar_lote(
      v_tenant, v_sucursal, p_producto_id, p_variante_id, p_numero,
      p_fecha_caducidad, p_fecha_fabricacion, p_costo_unitario, p_cantidad,
      'ENTRADA', NULL, v_ajuste
    );
  ELSE
    v_sin_lote := v_stock - public._cantidad_en_lotes(v_sucursal, p_producto_id, p_variante_id);
    IF p_cantidad > v_sin_lote THEN
      RAISE EXCEPTION 'Solo hay % sin lote de "%" en esta sucursal. Si es mercancia nueva, marca "Entrada nueva" para sumarla al inventario.',
        GREATEST(v_sin_lote, 0), v_nombre;
    END IF;

    v_lote := public._entrar_lote(
      v_tenant, v_sucursal, p_producto_id, p_variante_id, p_numero,
      p_fecha_caducidad, p_fecha_fabricacion, p_costo_unitario, p_cantidad,
      'ASIGNACION'
    );
  END IF;

  RETURN jsonb_build_object('lote_id', v_lote, 'sucursal_id', v_sucursal);
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_lote(UUID, UUID, UUID, TEXT, DATE, DATE, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_lote(UUID, UUID, UUID, TEXT, DATE, DATE, NUMERIC, NUMERIC, BOOLEAN) TO authenticated;

-- -----------------------------------------------------------------------------
-- 9. _crear_venta_desde_items: lotes en el bucle de stock
-- -----------------------------------------------------------------------------
-- Igual que en la 107 salvo el ultimo bucle: ahora agrupa por (producto,
-- variante) —dos renglones del mismo producto se validan juntos—, impide
-- vender piezas de lotes caducados y consume los lotes FEFO antes de mover el
-- stock. Un producto sin lotes se comporta exactamente como antes.
CREATE OR REPLACE FUNCTION public._crear_venta_desde_items(p_tenant_id uuid, p_usuario_id uuid, p_cliente_id uuid, p_metodo_pago metodo_pago, p_items jsonb, p_include_iva boolean DEFAULT true, p_notas text DEFAULT NULL::text, p_monto_recibido numeric DEFAULT NULL::numeric, p_idempotency_key uuid DEFAULT NULL::uuid, p_fecha_venta timestamp with time zone DEFAULT NULL::timestamp with time zone, p_caja_id uuid DEFAULT NULL::uuid, p_total_cobrado numeric DEFAULT NULL::numeric, p_permitir_stock_negativo boolean DEFAULT false, p_origen text DEFAULT 'online'::text, p_lista_precio_id uuid DEFAULT NULL::uuid, p_tope_descuento_pct numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sucursal_id UUID;
  v_item JSONB;
  v_line RECORD;
  v_producto RECORD;
  v_variante RECORD;
  v_venta_id UUID;
  v_subtotal DECIMAL(10,2) := 0;
  v_descuento DECIMAL(10,2) := 0;
  v_impuesto DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_line_subtotal DECIMAL(10,2) := 0;
  v_line_descuento DECIMAL(10,2) := 0;
  v_precio DECIMAL(10,2);
  v_costo DECIMAL(10,2);
  v_cantidad DECIMAL(10,3);
  v_lista_id UUID;
  v_precio_lista DECIMAL(10,2);
  v_stock DECIMAL(10,3);
  v_variante_id UUID;
  v_caja_id UUID;
  v_venta JSONB;
  v_cambio DECIMAL(10,2);
  v_requiere_revision BOOLEAN := FALSE;
  v_fecha_venta TIMESTAMPTZ;
  v_vencida DECIMAL(10,3);
  v_nombre TEXT;
  v_lote_vencido TEXT;
BEGIN
  -- Antes del bucle de renglones a proposito: ahi se valida el stock y hace
  -- falta saber CONTRA QUE LOCAL se valida.
  -- La caja tiene que ser DE ESTE NEGOCIO: sin el filtro por tenant, una caja
  -- ajena decidia en que almacen se descontaba (migracion 082).
  SELECT c.sucursal_id INTO v_sucursal_id
  FROM public.cajas c
  WHERE c.id = p_caja_id
    AND c.tenant_id = p_tenant_id;

  -- Sin caja explicita, la que el cajero tenga abierta: es la misma que la
  -- funcion usa mas abajo para registrar el movimiento de dinero.
  IF v_sucursal_id IS NULL THEN
    SELECT c.sucursal_id INTO v_sucursal_id
    FROM public.cajas c
    WHERE c.tenant_id = p_tenant_id
      AND c.usuario_id = p_usuario_id
      AND c.estado = 'ABIERTA'
    ORDER BY c.fecha_apertura DESC
    LIMIT 1;
  END IF;

  -- Y si aun asi no hay, el local por defecto. Nunca NULL: validar el stock en
  -- un sitio y descontarlo en otro era justo el fallo.
  IF v_sucursal_id IS NULL THEN
    v_sucursal_id := public._sucursal_para_usuario(p_tenant_id, NULL);
  END IF;

  IF p_idempotency_key IS NOT NULL THEN
    SELECT to_jsonb(v.*) INTO v_venta
    FROM public.ventas v
    WHERE v.idempotency_key = p_idempotency_key;

    IF v_venta IS NOT NULL THEN
      RETURN v_venta;
    END IF;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;

  IF p_origen NOT IN ('online', 'offline') THEN
    RAISE EXCEPTION 'Origen de venta invalido: %', p_origen;
  END IF;

  IF p_metodo_pago = 'CREDITO' AND p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona un cliente para la venta a credito';
  END IF;

  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id AND tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Cliente invalido para este negocio';
    END IF;
  END IF;

  -- La lista tiene que ser DE ESTE NEGOCIO. Sin esta comprobacion, un
  -- cliente manipulado podria mandar el id de la lista de otro negocio y
  -- cobrarse a si mismo el precio que quisiera (mismo agujero que la
  -- validacion de variante de la 056).
  --
  -- NO se exige que este activa, a proposito. Una venta offline se sube
  -- horas despues; si para entonces el dueno desactivo la lista, exigirlo
  -- dejaria esa venta sin poder sincronizar NUNCA. `activa` decide que
  -- ofrece el punto de venta, no que honra el servidor de lo ya vendido.
  IF p_lista_precio_id IS NOT NULL THEN
    SELECT id INTO v_lista_id
    FROM public.listas_precios
    WHERE id = p_lista_precio_id AND tenant_id = p_tenant_id;

    IF v_lista_id IS NULL THEN
      RAISE EXCEPTION 'Lista de precios invalida para este negocio';
    END IF;
  END IF;

  -- 107: candados en orden fijo. Todos los productos y variantes del
  -- carrito, ordenados por id: dos cajas con los mismos productos ya no
  -- se bloquean en cruz (deadlock); la segunda espera a la primera.
  PERFORM 1 FROM public.productos
  WHERE id IN (
    SELECT DISTINCT (e.value->>'productId')::UUID
    FROM jsonb_array_elements(p_items) e
  )
    AND tenant_id = p_tenant_id
  ORDER BY id
  FOR UPDATE;

  PERFORM 1 FROM public.variantes_producto
  WHERE id IN (
    SELECT DISTINCT NULLIF(e.value->>'varianteId', '')::UUID
    FROM jsonb_array_elements(p_items) e
  )
    AND tenant_id = p_tenant_id
  ORDER BY id
  FOR UPDATE;

  DROP TABLE IF EXISTS _venta_items;
  CREATE TEMP TABLE _venta_items (
    producto_id UUID NOT NULL,
    variante_id UUID,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_venta DECIMAL(10,2),
    es_servicio BOOLEAN NOT NULL DEFAULT FALSE
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, tenant_id, nombre, stock_actual, precio_venta, costo_compra, es_servicio
    INTO v_producto
    FROM public.productos
    WHERE id = (v_item->>'productId')::UUID
    FOR UPDATE;

    IF v_producto.id IS NULL OR v_producto.tenant_id <> p_tenant_id THEN
      RAISE EXCEPTION 'Producto invalido para este negocio';
    END IF;

    v_cantidad := (v_item->>'cantidad')::DECIMAL;
    IF v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad invalida para "%"', v_producto.nombre;
    END IF;

    v_variante_id := NULLIF(v_item->>'varianteId', '')::UUID;

    IF v_variante_id IS NOT NULL THEN
      -- La variante tiene su PROPIO precio, costo y stock. Se valida que
      -- pertenezca al producto Y al negocio: sin eso, un cliente manipulado
      -- podria mandar el id de una variante ajena y vender a su precio.
      SELECT id, precio_venta, costo_compra, stock_actual
      INTO v_variante
      FROM public.variantes_producto
      WHERE id = v_variante_id
        AND producto_id = v_producto.id
        AND tenant_id = p_tenant_id
      FOR UPDATE;

      IF v_variante.id IS NULL THEN
        RAISE EXCEPTION 'Variante invalida para "%"', v_producto.nombre;
      END IF;

      -- Precio 0 en la variante = "usa el del producto". Evita obligar a
      -- repetir el precio en cada talla cuando todas valen lo mismo.
      v_precio := CASE WHEN v_variante.precio_venta > 0
                       THEN v_variante.precio_venta
                       ELSE v_producto.precio_venta END;
      v_costo := CASE WHEN v_variante.costo_compra > 0
                      THEN v_variante.costo_compra
                      ELSE v_producto.costo_compra END;
      v_stock := public.stock_disponible(v_sucursal_id, v_producto.id, v_variante_id, v_variante.stock_actual);
    ELSE
      -- Venta "general": del stock sin clasificar del producto.
      v_precio := v_producto.precio_venta;
      v_costo := v_producto.costo_compra;
      v_stock := public.stock_disponible(v_sucursal_id, v_producto.id, NULL, v_producto.stock_actual);
    END IF;

    -- Lista de precios: pisa al precio base, nunca al costo ni al stock.
    -- Se busca con IS NOT DISTINCT FROM porque la venta general lleva
    -- variante NULL, y `= NULL` no es cierto nunca (mismo fallo que se
    -- corrigio en removeItemFromPriceList).
    --
    -- Un renglon con precio NULL ("No definido") deja el precio base: es la
    -- regla que ya aplica la pantalla de listas, y tiene que ser la MISMA en
    -- los dos lados o el ticket no cuadraria con lo cobrado.
    IF v_lista_id IS NOT NULL THEN
      SELECT pl.precio INTO v_precio_lista
      FROM public.precios_lista pl
      WHERE pl.lista_id = v_lista_id
        AND pl.producto_id = v_producto.id
        AND pl.variante_id IS NOT DISTINCT FROM v_variante_id;

      IF v_precio_lista IS NOT NULL THEN
        v_precio := v_precio_lista;
      END IF;
    END IF;

    IF NOT public.se_vende_en(v_sucursal_id, v_producto.id) THEN
      RAISE EXCEPTION '"%" no se vende en esta sucursal', v_producto.nombre;
    END IF;

    IF NOT COALESCE(v_producto.es_servicio, FALSE) AND v_stock < v_cantidad THEN
      IF p_permitir_stock_negativo THEN
        v_requiere_revision := TRUE;
      ELSE
        RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_stock;
      END IF;
    END IF;

    v_line_descuento := ROUND(COALESCE((v_item->>'descuento')::DECIMAL, 0)::NUMERIC, 2);
    IF v_line_descuento < 0 THEN
      v_line_descuento := 0;
    END IF;
    IF v_line_descuento > ROUND((v_precio * v_cantidad)::NUMERIC, 2) THEN
      v_line_descuento := ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    END IF;

    v_subtotal := v_subtotal + ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    v_descuento := v_descuento + v_line_descuento;

    INSERT INTO _venta_items (producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio)
    VALUES (v_producto.id, v_variante_id, v_cantidad, v_precio, v_line_descuento, v_costo, COALESCE(v_producto.es_servicio, FALSE));
  END LOOP;

  -- Tope del descuento manual (094): el cajero sin `sales.discount_unlimited`
  -- no puede descontar mas del porcentaje que le pase `complete_sale`.
  IF p_tope_descuento_pct IS NOT NULL
     AND v_descuento > ROUND((v_subtotal * p_tope_descuento_pct / 100)::NUMERIC, 2) THEN
    RAISE EXCEPTION 'El descuento supera el máximo permitido (% %% del ticket)', p_tope_descuento_pct;
  END IF;

  v_impuesto := CASE WHEN p_include_iva
    THEN ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2)
    ELSE 0 END;
  v_total := ROUND(((v_subtotal - v_descuento + v_impuesto))::NUMERIC, 2);

  IF p_total_cobrado IS NOT NULL AND ROUND(p_total_cobrado::NUMERIC, 2) <> v_total THEN
    v_requiere_revision := TRUE;
  END IF;

  IF p_monto_recibido IS NOT NULL THEN
    IF p_monto_recibido < v_total THEN
      RAISE EXCEPTION 'El monto recibido ($%) es menor al total de la venta ($%)', p_monto_recibido, v_total;
    END IF;
    v_cambio := ROUND((p_monto_recibido - v_total)::NUMERIC, 2);
  ELSE
    v_cambio := NULL;
  END IF;

  v_fecha_venta := COALESCE(p_fecha_venta, NOW());

  INSERT INTO public.ventas (
    tenant_id, usuario_id, cliente_id,
    subtotal, impuesto, descuento, total,
    metodo_pago, estado, notas,
    monto_recibido, cambio, fecha_venta,
    idempotency_key, origen, requiere_revision, total_cobrado, lista_precio_id, sucursal_id
  ) VALUES (
    p_tenant_id, p_usuario_id, p_cliente_id,
    v_subtotal, v_impuesto, v_descuento, v_total,
    p_metodo_pago, 'COMPLETADA', p_notas,
    p_monto_recibido, v_cambio, v_fecha_venta,
    p_idempotency_key, p_origen, v_requiere_revision, p_total_cobrado, v_lista_id, v_sucursal_id
  )
  RETURNING id INTO v_venta_id;

  FOR v_line IN
    SELECT producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio
    FROM _venta_items
  LOOP
    v_line_subtotal := ROUND((v_line.precio_venta * v_line.cantidad)::NUMERIC, 2);

    INSERT INTO public.detalle_ventas (
      venta_id, producto_id, variante_id, cantidad, precio_unitario, subtotal,
      descuento, costo_unitario
    ) VALUES (
      v_venta_id, v_line.producto_id, v_line.variante_id, v_line.cantidad,
      v_line.precio_venta, v_line_subtotal, v_line.descuento, v_line.costo_venta
    );

    -- Cada venta descuenta de SU propio anaquel: la variante del suyo, la venta
    -- general del stock sin clasificar del producto. No se tocan ambos: serian
    -- dos cifras que habria que mantener cuadradas a mano.
  END LOOP;

  -- 107: el stock se mueve en orden fijo (producto, variante), igual que
  -- los candados de arriba. Los servicios no mueven stock.
  -- 116: agrupado por (producto, variante). Las piezas de lotes caducados no
  -- se venden, y los lotes se consumen FEFO ANTES de mover el stock (asi el
  -- cuadre de lotes no se dispara en una venta).
  FOR v_line IN
    SELECT producto_id, variante_id, SUM(cantidad) AS cantidad
    FROM _venta_items
    WHERE NOT es_servicio
    GROUP BY producto_id, variante_id
    ORDER BY producto_id, variante_id NULLS FIRST
  LOOP
    v_vencida := public._cantidad_vencida(v_sucursal_id, v_line.producto_id, v_line.variante_id);

    IF v_vencida > 0 AND NOT p_permitir_stock_negativo THEN
      v_stock := public.stock_disponible(v_sucursal_id, v_line.producto_id, v_line.variante_id, 0);
      IF v_stock - v_vencida < v_line.cantidad THEN
        SELECT p.nombre INTO v_nombre FROM public.productos p WHERE p.id = v_line.producto_id;
        SELECT l.numero_lote INTO v_lote_vencido
        FROM public.existencias_lote e
        JOIN public.lotes l ON l.id = e.lote_id
        WHERE e.sucursal_id = v_sucursal_id
          AND l.producto_id = v_line.producto_id
          AND l.variante_id IS NOT DISTINCT FROM v_line.variante_id
          AND e.cantidad > 0
          AND l.fecha_caducidad < public._hoy_mx()
        ORDER BY l.fecha_caducidad
        LIMIT 1;

        RAISE EXCEPTION 'No se puede vender "%": hay piezas de lotes caducados (lote %). Disponible para vender: %',
          v_nombre, v_lote_vencido, GREATEST(v_stock - v_vencida, 0);
      END IF;
    END IF;

    PERFORM 1 FROM public._consumir_lotes(
      v_sucursal_id, v_line.producto_id, v_line.variante_id, v_line.cantidad, 'VENTA',
      p_venta_id => v_venta_id
    );
    PERFORM public.mover_stock(v_sucursal_id, v_line.producto_id, v_line.variante_id, -v_line.cantidad);
  END LOOP;

  IF p_metodo_pago = 'CREDITO' THEN
    UPDATE public.clientes
    SET saldo_pendiente = saldo_pendiente + v_total
    WHERE id = p_cliente_id;
  END IF;

  IF p_caja_id IS NOT NULL THEN
    SELECT id INTO v_caja_id
    FROM public.cajas
    WHERE id = p_caja_id AND tenant_id = p_tenant_id;

    IF v_caja_id IS NULL THEN
      v_requiere_revision := TRUE;
      UPDATE public.ventas SET requiere_revision = TRUE WHERE id = v_venta_id;
    END IF;
  ELSE
    SELECT id INTO v_caja_id
    FROM public.cajas
    WHERE tenant_id = p_tenant_id
      AND usuario_id = p_usuario_id
      AND estado = 'ABIERTA'
    ORDER BY fecha_apertura DESC
    LIMIT 1;
  END IF;

  IF v_caja_id IS NOT NULL THEN
    INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, fecha)
    VALUES (
      v_caja_id, 'VENTA', v_total,
      'Venta #' || LEFT(v_venta_id::text, 8) || ' - ' || p_metodo_pago::text
        || CASE WHEN p_origen = 'offline' THEN ' (offline)' ELSE '' END,
      v_fecha_venta
    );
  END IF;

  SELECT to_jsonb(v.*) INTO v_venta
  FROM public.ventas v
  WHERE v.id = v_venta_id;

  RETURN v_venta;
END;
$function$;

-- -----------------------------------------------------------------------------
-- 10. registrar_traspaso: candados ordenados y los lotes viajan
-- -----------------------------------------------------------------------------
-- Por renglon sale primero lo de lotes vigentes (FEFO), despues lo que esta
-- sin lote y al final, solo si hace falta, lo de lotes caducados. Cada lote que
-- sale del origen entra al destino con su misma caducidad.
CREATE OR REPLACE FUNCTION public.registrar_traspaso(p_origen_id uuid, p_destino_id uuid, p_items jsonb, p_notas text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant UUID;
  v_tenant_destino UUID;
  v_destino_activa BOOLEAN;
  v_traspaso UUID;
  v_item JSONB;
  v_producto UUID;
  v_variante UUID;
  v_cantidad DECIMAL(10,3);
  v_nombre TEXT;
  v_servicio BOOLEAN;
  v_disponible DECIMAL(10,3);
  v_sin_lote DECIMAL(10,3);
  v_movido DECIMAL(10,3);
  v_resto DECIMAL(10,3);
  v_lotes JSONB;
  v_r RECORD;
  v_lineas INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_origen_id IS NULL OR p_destino_id IS NULL OR p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'Elige dos sucursales distintas';
  END IF;

  SELECT s.tenant_id INTO v_tenant FROM public.sucursales s WHERE s.id = p_origen_id;
  SELECT s.tenant_id, s.activa INTO v_tenant_destino, v_destino_activa
  FROM public.sucursales s WHERE s.id = p_destino_id;

  IF v_tenant IS NULL OR v_tenant_destino IS NULL OR v_tenant <> v_tenant_destino THEN
    RAISE EXCEPTION 'Las dos sucursales tienen que ser del mismo negocio';
  END IF;

  -- El ORIGEN puede estar cerrado —vaciar un local que cierra es justo para lo
  -- que sirve un traspaso—, pero el DESTINO no.
  IF NOT v_destino_activa THEN
    RAISE EXCEPTION 'La sucursal de destino esta cerrada';
  END IF;

  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para traspasar mercancia';
  END IF;

  IF p_origen_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'No tienes asignada la sucursal de origen';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El traspaso no tiene productos';
  END IF;

  -- 116: candados en orden fijo por id (regla de la 107), antes del bucle.
  PERFORM 1 FROM public.productos
  WHERE id IN (
    SELECT DISTINCT NULLIF(e.value->>'producto_id', '')::UUID
    FROM jsonb_array_elements(p_items) e
  )
    AND tenant_id = v_tenant
  ORDER BY id
  FOR UPDATE;

  PERFORM 1 FROM public.variantes_producto
  WHERE id IN (
    SELECT DISTINCT NULLIF(e.value->>'variante_id', '')::UUID
    FROM jsonb_array_elements(p_items) e
  )
    AND tenant_id = v_tenant
  ORDER BY id
  FOR UPDATE;

  INSERT INTO public.traspasos (tenant_id, sucursal_origen_id, sucursal_destino_id, usuario_id, notas)
  VALUES (v_tenant, p_origen_id, p_destino_id, auth.uid(), NULLIF(btrim(p_notas), ''))
  RETURNING id INTO v_traspaso;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::UUID;
    v_variante := NULLIF(v_item->>'variante_id', '')::UUID;
    v_cantidad := (v_item->>'cantidad')::DECIMAL;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada producto necesita una cantidad mayor que cero';
    END IF;

    SELECT p.nombre, COALESCE(p.es_servicio, FALSE) INTO v_nombre, v_servicio
    FROM public.productos p
    WHERE p.id = v_producto AND p.tenant_id = v_tenant;

    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'Un producto del traspaso no pertenece a este negocio';
    END IF;

    IF v_servicio THEN
      RAISE EXCEPTION '"%" es un servicio: no tiene existencias que traspasar', v_nombre;
    END IF;

    IF v_variante IS NOT NULL THEN
      PERFORM 1 FROM public.variantes_producto v
      WHERE v.id = v_variante AND v.producto_id = v_producto;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante no pertenece a "%"', v_nombre;
      END IF;
    END IF;

    v_disponible := public.stock_disponible(p_origen_id, v_producto, v_variante, 0);
    IF v_disponible < v_cantidad THEN
      RAISE EXCEPTION 'No hay suficiente "%" en la sucursal de origen. Disponible: %', v_nombre, v_disponible;
    END IF;

    -- Lotes que salen del origen.
    v_sin_lote := GREATEST(v_disponible - public._cantidad_en_lotes(p_origen_id, v_producto, v_variante), 0);
    v_lotes := '[]'::JSONB;
    v_movido := 0;

    FOR v_r IN
      SELECT * FROM public._consumir_lotes(
        p_origen_id, v_producto, v_variante, v_cantidad, 'TRASPASO_SALIDA',
        p_traspaso_id => v_traspaso
      )
    LOOP
      v_lotes := v_lotes || jsonb_build_object('lote_id', v_r.o_lote_id, 'cantidad', v_r.o_cantidad);
      v_movido := v_movido + v_r.o_cantidad;
    END LOOP;

    v_resto := v_cantidad - v_movido - LEAST(v_cantidad - v_movido, v_sin_lote);
    IF v_resto > 0 THEN
      FOR v_r IN
        SELECT * FROM public._consumir_lotes(
          p_origen_id, v_producto, v_variante, v_resto, 'TRASPASO_SALIDA',
          p_traspaso_id => v_traspaso, p_incluir_vencidos => TRUE
        )
      LOOP
        v_lotes := v_lotes || jsonb_build_object('lote_id', v_r.o_lote_id, 'cantidad', v_r.o_cantidad);
      END LOOP;
    END IF;

    PERFORM public.mover_stock(p_origen_id, v_producto, v_variante, -v_cantidad);
    PERFORM public.mover_stock(p_destino_id, v_producto, v_variante, v_cantidad);

    -- Los mismos lotes entran al destino.
    FOR v_r IN SELECT * FROM jsonb_array_elements(v_lotes)
    LOOP
      PERFORM public._sumar_existencia_lote(
        (v_r.value->>'lote_id')::UUID, p_destino_id, (v_r.value->>'cantidad')::DECIMAL,
        'TRASPASO_ENTRADA', p_traspaso_id => v_traspaso
      );
    END LOOP;

    INSERT INTO public.detalle_traspaso (traspaso_id, producto_id, variante_id, cantidad)
    VALUES (v_traspaso, v_producto, v_variante, v_cantidad);

    v_lineas := v_lineas + 1;
  END LOOP;

  RETURN jsonb_build_object('traspaso_id', v_traspaso, 'lineas', v_lineas);
END;
$function$;

-- -----------------------------------------------------------------------------
-- 11. Compras: lote y caducidad opcionales por renglon
-- -----------------------------------------------------------------------------
-- Cada item acepta `numero_lote`, `fecha_caducidad` y `fecha_fabricacion`.
-- Un cliente con el codigo anterior no los manda: todo sigue igual.
CREATE OR REPLACE FUNCTION public.registrar_compra_directa(p_tenant_id uuid, p_proveedor_id uuid, p_items jsonb, p_numero_factura text DEFAULT NULL::text, p_incluye_iva boolean DEFAULT true, p_notas text DEFAULT NULL::text, p_sucursal_id uuid DEFAULT NULL::uuid, p_caja_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_item JSONB;
  v_variante RECORD;
  v_producto_id UUID;
  v_variante_id UUID;
  v_cantidad DECIMAL;
  v_costo DECIMAL;
  v_compra_id UUID;
  v_subtotal DECIMAL := 0;
  v_impuesto DECIMAL := 0;
  v_tasa_iva CONSTANT DECIMAL := 0.16;
  v_sucursal UUID;
  v_proveedor TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para registrar compras';
  END IF;

  SELECT nombre INTO v_proveedor
  FROM public.proveedores
  WHERE id = p_proveedor_id AND tenant_id = p_tenant_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El proveedor no pertenece a este negocio';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra no tiene renglones';
  END IF;

  v_sucursal := public._sucursal_para_usuario(p_tenant_id, p_sucursal_id);

  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, notas, sucursal_id
  ) VALUES (
    p_tenant_id, p_proveedor_id, v_caller_id, NULL,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), p_notas, v_sucursal
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := (v_item->>'cantidad')::DECIMAL;
    v_costo := (v_item->>'costo_unitario')::DECIMAL;
    v_variante_id := NULLIF(v_item->>'variante_id', '')::UUID;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'La cantidad de cada renglón debe ser mayor que cero';
    END IF;

    IF v_costo IS NULL OR v_costo < 0 THEN
      RAISE EXCEPTION 'El costo de cada renglón no puede ser negativo';
    END IF;

    IF v_variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_variante_id
        AND tenant_id = p_tenant_id
      RETURNING * INTO v_variante;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante % no pertenece a este negocio', v_variante_id;
      END IF;

      v_producto_id := v_variante.producto_id;

      PERFORM public.mover_stock(v_sucursal, v_producto_id, v_variante_id, v_cantidad);
    ELSE
      v_producto_id := (v_item->>'producto_id')::UUID;

      UPDATE public.productos
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_producto_id
        AND tenant_id = p_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_producto_id, NULL, v_cantidad);

      IF NOT FOUND THEN
        RAISE EXCEPTION 'El producto % no pertenece a este negocio', v_producto_id;
      END IF;
    END IF;

    -- 116: el renglon trae lote -> entra a ese lote en esta sucursal.
    IF NULLIF(btrim(v_item->>'numero_lote'), '') IS NOT NULL THEN
      PERFORM public._entrar_lote(
        p_tenant_id, v_sucursal, v_producto_id, v_variante_id,
        v_item->>'numero_lote',
        NULLIF(v_item->>'fecha_caducidad', '')::DATE,
        NULLIF(v_item->>'fecha_fabricacion', '')::DATE,
        v_costo, v_cantidad, 'COMPRA', v_compra_id
      );
    END IF;

    INSERT INTO public.detalle_compras (
      compra_id, producto_id, variante_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id, v_producto_id, v_variante_id, v_cantidad, v_costo,
      ROUND(v_cantidad * v_costo, 2)
    );

    v_subtotal := v_subtotal + v_cantidad * v_costo;
  END LOOP;

  v_subtotal := ROUND(v_subtotal, 2);
  v_impuesto := CASE WHEN p_incluye_iva THEN ROUND(v_subtotal * v_tasa_iva, 2) ELSE 0 END;

  UPDATE public.compras
  SET subtotal = v_subtotal,
      impuesto = v_impuesto,
      total = v_subtotal + v_impuesto
  WHERE id = v_compra_id;

  IF p_caja_id IS NOT NULL THEN
    PERFORM public._pagar_compra_con_caja(
      p_caja_id, p_tenant_id, v_compra_id, v_subtotal + v_impuesto,
      'Compra a ' || v_proveedor
        || COALESCE(' · Factura ' || NULLIF(TRIM(p_numero_factura), ''), '')
    );
  END IF;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto,
    'pagada_con_caja', p_caja_id IS NOT NULL
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.recibir_orden_compra(p_orden_id uuid, p_items jsonb, p_numero_factura text DEFAULT NULL::text, p_caja_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_orden RECORD;
  v_item JSONB;
  v_item_recibido RECORD;
  v_cantidad DECIMAL;
  v_todos_recibidos BOOLEAN := TRUE;
  v_compra_id UUID;
  v_subtotal DECIMAL := 0;
  v_impuesto DECIMAL := 0;
  v_tasa_iva DECIMAL := 0;
  v_sucursal UUID;
  v_proveedor TEXT;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_orden FROM public.ordenes_compra WHERE id = p_orden_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  v_tenant_id := v_orden.tenant_id;

  v_sucursal := public._sucursal_para_usuario(v_tenant_id, v_orden.sucursal_id);

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = v_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para recibir ordenes de compra';
  END IF;

  IF v_orden.estado NOT IN ('ENVIADA', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'Order cannot be received in current state: %', v_orden.estado;
  END IF;

  IF v_orden.subtotal > 0 THEN
    v_tasa_iva := v_orden.impuesto / v_orden.subtotal;
  END IF;

  INSERT INTO public.compras (
    tenant_id, proveedor_id, usuario_id, orden_compra_id,
    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, sucursal_id
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), v_sucursal
  ) RETURNING id INTO v_compra_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_cantidad := (v_item->>'cantidad_recibida')::DECIMAL;

    UPDATE public.detalle_orden_compra
    SET cantidad_recibida = cantidad_recibida + v_cantidad
    WHERE id = (v_item->>'detalle_id')::UUID
    AND orden_compra_id = p_orden_id
    RETURNING * INTO v_item_recibido;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'El renglón % no pertenece a esta orden', v_item->>'detalle_id';
    END IF;

    IF v_item_recibido.variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.variante_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_item_recibido.producto_id, v_item_recibido.variante_id, v_cantidad);

      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante del renglón % no pertenece a este negocio', v_item->>'detalle_id';
      END IF;
    ELSE
      UPDATE public.productos
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.producto_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(v_sucursal, v_item_recibido.producto_id, NULL, v_cantidad);
    END IF;

    -- 116: lote opcional del renglon recibido.
    IF v_cantidad > 0 AND NULLIF(btrim(v_item->>'numero_lote'), '') IS NOT NULL THEN
      PERFORM public._entrar_lote(
        v_tenant_id, v_sucursal, v_item_recibido.producto_id, v_item_recibido.variante_id,
        v_item->>'numero_lote',
        NULLIF(v_item->>'fecha_caducidad', '')::DATE,
        NULLIF(v_item->>'fecha_fabricacion', '')::DATE,
        v_item_recibido.costo_unitario, v_cantidad, 'COMPRA', v_compra_id
      );
    END IF;

    INSERT INTO public.detalle_compras (
      compra_id, producto_id, variante_id, cantidad, costo_unitario, subtotal
    ) VALUES (
      v_compra_id,
      v_item_recibido.producto_id,
      v_item_recibido.variante_id,
      v_cantidad,
      v_item_recibido.costo_unitario,
      ROUND(v_cantidad * v_item_recibido.costo_unitario, 2)
    );

    v_subtotal := v_subtotal + v_cantidad * v_item_recibido.costo_unitario;

    IF v_item_recibido.cantidad_recibida < v_item_recibido.cantidad_solicitada THEN
      v_todos_recibidos := FALSE;
    END IF;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM public.detalle_orden_compra
    WHERE orden_compra_id = p_orden_id
      AND cantidad_recibida < cantidad_solicitada
  ) THEN
    v_todos_recibidos := FALSE;
  END IF;

  v_impuesto := ROUND(v_subtotal * v_tasa_iva, 2);
  v_subtotal := ROUND(v_subtotal, 2);

  UPDATE public.compras
  SET subtotal = v_subtotal,
      impuesto = v_impuesto,
      total = v_subtotal + v_impuesto
  WHERE id = v_compra_id;

  IF v_todos_recibidos THEN
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_TOTAL', fecha_recepcion = NOW(), actualizado_en = NOW()
    WHERE id = p_orden_id;
  ELSE
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_PARCIAL', fecha_recepcion = NOW(), actualizado_en = NOW()
    WHERE id = p_orden_id;
  END IF;

  IF p_caja_id IS NOT NULL THEN
    SELECT nombre INTO v_proveedor FROM public.proveedores WHERE id = v_orden.proveedor_id;
    PERFORM public._pagar_compra_con_caja(
      p_caja_id, v_tenant_id, v_compra_id, v_subtotal + v_impuesto,
      'Recepción ' || v_orden.numero_orden || COALESCE(' · ' || v_proveedor, '')
    );
  END IF;

  RETURN jsonb_build_object(
    'compra_id', v_compra_id,
    'estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END,
    'subtotal', v_subtotal,
    'impuesto', v_impuesto,
    'total', v_subtotal + v_impuesto,
    'pagada_con_caja', p_caja_id IS NOT NULL
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 12. cancelar_compra: primero salen los lotes que entraron con ella
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancelar_compra(p_compra_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_compra RECORD;
  v_renglon RECORD;
  v_revertidos INT := 0;
  v_pago RECORD;
  v_devuelto DECIMAL := 0;
  v_caja_cerrada BOOLEAN := FALSE;
  v_entrada RECORD;
  v_hay DECIMAL(10,3);
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT * INTO v_compra FROM public.compras WHERE id = p_compra_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'La compra no existe';
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = v_compra.tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'purchases.manage'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar compras';
  END IF;

  IF v_compra.estado = 'CANCELADA' THEN
    RAISE EXCEPTION 'Esta compra ya está cancelada';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.detalle_compras d
    WHERE d.compra_id = p_compra_id
      AND d.variante_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.variantes_producto v WHERE v.producto_id = d.producto_id
      )
  ) THEN
    RAISE EXCEPTION 'No se puede cancelar: esta compra es anterior al registro de variantes y no consta a qué talla o color entró el stock. Ajústalo a mano desde Inventario.';
  END IF;

  -- 116: lo que entro a un lote con esta compra sale de ESE lote (hasta lo que
  -- quede de el en esa sucursal). El resto lo cuadra el trigger de stock.
  FOR v_entrada IN
    SELECT m.lote_id, m.sucursal_id, SUM(m.cantidad) AS cantidad
    FROM public.movimientos_lote m
    WHERE m.compra_id = p_compra_id AND m.tipo = 'COMPRA'
    GROUP BY m.lote_id, m.sucursal_id
  LOOP
    SELECT e.cantidad INTO v_hay
    FROM public.existencias_lote e
    WHERE e.lote_id = v_entrada.lote_id AND e.sucursal_id = v_entrada.sucursal_id
    FOR UPDATE;

    IF COALESCE(v_hay, 0) > 0 THEN
      PERFORM public._sumar_existencia_lote(
        v_entrada.lote_id, v_entrada.sucursal_id, -LEAST(v_hay, v_entrada.cantidad),
        'CANCELACION_COMPRA', p_compra_id => p_compra_id
      );
    END IF;
  END LOOP;

  FOR v_renglon IN
    SELECT * FROM public.detalle_compras WHERE compra_id = p_compra_id
  LOOP
    PERFORM public.mover_stock(v_compra.sucursal_id, v_renglon.producto_id, v_renglon.variante_id, -v_renglon.cantidad);

    v_revertidos := v_revertidos + 1;
  END LOOP;

  UPDATE public.compras
  SET estado = 'CANCELADA'
  WHERE id = p_compra_id;

  FOR v_pago IN
    SELECT m.caja_id, m.monto, c.estado AS estado_caja
    FROM public.movimientos_caja m
    JOIN public.cajas c ON c.id = m.caja_id
    WHERE m.compra_id = p_compra_id
      AND m.concepto = 'COMPRA'
    FOR UPDATE OF c
  LOOP
    IF v_pago.estado_caja = 'ABIERTA' THEN
      INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, concepto, compra_id)
      VALUES (
        v_pago.caja_id, 'ENTRADA', v_pago.monto,
        'Devolución de compra cancelada'
          || COALESCE(' · Factura ' || NULLIF(TRIM(v_compra.numero_factura), ''), ''),
        'DEVOLUCION_COMPRA', p_compra_id
      );
      v_devuelto := v_devuelto + v_pago.monto;
    ELSE
      v_caja_cerrada := TRUE;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'compra_id', p_compra_id,
    'renglones_revertidos', v_revertidos,
    'devuelto_a_caja', v_devuelto,
    'caja_cerrada', v_caja_cerrada
  );
END;
$function$;

-- -----------------------------------------------------------------------------
-- 13. ajustar_inventario: el lote se valida y se ajusta en SU sucursal
-- -----------------------------------------------------------------------------
-- Antes: `UPDATE lotes SET cantidad = cantidad + ajuste` sin validar producto,
-- variante ni negativo. Ahora el lote tiene que ser del producto/variante y el
-- ajuste mueve su existencia en la sucursal ajustada (kardex AJUSTE).
-- El permiso es el EFECTIVO (`_puede`): la excepcion por usuario gana sobre el
-- rol, igual que authorize() (regla de CLAUDE.md).
CREATE OR REPLACE FUNCTION public.ajustar_inventario(p_producto_id uuid, p_cantidad_ajuste numeric, p_motivo motivo_ajuste, p_notas text DEFAULT NULL::text, p_variante_id uuid DEFAULT NULL::uuid, p_lote_id uuid DEFAULT NULL::uuid, p_sucursal_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_caller_id UUID;
  v_stock_anterior DECIMAL;
  v_stock_nuevo DECIMAL;
  v_ajuste_id UUID;
  v_sucursal UUID;
  v_lote RECORD;
  v_en_lote DECIMAL(10,3);
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- El tenant se deriva del REGISTRO, no del claim del JWT. El claim es el de
  -- la membresia mas reciente (custom_access_token_hook usa ORDER BY creado_en
  -- DESC LIMIT 1): para un usuario con dos negocios podia ser el equivocado.
  IF p_variante_id IS NOT NULL THEN
    SELECT tenant_id INTO v_tenant_id
    FROM public.variantes_producto WHERE id = p_variante_id;
  ELSE
    SELECT tenant_id INTO v_tenant_id
    FROM public.productos WHERE id = p_producto_id;
  END IF;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- RBAC desde la BD, nunca desde el JWT. Esta funcion es SECURITY DEFINER, o
  -- sea que SALTA RLS: sin esta comprobacion, apretar las politicas de las
  -- tablas no serviria de nada porque este RPC seguiria siendo puerta abierta.
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = v_caller_id AND tenant_id = v_tenant_id
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  IF NOT public._puede(v_tenant_id, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para ajustar el inventario';
  END IF;

  -- El local ajustado. Sin sucursal explicita, el local por defecto: para un
  -- negocio de uno solo, el comportamiento de siempre.
  -- Del negocio y asignada al usuario (migracion 085).
  v_sucursal := public._sucursal_para_usuario(v_tenant_id, p_sucursal_id);

  -- Mismo candado que la venta.
  PERFORM 1 FROM public.productos
  WHERE id = p_producto_id AND tenant_id = v_tenant_id
  FOR UPDATE;

  IF p_variante_id IS NOT NULL THEN
    SELECT stock_actual INTO v_stock_anterior
    FROM public.variantes_producto
    WHERE id = p_variante_id AND tenant_id = v_tenant_id AND producto_id = p_producto_id;
  ELSE
    SELECT stock_actual INTO v_stock_anterior
    FROM public.productos
    WHERE id = p_producto_id AND tenant_id = v_tenant_id;
  END IF;

  IF v_stock_anterior IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Lo de arriba solo comprueba que el producto exista y sea de este negocio.
  -- Lo que se ajusta es el stock DEL LOCAL, y contra ese se valida.
  v_stock_anterior := public.stock_disponible(v_sucursal, p_producto_id, p_variante_id, 0);
  v_stock_nuevo := v_stock_anterior + p_cantidad_ajuste;

  IF v_stock_nuevo < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative: %', v_stock_nuevo;
  END IF;

  IF p_lote_id IS NOT NULL THEN
    SELECT l.id, l.numero_lote INTO v_lote
    FROM public.lotes l
    WHERE l.id = p_lote_id
      AND l.tenant_id = v_tenant_id
      AND l.producto_id = p_producto_id
      AND l.variante_id IS NOT DISTINCT FROM p_variante_id;

    IF v_lote.id IS NULL THEN
      RAISE EXCEPTION 'El lote no corresponde a este producto';
    END IF;

    SELECT COALESCE(e.cantidad, 0) INTO v_en_lote
    FROM public.existencias_lote e
    WHERE e.lote_id = p_lote_id AND e.sucursal_id = v_sucursal
    FOR UPDATE;

    IF COALESCE(v_en_lote, 0) + p_cantidad_ajuste < 0 THEN
      RAISE EXCEPTION 'El lote "%" solo tiene % en esta sucursal', v_lote.numero_lote, COALESCE(v_en_lote, 0);
    END IF;
  END IF;

  -- El ajuste se registra ANTES de mover nada: el kardex del lote lo apunta.
  INSERT INTO public.ajustes_inventario (
    tenant_id, producto_id, variante_id, lote_id,
    motivo, cantidad_anterior, cantidad_ajuste, cantidad_nueva,
    notas, usuario_id, sucursal_id
  ) VALUES (
    v_tenant_id, p_producto_id, p_variante_id, p_lote_id,
    p_motivo, v_stock_anterior, p_cantidad_ajuste, v_stock_nuevo,
    p_notas, v_caller_id, v_sucursal
  ) RETURNING id INTO v_ajuste_id;

  -- Con lote, su existencia se mueve ANTES que el stock: si el stock bajara
  -- primero, el cuadre consumiria FEFO de OTRO lote.
  IF p_lote_id IS NOT NULL AND p_cantidad_ajuste <> 0 THEN
    PERFORM public._sumar_existencia_lote(
      p_lote_id, v_sucursal, p_cantidad_ajuste, 'AJUSTE', p_ajuste_id => v_ajuste_id
    );
  END IF;

  PERFORM public.mover_stock(v_sucursal, p_producto_id, p_variante_id, p_cantidad_ajuste);

  RETURN jsonb_build_object(
    'success', true,
    'ajuste_id', v_ajuste_id,
    'stock_anterior', v_stock_anterior,
    'stock_nuevo', v_stock_nuevo
  );
END;
$function$;
