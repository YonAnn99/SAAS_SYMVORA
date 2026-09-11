-- =============================================
-- 051: Ventas offline + sincronizacion diferida
-- ---------------------------------------------
-- Permite que el POS registre ventas sin conexion y las suba despues.
-- Cuatro problemas que resuelve del lado del servidor:
--
-- 1) DUPLICADOS. Si la red se cae justo despues de que el servidor inserto
--    pero antes de que el cliente reciba la respuesta, el reintento crearia
--    una segunda venta. `idempotency_key` (UUID generado en el cliente) con
--    UNIQUE es la garantia dura: el reintento se resuelve devolviendo la
--    venta ya registrada en vez de duplicarla.
--
-- 2) STOCK. `_crear_venta_desde_items` aborta con 'Stock insuficiente'. Para
--    una venta offline eso no sirve: el cliente YA se llevo la mercancia y
--    pago. Decision de negocio: aceptar la venta, permitir stock negativo y
--    marcarla `requiere_revision`. Rechazarla dejaria dinero cobrado sin
--    registrar y la caja descuadrada.
--
-- 3) CAJA EQUIVOCADA. La funcion busca la caja abierta EN EL MOMENTO DE
--    EJECUTARSE. Una venta sincronizada horas despues se colgaria de la caja
--    equivocada, o de la del dia siguiente. `p_caja_id` fija la caja que
--    estaba abierta cuando se vendio de verdad.
--
-- 4) FECHA. Igual que la caja: los reportes deben reflejar cuando se vendio,
--    no cuando se sincronizo.
--
-- El PRECIO se sigue recalculando desde `productos.precio_venta` — es la
-- proteccion del bug #5 y no se toca. Si el precio cambio mientras el cajero
-- estaba offline, el total recalculado no coincidira con el ticket fisico:
-- por eso se guarda `total_cobrado` aparte y la diferencia marca
-- `requiere_revision` en vez de desaparecer en silencio.
--
-- NOTA SOBRE EL REGISTRO REMOTO: este archivo es la fuente unica, pero se
-- aplico a produccion en tres pasos para poder verificar entre cada uno, asi
-- que en `supabase_migrations` figura como 051a_ventas_offline_columns,
-- 051b_crear_venta_desde_items_offline y 051c_complete_sale_offline. El
-- contenido es equivalente; las versiones aplicadas van sin estos comentarios.
-- No volver a aplicar este archivo completo sobre produccion: ya esta dentro.
-- =============================================

BEGIN;

-- =============================================
-- 1. Columnas nuevas en ventas
-- =============================================

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS idempotency_key UUID,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS requiere_revision BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS total_cobrado DECIMAL(10,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ventas_origen_check'
  ) THEN
    ALTER TABLE public.ventas
      ADD CONSTRAINT ventas_origen_check CHECK (origen IN ('online', 'offline'));
  END IF;
END $$;

