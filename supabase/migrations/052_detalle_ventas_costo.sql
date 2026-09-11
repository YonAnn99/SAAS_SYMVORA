-- =============================================
-- 052: Costo congelado en la linea de venta (ganancia real)
-- ---------------------------------------------
-- `detalle_compras` guarda `costo_unitario` desde la migracion 001, pero
-- `detalle_ventas` nunca tuvo su espejo: solo `precio_unitario`. Sin el costo
-- en la linea, la ganancia solo se puede calcular cruzando el costo ACTUAL del
-- producto — y eso significa que cada vez que el dueno actualiza un costo (o
-- sea, con cada compra a precio nuevo) **toda la ganancia historica cambia
-- sola**. Un reporte de un mes cerrado dejaria de ser el mismo al volver a
-- mirarlo, que es justo lo que lo vuelve inutil.
--
-- Congelando el costo al vender, cada venta conserva su realidad economica.
--
-- NULL a proposito: distingue "no se capturo el costo" de "el costo era cero".
-- Esa diferencia es la que permite EXCLUIR esas lineas del calculo en vez de
-- contarlas como 100% de ganancia e inflar el numero sin que nadie sospeche.
-- =============================================

BEGIN;

ALTER TABLE public.detalle_ventas
  ADD COLUMN IF NOT EXISTS costo_unitario DECIMAL(10,2);

COMMENT ON COLUMN public.detalle_ventas.costo_unitario IS
  'Costo del producto congelado al momento de la venta. NULL = no se capturo (se excluye del calculo de ganancia, nunca se trata como 0).';

-- Indice para el desglose de ganancia por producto en Reportes.
CREATE INDEX IF NOT EXISTS idx_detalle_ventas_producto_costo
  ON public.detalle_ventas (producto_id)
  WHERE costo_unitario IS NOT NULL;

COMMIT;

