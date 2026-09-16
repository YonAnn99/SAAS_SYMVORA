-- =============================================
-- 068: Cobrar con lista de precios (fase 2)
-- ---------------------------------------------
-- La fase 1 (067) dejo crear listas y ponerles precio, pero NO afectaban a
-- ninguna venta: el punto de venta seguia cobrando el precio base. Esta
-- migracion conecta las dos cosas.
--
-- DONDE SE DECIDE EL PRECIO: en `_crear_venta_desde_items`, y solo ahi. El
-- cliente manda el id de la LISTA, nunca el precio (bug #5: precios
-- inventados). El servidor relee el precio de `precios_lista` igual que ya
-- relee `productos.precio_venta`.
--
-- REGLA, identica a la de la pantalla de listas:
--   renglon con precio  -> ese precio
--   renglon sin precio  -> el precio base ("No definido" != gratis)
--   producto fuera      -> el precio base
--
-- SEGURIDAD: se valida que la lista sea del mismo negocio. Sin eso, un
-- cliente manipulado mandaria la lista de otro negocio. Mismo agujero que
-- la validacion de variante de la 056.
--
-- OJO CON LOS PERMISOS: estas funciones cambian de FIRMA, asi que hay que
-- DROP + CREATE. Al recrear, Postgres concede EXECUTE a PUBLIC por defecto;
-- si no se revoca, `complete_sale` quedaria al alcance de `anon`. Los
-- permisos originales eran:
--   _crear_venta_desde_items -> service_role
--   complete_sale            -> authenticated, service_role
--
-- FALLO PREVIO CORREGIDO DE PASO: `confirm_terminal_payment` llamaba al
-- helper pasando la nota en la posicion de `p_include_iva` (booleano). Se
-- comprobo contra la base: falla con 42883, "function does not exist". Es
-- decir, NINGUN pago con terminal Mercado Pago Point llegaba a convertirse
-- en venta. Se pasa a argumentos con nombre, que era la intencion evidente.
-- =============================================