-- Ancla anti-duplicados. Parcial: las ventas online historicas tienen NULL y
-- varios NULL no colisionan entre si.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_idempotency_key
  ON public.ventas (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- Para la bandeja de revision.
CREATE INDEX IF NOT EXISTS idx_ventas_requiere_revision
  ON public.ventas (tenant_id, fecha_venta DESC)
  WHERE requiere_revision;

COMMIT;

-- =============================================
-- 2. _crear_venta_desde_items() — params de sincronizacion offline
-- ---------------------------------------------
-- Los DROP son obligatorios: anadir parametros crea una FIRMA NUEVA, no
-- reemplaza la vieja (leccion del bug #18 — un overload huerfano con logica
-- vieja causo que 2 tenants de produccion quedaran sin SUPER_ADMIN). Se
-- elimina la firma de 8 params para que no quede ninguna copia sin actualizar.
-- =============================================

BEGIN;

DROP FUNCTION IF EXISTS public._crear_venta_desde_items(UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL);

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
    descuento DECIMAL(10,2) NOT NULL DEFAULT 0
  );

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    SELECT id, tenant_id, nombre, stock_actual, precio_venta
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

    INSERT INTO _venta_items (producto_id, cantidad, precio_venta, descuento)
    VALUES (
      (v_item->>'productId')::UUID,
      v_cantidad,
      v_precio,
      v_line_descuento
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

  FOR v_line IN SELECT producto_id, cantidad, precio_venta, descuento FROM _venta_items
  LOOP
    v_line_subtotal := ROUND((v_line.precio_venta * v_line.cantidad)::NUMERIC, 2);

    INSERT INTO public.detalle_ventas (
      venta_id, producto_id, cantidad, precio_unitario, subtotal, descuento
    ) VALUES (
      v_venta_id,
      v_line.producto_id,
      v_line.cantidad,
      v_line.precio_venta,
      v_line_subtotal,
      v_line.descuento
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

REVOKE ALL ON FUNCTION public._crear_venta_desde_items(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL,
  UUID, TIMESTAMPTZ, UUID, DECIMAL, BOOLEAN, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._crear_venta_desde_items(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL,
  UUID, TIMESTAMPTZ, UUID, DECIMAL, BOOLEAN, TEXT
) TO service_role;

COMMIT;

-- =============================================
-- 3. complete_sale() — envoltorio publico con RBAC
-- ---------------------------------------------
-- Mismo DROP obligatorio que arriba (bug #18). Ademas, tras DROP + CREATE
-- Postgres concede EXECUTE a PUBLIC por defecto: hay que reaplicar el
-- REVOKE/GRANT explicito o `anon` recupera acceso (leccion del bug #23,
-- migracion 048_security_hardening.sql).
-- =============================================

BEGIN;

DROP FUNCTION IF EXISTS public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL);

CREATE OR REPLACE FUNCTION public.complete_sale(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID DEFAULT NULL,
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_items JSONB DEFAULT NULL,
  p_include_iva BOOLEAN DEFAULT TRUE,
  p_notas TEXT DEFAULT NULL,
  p_monto_recibido DECIMAL(10,2) DEFAULT NULL,
  p_idempotency_key UUID DEFAULT NULL,
  p_fecha_venta TIMESTAMPTZ DEFAULT NULL,
  p_caja_id UUID DEFAULT NULL,
  p_total_cobrado DECIMAL(10,2) DEFAULT NULL,
  p_origen TEXT DEFAULT 'online'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- RBAC desde la DB (no desde JWT): membresia real + permiso sales.create
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

  -- El permiso de stock negativo se deriva de p_origen en vez de ser un flag
  -- suelto, para que la ruta online conserve exactamente el comportamiento
  -- anterior (abortar por falta de stock).
  --
  -- HONESTIDAD SOBRE EL ALCANCE: p_origen lo manda el cliente, asi que esto NO
  -- impide que alguien pida 'offline' a proposito para dejar stock negativo.
  -- No hay forma de demostrar criptograficamente que una venta ocurrio sin
  -- red. El control real no es preventivo sino de auditoria: toda venta con
  -- origen 'offline' queda marcada como tal, y cualquiera que deje stock
  -- negativo se marca `requiere_revision`. El dano posible es de integridad de
  -- inventario (revisable), no de dinero: la venta se registra con su total
  -- recalculado desde el catalogo, igual que cualquier otra.
  RETURN public._crear_venta_desde_items(
    p_tenant_id, v_caller_id, p_cliente_id, p_metodo_pago, p_items,
    p_include_iva, p_notas, p_monto_recibido,
    p_idempotency_key, p_fecha_venta, p_caja_id, p_total_cobrado,
    (p_origen = 'offline'),
    p_origen
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_sale(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL,
  UUID, TIMESTAMPTZ, UUID, DECIMAL, TEXT
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale(
  UUID, UUID, UUID, public.metodo_pago, JSONB, BOOLEAN, TEXT, DECIMAL,
  UUID, TIMESTAMPTZ, UUID, DECIMAL, TEXT
) TO authenticated;

COMMIT;
