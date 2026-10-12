-- =============================================================================
-- 117: Insumos por servicio (receta) y su descuento al cobrar
-- =============================================================================
-- Una consulta, una vacuna o una esterilizacion usan medicamentos e insumos.
-- Ahora un servicio puede tener su lista de insumos (`insumos_servicio`) y, al
-- cobrarlo, `_crear_venta_desde_items` los descuenta de la sucursal de la venta
-- consumiendo FEFO sus lotes (116), y deja el registro en
-- `detalle_venta_insumos` (que se uso y que falto).
--
--   * En el POS se pueden ajustar para ESA venta (dosis por peso, un extra):
--     el renglon del servicio trae `insumos` con las cantidades TOTALES. Sin
--     la clave, se usa la receta por la cantidad vendida.
--   * Si un insumo no alcanza, el cobro NO se bloquea (el servicio ya se hizo):
--     baja hasta 0 y el resto queda como `faltante`. El aviso de stock (108)
--     avisa al equipo cuando se agota.
--   * El costo del servicio incluye el de sus insumos: la ganancia es real.
--
-- Al aplicarla habia 0 servicios en produccion. `complete_sale` y
-- `complete_sale_lealtad` no cambian: pasan los items tal cual (la lealtad usa
-- jsonb_set y conserva la clave `insumos`).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. insumos_servicio: la receta
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insumos_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  -- NO ACTION: un producto que es insumo no se borra (la app ofrece archivarlo).
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.variantes_producto(id) ON DELETE CASCADE,
  cantidad DECIMAL(10,3) NOT NULL CHECK (cantidad > 0),
  orden INT NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (servicio_id <> producto_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS insumos_servicio_unico
  ON public.insumos_servicio (servicio_id, producto_id, variante_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS idx_insumos_servicio_tenant ON public.insumos_servicio(tenant_id);
CREATE INDEX IF NOT EXISTS idx_insumos_servicio_producto ON public.insumos_servicio(producto_id);
CREATE INDEX IF NOT EXISTS idx_insumos_servicio_variante ON public.insumos_servicio(variante_id)
  WHERE variante_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2. detalle_venta_insumos: que uso cada servicio vendido
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.detalle_venta_insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES public.ventas(id) ON DELETE CASCADE,
  servicio_id UUID NOT NULL REFERENCES public.productos(id),
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.variantes_producto(id),
  -- Lo que SI se desconto del inventario.
  cantidad DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (cantidad >= 0),
  -- Lo que se uso pero no habia en existencias (el conteo estaba mal).
  faltante DECIMAL(10,3) NOT NULL DEFAULT 0 CHECK (faltante >= 0),
  costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detalle_venta_insumos_venta ON public.detalle_venta_insumos(venta_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_insumos_tenant ON public.detalle_venta_insumos(tenant_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_insumos_servicio ON public.detalle_venta_insumos(servicio_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_insumos_producto ON public.detalle_venta_insumos(producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_venta_insumos_variante ON public.detalle_venta_insumos(variante_id)
  WHERE variante_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 3. RLS: lectura para el equipo; se escribe SOLO por RPC
-- -----------------------------------------------------------------------------
ALTER TABLE public.insumos_servicio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_venta_insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS insumos_servicio_select ON public.insumos_servicio;
CREATE POLICY insumos_servicio_select ON public.insumos_servicio
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Misma regla que detalle_ventas: se ve si se ve la venta.
DROP POLICY IF EXISTS detalle_venta_insumos_select ON public.detalle_venta_insumos;
CREATE POLICY detalle_venta_insumos_select ON public.detalle_venta_insumos
  FOR SELECT TO authenticated
  USING (venta_id IN (
    SELECT v.id FROM public.ventas v WHERE v.tenant_id IN (SELECT public.user_tenant_ids())
  ));

REVOKE ALL ON public.insumos_servicio, public.detalle_venta_insumos FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.insumos_servicio, public.detalle_venta_insumos FROM authenticated;
GRANT SELECT ON public.insumos_servicio, public.detalle_venta_insumos TO authenticated;

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.insumos_servicio;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.insumos_servicio
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.detalle_venta_insumos;
CREATE TRIGGER trg_solo_lectura
  BEFORE INSERT OR UPDATE OR DELETE ON public.detalle_venta_insumos
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

-- -----------------------------------------------------------------------------
-- 4. guardar_insumos_servicio: reemplaza la receta completa de un servicio
-- -----------------------------------------------------------------------------
-- p_items: [{producto_id, variante_id?, cantidad}]. Lista vacia = sin insumos.
CREATE OR REPLACE FUNCTION public.guardar_insumos_servicio(p_servicio_id UUID, p_items JSONB)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant UUID;
  v_nombre TEXT;
  v_servicio BOOLEAN;
  v_item JSONB;
  v_producto UUID;
  v_variante UUID;
  v_cantidad DECIMAL(10,3);
  v_insumo RECORD;
  v_orden INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT p.tenant_id, p.nombre, COALESCE(p.es_servicio, FALSE)
  INTO v_tenant, v_nombre, v_servicio
  FROM public.productos p
  WHERE p.id = p_servicio_id
  FOR UPDATE;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Servicio no encontrado';
  END IF;

  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para editar los insumos';
  END IF;

  IF NOT v_servicio THEN
    RAISE EXCEPTION '"%" no es un servicio: solo los servicios llevan insumos', v_nombre;
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'Lista de insumos invalida';
  END IF;

  IF jsonb_array_length(p_items) > 50 THEN
    RAISE EXCEPTION 'Un servicio puede tener hasta 50 insumos';
  END IF;

  DELETE FROM public.insumos_servicio WHERE servicio_id = p_servicio_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := NULLIF(v_item->>'producto_id', '')::UUID;
    v_variante := NULLIF(v_item->>'variante_id', '')::UUID;
    v_cantidad := (v_item->>'cantidad')::DECIMAL;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada insumo necesita una cantidad mayor que cero';
    END IF;

    SELECT p.id, p.nombre, COALESCE(p.es_servicio, FALSE) AS es_servicio, p.archivado_en
    INTO v_insumo
    FROM public.productos p
    WHERE p.id = v_producto AND p.tenant_id = v_tenant;

    IF v_insumo.id IS NULL THEN
      RAISE EXCEPTION 'Un insumo no pertenece a este negocio';
    END IF;
    IF v_insumo.id = p_servicio_id THEN
      RAISE EXCEPTION 'Un servicio no puede ser insumo de si mismo';
    END IF;
    IF v_insumo.es_servicio THEN
      RAISE EXCEPTION '"%" es un servicio: no puede ser insumo', v_insumo.nombre;
    END IF;
    IF v_insumo.archivado_en IS NOT NULL THEN
      RAISE EXCEPTION '"%" esta archivado', v_insumo.nombre;
    END IF;

    IF v_variante IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.variantes_producto v
        WHERE v.id = v_variante AND v.producto_id = v_producto AND v.archivado_en IS NULL
      ) THEN
        RAISE EXCEPTION 'La variante elegida no pertenece a "%"', v_insumo.nombre;
      END IF;
    ELSIF EXISTS (
      SELECT 1 FROM public.variantes_producto v
      WHERE v.producto_id = v_producto AND v.archivado_en IS NULL
    ) THEN
      RAISE EXCEPTION '"%" tiene variantes: elige cual se usa', v_insumo.nombre;
    END IF;

    INSERT INTO public.insumos_servicio (tenant_id, servicio_id, producto_id, variante_id, cantidad, orden)
    VALUES (v_tenant, p_servicio_id, v_producto, v_variante, v_cantidad, v_orden)
    ON CONFLICT (servicio_id, producto_id, variante_id)
    DO UPDATE SET cantidad = public.insumos_servicio.cantidad + EXCLUDED.cantidad;

    v_orden := v_orden + 1;
  END LOOP;

  RETURN v_orden;
END;
$fn$;

REVOKE ALL ON FUNCTION public.guardar_insumos_servicio(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.guardar_insumos_servicio(UUID, JSONB) TO authenticated;

-- -----------------------------------------------------------------------------
-- 5. _crear_venta_desde_items: insumos de los servicios (misma firma)
-- -----------------------------------------------------------------------------
-- Parte de la version de la 116. Cambios marcados con "117".
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
  -- 117: insumos por servicio
  v_rec RECORD;
  v_linea INT;
  v_grp RECORD;
  v_ins RECORD;
  v_libre DECIMAL(10,3);
  v_directo DECIMAL(10,3);
  v_toma DECIMAL(10,3);
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

  -- 117: insumos de los servicios del carrito. Se arman ANTES de los candados
  -- para bloquear tambien sus productos, en el mismo orden por id (107).
  -- Un renglon de servicio puede traer `insumos` (lo ajustado en el POS para
  -- ESTA venta: cantidades TOTALES de la linea); sin la clave, la receta del
  -- servicio (`insumos_servicio`) por la cantidad vendida. Los archivados se saltan.
  DROP TABLE IF EXISTS _venta_insumos;
  CREATE TEMP TABLE _venta_insumos (
    ord SERIAL,
    linea INT NOT NULL,
    servicio_id UUID NOT NULL,
    producto_id UUID NOT NULL,
    variante_id UUID,
    cantidad DECIMAL(10,3) NOT NULL,
    descontado DECIMAL(10,3) NOT NULL DEFAULT 0,
    faltante DECIMAL(10,3) NOT NULL DEFAULT 0,
    costo DECIMAL(10,2) NOT NULL DEFAULT 0
  );

  FOR v_rec IN
    SELECT e.value, e.ordinality, p.id AS servicio_id
    FROM jsonb_array_elements(p_items) WITH ORDINALITY e
    JOIN public.productos p
      ON p.id = NULLIF(e.value->>'productId', '')::UUID
     AND p.tenant_id = p_tenant_id
     AND COALESCE(p.es_servicio, FALSE)
  LOOP
    IF jsonb_typeof(v_rec.value->'insumos') = 'array' THEN
      IF jsonb_array_length(v_rec.value->'insumos') > 50 THEN
        RAISE EXCEPTION 'Demasiados insumos en un servicio';
      END IF;
      INSERT INTO _venta_insumos (linea, servicio_id, producto_id, variante_id, cantidad)
      SELECT v_rec.ordinality, v_rec.servicio_id,
             (i.value->>'productId')::UUID,
             NULLIF(i.value->>'varianteId', '')::UUID,
             (i.value->>'cantidad')::DECIMAL
      FROM jsonb_array_elements(v_rec.value->'insumos') i;
    ELSE
      INSERT INTO _venta_insumos (linea, servicio_id, producto_id, variante_id, cantidad)
      SELECT v_rec.ordinality, v_rec.servicio_id, r.producto_id, r.variante_id,
             r.cantidad * (v_rec.value->>'cantidad')::DECIMAL
      FROM public.insumos_servicio r
      JOIN public.productos ip ON ip.id = r.producto_id AND ip.archivado_en IS NULL
      LEFT JOIN public.variantes_producto iv ON iv.id = r.variante_id
      WHERE r.servicio_id = v_rec.servicio_id
        AND (r.variante_id IS NULL OR iv.archivado_en IS NULL)
      ORDER BY r.orden, r.creado_en;
    END IF;
  END LOOP;

  IF EXISTS (SELECT 1 FROM _venta_insumos WHERE cantidad < 0 OR cantidad IS NULL) THEN
    RAISE EXCEPTION 'Cantidad invalida en los insumos de un servicio';
  END IF;
  DELETE FROM _venta_insumos WHERE cantidad = 0;

  -- 107: candados en orden fijo. Todos los productos y variantes del
  -- carrito, ordenados por id: dos cajas con los mismos productos ya no
  -- se bloquean en cruz (deadlock); la segunda espera a la primera.
  PERFORM 1 FROM public.productos
  WHERE id IN (
    SELECT DISTINCT (e.value->>'productId')::UUID
    FROM jsonb_array_elements(p_items) e
    UNION
    SELECT producto_id FROM _venta_insumos
  )
    AND tenant_id = p_tenant_id
  ORDER BY id
  FOR UPDATE;

  PERFORM 1 FROM public.variantes_producto
  WHERE id IN (
    SELECT DISTINCT NULLIF(e.value->>'varianteId', '')::UUID
    FROM jsonb_array_elements(p_items) e
    UNION
    SELECT variante_id FROM _venta_insumos WHERE variante_id IS NOT NULL
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
    es_servicio BOOLEAN NOT NULL DEFAULT FALSE,
    linea INT
  );

  FOR v_rec IN SELECT value, ordinality FROM jsonb_array_elements(p_items) WITH ORDINALITY
  LOOP
    v_item := v_rec.value;
    v_linea := v_rec.ordinality;
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

    INSERT INTO _venta_items (producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio, linea)
    VALUES (v_producto.id, v_variante_id, v_cantidad, v_precio, v_line_descuento, v_costo, COALESCE(v_producto.es_servicio, FALSE), v_linea);
  END LOOP;

  -- 117: cada insumo tiene que ser un producto fisico de este negocio, y su
  -- variante, de ese producto.
  FOR v_ins IN SELECT DISTINCT producto_id, variante_id FROM _venta_insumos
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.productos p
      WHERE p.id = v_ins.producto_id AND p.tenant_id = p_tenant_id AND NOT COALESCE(p.es_servicio, FALSE)
    ) THEN
      RAISE EXCEPTION 'Un insumo del servicio no es valido para este negocio';
    END IF;
    IF v_ins.variante_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.variantes_producto v
      WHERE v.id = v_ins.variante_id AND v.producto_id = v_ins.producto_id AND v.tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'La variante de un insumo no pertenece a su producto';
    END IF;
  END LOOP;

  -- 117: cuanto de cada insumo SI hay. El servicio ya se hizo: si falta un
  -- insumo NO se bloquea el cobro (decision de negocio); se descuenta lo que
  -- hay (sin negativos ni lotes caducados) y el resto queda como `faltante`.
  -- Lo que se vende directo en el mismo ticket se aparta primero.
  FOR v_grp IN SELECT producto_id, variante_id FROM _venta_insumos GROUP BY producto_id, variante_id
  LOOP
    SELECT COALESCE(SUM(cantidad), 0) INTO v_directo
    FROM _venta_items
    WHERE NOT es_servicio
      AND producto_id = v_grp.producto_id
      AND variante_id IS NOT DISTINCT FROM v_grp.variante_id;

    v_libre := GREATEST(
      public.stock_disponible(v_sucursal_id, v_grp.producto_id, v_grp.variante_id, 0)
        - public._cantidad_vencida(v_sucursal_id, v_grp.producto_id, v_grp.variante_id)
        - v_directo,
      0
    );

    FOR v_ins IN
      SELECT ord, cantidad FROM _venta_insumos
      WHERE producto_id = v_grp.producto_id AND variante_id IS NOT DISTINCT FROM v_grp.variante_id
      ORDER BY linea, ord
    LOOP
      v_toma := LEAST(v_ins.cantidad, v_libre);
      UPDATE _venta_insumos
      SET descontado = v_toma, faltante = v_ins.cantidad - v_toma
      WHERE ord = v_ins.ord;
      v_libre := v_libre - v_toma;
    END LOOP;

    -- Costo del insumo: el de la variante si tiene, si no el del producto.
    UPDATE _venta_insumos vi
    SET costo = COALESCE(
      (SELECT CASE WHEN v.costo_compra > 0 THEN v.costo_compra ELSE p.costo_compra END
       FROM public.productos p
       LEFT JOIN public.variantes_producto v ON v.id = v_grp.variante_id
       WHERE p.id = v_grp.producto_id),
      0)
    WHERE vi.producto_id = v_grp.producto_id AND vi.variante_id IS NOT DISTINCT FROM v_grp.variante_id;
  END LOOP;

  -- El costo del servicio incluye lo que se uso (aunque faltara en el conteo):
  -- asi la ganancia de Reportes es real.
  UPDATE _venta_items vi
  SET costo_venta = ROUND((
        COALESCE(vi.costo_venta, 0) * vi.cantidad
        + (SELECT SUM(i.cantidad * i.costo) FROM _venta_insumos i WHERE i.linea = vi.linea)
      ) / vi.cantidad, 2)
  WHERE vi.es_servicio
    AND EXISTS (SELECT 1 FROM _venta_insumos i WHERE i.linea = vi.linea);

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

  -- 117: lo que uso cada servicio, con lo que falto.
  INSERT INTO public.detalle_venta_insumos (
    tenant_id, venta_id, servicio_id, producto_id, variante_id, cantidad, faltante, costo_unitario
  )
  SELECT p_tenant_id, v_venta_id, servicio_id, producto_id, variante_id, descontado, faltante, costo
  FROM _venta_insumos
  ORDER BY linea, ord;

  -- 107: el stock se mueve en orden fijo (producto, variante), igual que
  -- los candados de arriba. Los servicios no mueven stock.
  -- 116: agrupado por (producto, variante). Las piezas de lotes caducados no
  -- se venden, y los lotes se consumen FEFO ANTES de mover el stock (asi el
  -- cuadre de lotes no se dispara en una venta).
  -- 117: en el mismo bucle, los insumos de los servicios (lo descontado). Lo
  -- vendido directo se valida AGREGADO: dos renglones del mismo producto ya no
  -- pueden pasar de lo que hay.
  FOR v_line IN
    SELECT producto_id, variante_id, SUM(directo) AS directo, SUM(insumo) AS insumo
    FROM (
      SELECT producto_id, variante_id, cantidad AS directo, 0::DECIMAL AS insumo
      FROM _venta_items
      WHERE NOT es_servicio
      UNION ALL
      SELECT producto_id, variante_id, 0::DECIMAL, descontado
      FROM _venta_insumos
      WHERE descontado > 0
    ) x
    GROUP BY producto_id, variante_id
    ORDER BY producto_id, variante_id NULLS FIRST
  LOOP
    IF v_line.directo > 0 AND NOT p_permitir_stock_negativo THEN
      v_stock := public.stock_disponible(v_sucursal_id, v_line.producto_id, v_line.variante_id, 0);
      v_vencida := public._cantidad_vencida(v_sucursal_id, v_line.producto_id, v_line.variante_id);
      IF v_stock - v_vencida < v_line.directo THEN
        SELECT p.nombre INTO v_nombre FROM public.productos p WHERE p.id = v_line.producto_id;
        IF v_vencida > 0 THEN
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
        RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_nombre, GREATEST(v_stock, 0);
      END IF;
    END IF;

    PERFORM 1 FROM public._consumir_lotes(
      v_sucursal_id, v_line.producto_id, v_line.variante_id, v_line.directo, 'VENTA',
      p_venta_id => v_venta_id
    );
    PERFORM 1 FROM public._consumir_lotes(
      v_sucursal_id, v_line.producto_id, v_line.variante_id, v_line.insumo, 'INSUMO',
      p_venta_id => v_venta_id
    );
    PERFORM public.mover_stock(v_sucursal_id, v_line.producto_id, v_line.variante_id, -(v_line.directo + v_line.insumo));
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