-- =============================================
-- 2. _crear_venta_desde_items() — graba el costo al vender
-- ---------------------------------------------
-- IMPORTANTE: la FIRMA NO CAMBIA, solo el cuerpo. Por eso aqui se usa
-- CREATE OR REPLACE y NO hay DROP. Eso evita las dos trampas que ya
-- mordieron a este repo:
--   - bug #18: un DROP + CREATE con firma distinta deja un overload
--     huerfano con logica vieja que el codigo sigue llamando.
--   - bug #23: tras un DROP, Postgres concede EXECUTE a PUBLIC por
--     defecto y 'anon' recupera acceso.
-- Aun asi conviene verificar ambas cosas despues de aplicar.
--
-- La funcion YA leia productos en su bucle (SELECT ... FOR UPDATE), asi
-- que solo se le anade costo_compra a ese SELECT y se arrastra hasta el
-- INSERT de detalle_ventas. El costo NO viaja desde el cliente: sale de
-- la BD, igual que el precio (proteccion del bug #5).
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public._crear_venta_desde_items(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID,
  p_metodo_pago public.metodo_pago,
  p_items JSONB,
  p_include_iva BOOLEAN DEFAULT TRUE,
  p_notas TEXT DEFAULT NULL,
  p_monto_recibido DECIMAL(10,2) DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL,
  p_fecha_venta TIMESTAMPTZ DEFAULT NULL,
  p_caja_id UUID DEFAULT NULL,
  p_total_cobrado DECIMAL(10,2) DEFAULT NULL,
  p_permitir_stock_negativo BOOLEAN DEFAULT FALSE,
  p_origen TEXT DEFAULT 'online'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item JSONB;
  v_line RECORD;
  v_producto RECORD;
  v_venta_id UUID;
  v_subtotal DECIMAL(10,2) := 0;
  v_descuento DECIMAL(10,2) := 0;
  v_impuesto DECIMAL(10,2) := 0;
  v_total DECIMAL(10,2) := 0;
  v_line_subtotal DECIMAL(10,2) := 0;
  v_line_descuento DECIMAL(10,2) := 0;
  v_precio DECIMAL(10,2);
  v_cantidad DECIMAL(10,3);
  v_caja_id UUID;
  v_venta JSONB;
  v_cambio DECIMAL(10,2);
  v_requiere_revision BOOLEAN := FALSE;
  v_fecha_venta TIMESTAMPTZ;
BEGIN
  -- IDEMPOTENCIA: si esta venta ya se registro, devolverla tal cual en vez de
  -- duplicarla. Es el caso normal cuando el cliente reintenta porque la red se
  -- corto antes de recibir la respuesta. El UNIQUE parcial es el respaldo ante
  -- una carrera: la transaccion entera revierte y el reintento cae aqui.
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

  -- CREDITO requiere cliente (para rastrear saldo_pendiente)
  IF p_metodo_pago = 'CREDITO' AND p_cliente_id IS NULL THEN
    RAISE EXCEPTION 'Selecciona un cliente para la venta a credito';
  END IF;

  -- Validate cliente belongs to tenant (if provided)
  IF p_cliente_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.clientes
      WHERE id = p_cliente_id AND tenant_id = p_tenant_id
    ) THEN
      RAISE EXCEPTION 'Cliente invalido para este negocio';
    END IF;
  END IF;

  DROP TABLE IF EXISTS _venta_items;
  CREATE TEMP TABLE _venta_items (
    producto_id UUID NOT NULL,
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

    -- Stock: online aborta; offline acepta y marca para revision. La venta ya
    -- ocurrio fisicamente y no se puede deshacer (ver cabecera, punto 2).
    IF v_producto.stock_actual < v_cantidad THEN
      IF p_permitir_stock_negativo THEN
        v_requiere_revision := TRUE;
      ELSE
        RAISE EXCEPTION 'Stock insuficiente para "%". Disponible: %', v_producto.nombre, v_producto.stock_actual;
      END IF;
    END IF;

    v_precio := v_producto.precio_venta;

    v_line_descuento := ROUND(COALESCE((v_item->>'descuento')::DECIMAL, 0)::NUMERIC, 2);
    IF v_line_descuento < 0 THEN
      v_line_descuento := 0;
    END IF;
    IF v_line_descuento > ROUND((v_precio * v_cantidad)::NUMERIC, 2) THEN
      v_line_descuento := ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    END IF;

    v_subtotal := v_subtotal + ROUND((v_precio * v_cantidad)::NUMERIC, 2);
    v_descuento := v_descuento + v_line_descuento;

    INSERT INTO _venta_items (producto_id, cantidad, precio_venta, descuento, costo_venta)
    VALUES (
      (v_item->>'productId')::UUID,
      v_cantidad,
      v_precio,
      v_line_descuento,
      v_producto.costo_compra
    );
  END LOOP;

  -- IVA: conditionally apply 16% based on p_include_iva
  v_impuesto := CASE WHEN p_include_iva
    THEN ROUND(((v_subtotal - v_descuento) * 0.16)::NUMERIC, 2)
    ELSE 0 END;
  v_total := ROUND(((v_subtotal - v_descuento + v_impuesto))::NUMERIC, 2);

  -- Precio cambiado durante la ventana offline: el ticket que se le entrego al
  -- cliente no coincide con lo que da el catalogo actual. No se confia en el
  -- monto del cliente para el registro (bug #5), pero la diferencia se marca.
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
    idempotency_key, origen, requiere_revision, total_cobrado
  ) VALUES (
    p_tenant_id, p_usuario_id, p_cliente_id,
    v_subtotal, v_impuesto, v_descuento, v_total,
    p_metodo_pago, 'COMPLETADA', p_notas,
    p_monto_recibido, v_cambio, v_fecha_venta,
    p_idempotency_key, p_origen, v_requiere_revision, p_total_cobrado
  )
  RETURNING id INTO v_venta_id;

  FOR v_line IN SELECT producto_id, cantidad, precio_venta, descuento, costo_venta FROM _venta_items
  LOOP
    v_line_subtotal := ROUND((v_line.precio_venta * v_line.cantidad)::NUMERIC, 2);

    INSERT INTO public.detalle_ventas (
      venta_id, producto_id, cantidad, precio_unitario, subtotal, descuento,
      costo_unitario
    ) VALUES (
      v_venta_id,
      v_line.producto_id,
      v_line.cantidad,
      v_line.precio_venta,
      v_line_subtotal,
      v_line.descuento,
      -- Costo congelado: a partir de aqui esta venta conserva su ganancia real
      -- aunque el costo del producto cambie despues.
      v_line.costo_venta
    );

    UPDATE public.productos
    SET stock_actual = stock_actual - v_line.cantidad,
        actualizado_en = NOW()
    WHERE id = v_line.producto_id;
  END LOOP;

  -- CREDITO: acumular saldo pendiente del cliente
  IF p_metodo_pago = 'CREDITO' THEN
    UPDATE public.clientes
    SET saldo_pendiente = saldo_pendiente + v_total
    WHERE id = p_cliente_id;
  END IF;

  -- Caja: si viene p_caja_id se usa esa (la que estaba abierta al vender),
  -- validando que sea del tenant. Sin ella se cae al comportamiento anterior
  -- de buscar la caja abierta ahora, que solo es correcto para ventas online.
  IF p_caja_id IS NOT NULL THEN
    SELECT id INTO v_caja_id
    FROM public.cajas
    WHERE id = p_caja_id AND tenant_id = p_tenant_id;

    -- Caja inexistente o de otro negocio: la venta no se pierde, pero queda
    -- marcada para que alguien la concilie a mano.
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
$$;
COMMIT;

-- =============================================
-- 3. Backfill del historico
-- ---------------------------------------------
-- Seguro en este momento: TODAS las lineas de venta existentes
-- pertenecen al tenant de la demo y a la cuenta de pruebas del dueno
-- (verificado 2026-09-11) — cero clientes reales. Ademas hace que la
-- demo muestre datos de ganancia, que es lo que se quiere ensenar.
--
-- NO repetir este backfill si en el futuro hay ventas de clientes
-- reales sin costo: dejarlas en NULL para que queden excluidas en vez
-- de atribuirles un costo que no es el que tuvieron.
-- =============================================

UPDATE public.detalle_ventas dv
SET costo_unitario = p.costo_compra
FROM public.productos p
WHERE p.id = dv.producto_id
  AND dv.costo_unitario IS NULL
  AND p.costo_compra > 0;