-- 1. Con que lista se cobro cada venta. Sirve para el reporte ("cuanto vendi
--    en LIQUIDACION") y para poder auditar un precio raro meses despues.
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS lista_precio_id UUID
  REFERENCES public.listas_precios(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.ventas.lista_precio_id IS
  'Lista de precios con la que se cobro. NULL = precios base. ON DELETE SET NULL: borrar la lista no puede borrar el historial de ventas.';

CREATE INDEX IF NOT EXISTS idx_ventas_lista_precio
  ON public.ventas (lista_precio_id)
  WHERE lista_precio_id IS NOT NULL;

-- 2. El pago con terminal se crea antes y se confirma despues, asi que la
--    lista tiene que viajar con el, no perderse en el camino.
ALTER TABLE public.pagos_terminal
  ADD COLUMN IF NOT EXISTS lista_precio_id UUID
  REFERENCES public.listas_precios(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.pagos_terminal.lista_precio_id IS
  'Lista con la que se calculo el monto cobrado en la terminal. Se pasa tal cual al crear la venta para que lo cobrado y lo registrado coincidan.';

-- 3. El helper: firma nueva (p_lista_precio_id al final, con DEFAULT, para no
--    romper las llamadas posicionales que ya existen).
DROP FUNCTION IF EXISTS public._crear_venta_desde_items(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, BOOLEAN, TEXT);

CREATE OR REPLACE FUNCTION public._crear_venta_desde_items(p_tenant_id uuid, p_usuario_id uuid, p_cliente_id uuid, p_metodo_pago metodo_pago, p_items jsonb, p_include_iva boolean DEFAULT true, p_notas text DEFAULT NULL::text, p_monto_recibido numeric DEFAULT NULL::numeric, p_idempotency_key uuid DEFAULT NULL::uuid, p_fecha_venta timestamp with time zone DEFAULT NULL::timestamp with time zone, p_caja_id uuid DEFAULT NULL::uuid, p_total_cobrado numeric DEFAULT NULL::numeric, p_permitir_stock_negativo boolean DEFAULT false, p_origen text DEFAULT 'online'::text, p_lista_precio_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
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
BEGIN
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

  DROP TABLE IF EXISTS _venta_items;
  CREATE TEMP TABLE _venta_items (
    producto_id UUID NOT NULL,
    variante_id UUID,
    cantidad DECIMAL(10,3) NOT NULL,
    precio_venta DECIMAL(10,2) NOT NULL,
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_venta DECIMAL(10,2)
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, tenant_id, nombre, stock_actual, precio_venta, costo_compra
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
      v_stock := v_variante.stock_actual;
    ELSE
      -- Venta "general": del stock sin clasificar del producto.
      v_precio := v_producto.precio_venta;
      v_costo := v_producto.costo_compra;
      v_stock := v_producto.stock_actual;
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

    IF v_stock < v_cantidad THEN
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

    INSERT INTO _venta_items (producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta)
    VALUES (v_producto.id, v_variante_id, v_cantidad, v_precio, v_line_descuento, v_costo);
  END LOOP;

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
    idempotency_key, origen, requiere_revision, total_cobrado, lista_precio_id
  ) VALUES (
    p_tenant_id, p_usuario_id, p_cliente_id,
    v_subtotal, v_impuesto, v_descuento, v_total,
    p_metodo_pago, 'COMPLETADA', p_notas,
    p_monto_recibido, v_cambio, v_fecha_venta,
    p_idempotency_key, p_origen, v_requiere_revision, p_total_cobrado, v_lista_id
  )
  RETURNING id INTO v_venta_id;

  FOR v_line IN
    SELECT producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta
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
    IF v_line.variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual - v_line.cantidad,
          actualizado_en = NOW()
      WHERE id = v_line.variante_id;
    ELSE
      UPDATE public.productos
      SET stock_actual = stock_actual - v_line.cantidad,
          actualizado_en = NOW()
      WHERE id = v_line.producto_id;
    END IF;
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
$function$
;

REVOKE ALL ON FUNCTION public._crear_venta_desde_items(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_venta_desde_items(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, BOOLEAN, TEXT, UUID) TO service_role;

-- 4. La puerta publica del POS.
DROP FUNCTION IF EXISTS public.complete_sale(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, TEXT);

CREATE OR REPLACE FUNCTION public.complete_sale(p_tenant_id uuid, p_usuario_id uuid, p_cliente_id uuid DEFAULT NULL::uuid, p_metodo_pago metodo_pago DEFAULT 'EFECTIVO'::metodo_pago, p_items jsonb DEFAULT NULL::jsonb, p_include_iva boolean DEFAULT true, p_notas text DEFAULT NULL::text, p_monto_recibido numeric DEFAULT NULL::numeric, p_idempotency_key uuid DEFAULT NULL::uuid, p_fecha_venta timestamp with time zone DEFAULT NULL::timestamp with time zone, p_caja_id uuid DEFAULT NULL::uuid, p_total_cobrado numeric DEFAULT NULL::numeric, p_origen text DEFAULT 'online'::text, p_lista_precio_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
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
    WHERE role = v_role AND permission = 'sales.create'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;

  RETURN public._crear_venta_desde_items(
    p_tenant_id, v_caller_id, p_cliente_id, p_metodo_pago, p_items,
    p_include_iva, p_notas, p_monto_recibido,
    p_idempotency_key, p_fecha_venta, p_caja_id, p_total_cobrado,
    (p_origen = 'offline'),
    p_origen,
    p_lista_precio_id
  );
END;
$function$
;

REVOKE ALL ON FUNCTION public.complete_sale(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, NUMERIC,
  UUID, TIMESTAMPTZ, UUID, NUMERIC, TEXT, UUID) TO authenticated, service_role;

-- 5. Pago con terminal: la lista viaja con el pago, y se corrige la llamada rota.
CREATE OR REPLACE FUNCTION public.confirm_terminal_payment(p_mp_order_id text, p_pagado boolean, p_estado text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pago RECORD;
  v_venta JSONB;
  v_estado TEXT;
BEGIN
  SELECT * INTO v_pago
  FROM public.pagos_terminal
  WHERE mp_order_id = p_mp_order_id
  FOR UPDATE;

  IF v_pago.id IS NULL THEN
    RAISE EXCEPTION 'Orden de terminal no encontrada';
  END IF;

  IF v_pago.venta_id IS NOT NULL THEN
    SELECT to_jsonb(v.*) INTO v_venta
    FROM public.ventas v
    WHERE v.id = v_pago.venta_id;
    RETURN v_venta;
  END IF;

  IF NOT p_pagado THEN
    v_estado := COALESCE(p_estado, 'RECHAZADA');
    UPDATE public.pagos_terminal
    SET estado = v_estado,
        actualizado_en = NOW()
    WHERE id = v_pago.id;
    RETURN NULL;
  END IF;

  -- ARGUMENTOS CON NOMBRE. Posicionalmente, la nota caia en `p_include_iva`,
  -- que es booleano, y la llamada fallaba con 42883 "function does not
  -- exist": ningun pago con terminal llegaba a convertirse en venta.
  --
  -- p_include_iva va en TRUE porque computeTerminalOrderTotal aplica el 16%
  -- SIEMPRE al calcular el monto que se le cobra al datafono. Si aqui fuera
  -- FALSE, la venta registrada valdria menos que lo que el cliente pago.
  v_venta := public._crear_venta_desde_items(
    p_tenant_id       => v_pago.tenant_id,
    p_usuario_id      => v_pago.usuario_id,
    p_cliente_id      => v_pago.cliente_id,
    p_metodo_pago     => 'TARJETA_TERMINAL',
    p_items           => v_pago.payload_items,
    p_include_iva     => TRUE,
    p_notas           => 'Pago con terminal Mercado Pago Point (orden ' || v_pago.external_reference || ')',
    p_lista_precio_id => v_pago.lista_precio_id
  );

  UPDATE public.pagos_terminal
  SET estado = 'PAGADA',
      venta_id = (v_venta->>'id')::UUID,
      actualizado_en = NOW()
  WHERE id = v_pago.id;

  RETURN v_venta;
END;
$function$
;
