-- =============================================
-- 137: Cancelar y corregir ventas ya cobradas
-- =============================================
-- Pedido de una clienta: modificar o eliminar tickets pasados. Decisiones:
--   * «Eliminar» = CANCELAR CON RASTRO. La venta no se borra: queda
--     `CANCELADA` con quién, cuándo y por qué, y se revierte lo que movió.
--   * «Modificar» = CORREGIR: cancelar la original y cobrar la correcta en UNA
--     transacción (`corregir_venta`); las dos quedan ligadas.
--   * Permiso `sales.void` (ya existía: SUPER_ADMIN y ORG_ADMIN, concedible).
--     Gobernaba la RLS de `ventas` pero ninguna pantalla lo usaba.
--
-- El corte de caja (`fetchVentasTotal`), Reportes y Dashboard ya filtran
-- `estado = 'COMPLETADA'`: una venta cancelada sale sola de esos totales.
-- Aquí se revierte lo demás:
--   1. stock (renglones directos e insumos) en la sucursal de la venta;
--   2. lotes: las piezas vuelven a los MISMOS lotes (`DEVOLUCION_VENTA`);
--   3. crédito del cliente (sin dejar el saldo negativo);
--   4. sello o premio de la tarjeta de lealtad;
--   5. caja: si la caja de la venta sigue abierta no hace falta nada (el corte
--      la excluye); si ya cerró y fue en EFECTIVO, sale una `SALIDA` en la caja
--      abierta de quien cancela (el dinero se devuelve hoy). Tarjeta y
--      transferencia se devuelven por su medio, no del cajón.
--
-- Aditiva: columnas NULL, CHECKs ampliados, funciones nuevas y
-- `CREATE OR REPLACE` de `detalle_venta` (solo agrega claves).
-- `complete_sale` y `complete_sale_lealtad` no se tocan.

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS cancelada_en timestamptz,
  ADD COLUMN IF NOT EXISTS cancelada_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion text,
  ADD COLUMN IF NOT EXISTS corrige_venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS corregida_por_venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ventas_cancelada_por ON public.ventas(cancelada_por) WHERE cancelada_por IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_corrige ON public.ventas(corrige_venta_id) WHERE corrige_venta_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_corregida_por ON public.ventas(corregida_por_venta_id) WHERE corregida_por_venta_id IS NOT NULL;

ALTER TABLE public.movimientos_caja
  ADD COLUMN IF NOT EXISTS venta_id uuid REFERENCES public.ventas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_movimientos_caja_venta ON public.movimientos_caja(venta_id) WHERE venta_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- 2. CHECKs ampliados (lista vigente + lo nuevo)
-- ---------------------------------------------------------------------------
ALTER TABLE public.movimientos_lote DROP CONSTRAINT IF EXISTS movimientos_lote_tipo_check;
ALTER TABLE public.movimientos_lote ADD CONSTRAINT movimientos_lote_tipo_check CHECK (tipo IN (
  'ENTRADA', 'ASIGNACION', 'COMPRA', 'CANCELACION_COMPRA', 'VENTA', 'INSUMO',
  'TRASPASO_SALIDA', 'TRASPASO_ENTRADA', 'AJUSTE', 'CUADRE', 'DEVOLUCION_VENTA'
));

ALTER TABLE public.movimientos_caja DROP CONSTRAINT IF EXISTS movimientos_caja_concepto_check;
ALTER TABLE public.movimientos_caja ADD CONSTRAINT movimientos_caja_concepto_check CHECK (
  concepto IS NULL OR concepto IN (
    'DEPOSITO_BANCO', 'RETIRO_EFECTIVO', 'OTRO_GASTO', 'COMPRA', 'DEVOLUCION_COMPRA', 'CANCELACION_VENTA'
  )
);

ALTER TABLE public.notificaciones DROP CONSTRAINT IF EXISTS notificaciones_tipo_check;
ALTER TABLE public.notificaciones ADD CONSTRAINT notificaciones_tipo_check CHECK (tipo IN (
  'stock_bajo', 'stock_agotado', 'caja_cerrada', 'producto',
  'compra', 'orden_compra', 'ajuste', 'traspaso',
  'lote_por_caducar', 'lote_caducado', 'lote', 'insumo_faltante',
  'lealtad_alta', 'novedad', 'venta_cancelada'
));

-- ---------------------------------------------------------------------------
-- 3. _cancelar_venta: lo que comparten cancelar y corregir. Interna.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._cancelar_venta(p_venta_id uuid, p_motivo text, p_actor uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_venta public.ventas%ROWTYPE;
  v_motivo text := NULLIF(TRIM(p_motivo), '');
  v_sucursal uuid;
  v_line record;
  v_lote record;
  v_mov record;
  v_renglones int := 0;
  v_lotes int := 0;
  v_saldo numeric;
  v_rebaja numeric := 0;
  v_excedente numeric := 0;
  v_lealtad boolean := false;
  v_caja_venta uuid;
  v_caja_actor uuid;
  v_devuelto numeric := 0;
  v_sin_caja boolean := false;
  v_fuera_de_caja boolean := false;
  v_terminal boolean;
BEGIN
  IF v_motivo IS NULL THEN
    RAISE EXCEPTION 'Escribe el motivo de la cancelación';
  END IF;
  IF length(v_motivo) > 300 THEN
    RAISE EXCEPTION 'El motivo es demasiado largo (máximo 300 caracteres)';
  END IF;

  SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF v_venta.estado = 'CANCELADA' THEN
    RAISE EXCEPTION 'Esta venta ya está cancelada';
  END IF;
  IF v_venta.estado <> 'COMPLETADA' THEN
    RAISE EXCEPTION 'Solo se pueden cancelar ventas completadas';
  END IF;
  IF v_venta.factura_id IS NOT NULL THEN
    RAISE EXCEPTION 'Esta venta tiene factura: primero cancela la factura';
  END IF;

  -- Las ventas anteriores a sucursales (082) no la guardaron: el local por defecto.
  v_sucursal := COALESCE(v_venta.sucursal_id, public._sucursal_para_usuario(v_venta.tenant_id, NULL));

  -- Candados en el MISMO orden que una venta (107): productos y variantes por id.
  PERFORM 1 FROM public.productos p
  WHERE p.id IN (
    SELECT d.producto_id FROM public.detalle_ventas d WHERE d.venta_id = p_venta_id
    UNION SELECT i.producto_id FROM public.detalle_venta_insumos i WHERE i.venta_id = p_venta_id
  )
  ORDER BY p.id FOR UPDATE;
  PERFORM 1 FROM public.variantes_producto v
  WHERE v.id IN (
    SELECT d.variante_id FROM public.detalle_ventas d WHERE d.venta_id = p_venta_id AND d.variante_id IS NOT NULL
    UNION SELECT i.variante_id FROM public.detalle_venta_insumos i WHERE i.venta_id = p_venta_id AND i.variante_id IS NOT NULL
  )
  ORDER BY v.id FOR UPDATE;

  -- 1. Stock: lo vendido directo (los servicios no mueven stock) y los insumos
  --    que de verdad se descontaron (`detalle_venta_insumos.cantidad`).
  FOR v_line IN
    SELECT producto_id, variante_id, SUM(cantidad) AS cantidad
    FROM (
      SELECT d.producto_id, d.variante_id, d.cantidad
      FROM public.detalle_ventas d
      JOIN public.productos p ON p.id = d.producto_id
      WHERE d.venta_id = p_venta_id AND NOT COALESCE(p.es_servicio, false)
      UNION ALL
      SELECT i.producto_id, i.variante_id, i.cantidad
      FROM public.detalle_venta_insumos i
      WHERE i.venta_id = p_venta_id AND i.cantidad > 0
    ) x
    GROUP BY producto_id, variante_id
    HAVING SUM(cantidad) > 0
    ORDER BY producto_id, variante_id NULLS FIRST
  LOOP
    PERFORM public.mover_stock(v_sucursal, v_line.producto_id, v_line.variante_id, v_line.cantidad);
    v_renglones := v_renglones + 1;
  END LOOP;

  -- 2. Lotes: DESPUÉS del stock (subir los lotes antes dejaría más lotes que
  --    stock un instante). Vuelven a los mismos lotes y sucursal.
  FOR v_lote IN
    SELECT m.lote_id, m.sucursal_id, -SUM(m.cantidad) AS cantidad
    FROM public.movimientos_lote m
    WHERE m.venta_id = p_venta_id AND m.tipo IN ('VENTA', 'INSUMO')
    GROUP BY m.lote_id, m.sucursal_id
    HAVING SUM(m.cantidad) < 0
    ORDER BY m.lote_id
  LOOP
    PERFORM public._sumar_existencia_lote(
      v_lote.lote_id, v_lote.sucursal_id, v_lote.cantidad, 'DEVOLUCION_VENTA', p_venta_id => p_venta_id
    );
    v_lotes := v_lotes + 1;
  END LOOP;

  -- 3. Crédito: se rebaja lo que aún debe, nunca por debajo de 0. Si ya abonó
  --    más de lo que queda, el excedente se informa para devolverlo a mano.
  IF v_venta.metodo_pago = 'CREDITO' AND v_venta.cliente_id IS NOT NULL THEN
    SELECT saldo_pendiente INTO v_saldo FROM public.clientes WHERE id = v_venta.cliente_id FOR UPDATE;
    v_rebaja := LEAST(v_venta.total, GREATEST(COALESCE(v_saldo, 0), 0));
    v_excedente := v_venta.total - v_rebaja;
    IF v_rebaja > 0 THEN
      UPDATE public.clientes SET saldo_pendiente = saldo_pendiente - v_rebaja WHERE id = v_venta.cliente_id;
    END IF;
  END IF;

  -- 4. Lealtad: un ajuste que deshace el sello o el canje de ESTA venta.
  FOR v_mov IN
    SELECT * FROM public.movimientos_lealtad
    WHERE venta_id = p_venta_id AND tipo IN ('sello', 'canje')
  LOOP
    INSERT INTO public.movimientos_lealtad (tenant_id, tarjeta_id, tipo, cantidad, venta_id, usuario_id, nota)
    VALUES (v_mov.tenant_id, v_mov.tarjeta_id, 'ajuste', -v_mov.cantidad, p_venta_id, p_actor, 'Venta cancelada')
    ON CONFLICT (venta_id, tipo) WHERE venta_id IS NOT NULL DO NOTHING;
    IF FOUND THEN
      IF v_mov.tipo = 'sello' THEN
        UPDATE public.tarjetas_lealtad SET sellos = GREATEST(sellos - v_mov.cantidad, 0) WHERE id = v_mov.tarjeta_id;
      ELSE
        UPDATE public.tarjetas_lealtad
        SET sellos = sellos - v_mov.cantidad,
            premios_canjeados = GREATEST(premios_canjeados - 1, 0)
        WHERE id = v_mov.tarjeta_id;
      END IF;
      v_lealtad := true;
    END IF;
  END LOOP;

  -- 5. Caja. La venta no guarda su caja: es la que su cajero tenía abierta en
  --    esa sucursal cuando cobró (igual que `fetchVentasTotal`).
  IF v_venta.metodo_pago <> 'CREDITO' THEN
    SELECT c.id INTO v_caja_venta
    FROM public.cajas c
    WHERE c.tenant_id = v_venta.tenant_id
      AND c.usuario_id = v_venta.usuario_id
      AND c.estado = 'ABIERTA'
      AND c.fecha_apertura <= v_venta.fecha_venta
      AND (v_venta.sucursal_id IS NULL OR c.sucursal_id IS NULL OR c.sucursal_id = v_venta.sucursal_id)
    ORDER BY c.fecha_apertura DESC
    LIMIT 1;

    IF v_caja_venta IS NULL THEN
      IF v_venta.metodo_pago = 'EFECTIVO' THEN
        SELECT c.id INTO v_caja_actor
        FROM public.cajas c
        WHERE c.tenant_id = v_venta.tenant_id
          AND c.usuario_id = p_actor
          AND c.estado = 'ABIERTA'
        ORDER BY (c.sucursal_id IS NOT DISTINCT FROM v_venta.sucursal_id) DESC, c.fecha_apertura DESC
        LIMIT 1
        FOR UPDATE;

        IF v_caja_actor IS NOT NULL THEN
          INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion, concepto, venta_id)
          VALUES (
            v_caja_actor, 'SALIDA', v_venta.total,
            'Devolución de la venta #' || LEFT(p_venta_id::text, 8) || ' (cancelada)',
            'CANCELACION_VENTA', p_venta_id
          );
          v_devuelto := v_venta.total;
        ELSE
          v_sin_caja := true;
        END IF;
      ELSE
        v_fuera_de_caja := true;
      END IF;
    END IF;
  END IF;

  v_terminal := v_venta.metodo_pago = 'TARJETA_TERMINAL'
    OR EXISTS (SELECT 1 FROM public.pagos_terminal pt WHERE pt.venta_id = p_venta_id);

  UPDATE public.ventas
  SET estado = 'CANCELADA',
      cancelada_en = NOW(),
      cancelada_por = p_actor,
      motivo_cancelacion = v_motivo
  WHERE id = p_venta_id;

  RETURN jsonb_build_object(
    'venta_id', p_venta_id,
    'total', v_venta.total,
    'metodo_pago', v_venta.metodo_pago,
    'renglones_devueltos', v_renglones,
    'lotes_devueltos', v_lotes,
    'caja_abierta', v_caja_venta IS NOT NULL,
    'devuelto_a_caja', v_devuelto,
    'sin_caja_para_devolucion', v_sin_caja,
    'devolucion_fuera_de_caja', v_fuera_de_caja,
    'reembolso_en_terminal', v_terminal,
    'credito_rebajado', v_rebaja,
    'credito_excedente', v_excedente,
    'lealtad_revertida', v_lealtad
  );
END;
$function$;

REVOKE ALL ON FUNCTION public._cancelar_venta(uuid, text, uuid) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4. cancelar_venta: la puerta pública
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._puede_cancelar_venta(p_venta_id uuid)
RETURNS public.ventas
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_venta public.ventas%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT * INTO v_venta FROM public.ventas WHERE id = p_venta_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_venta.tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;
  -- Permiso EFECTIVO (con las excepciones por usuario), como la RLS de ventas.
  IF NOT public.authorize('sales.void') THEN
    RAISE EXCEPTION 'No tienes permiso para cancelar ventas';
  END IF;
  IF v_venta.sucursal_id IS NOT NULL
     AND v_venta.sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'Esa venta es de una sucursal que no tienes asignada';
  END IF;
  RETURN v_venta;
END;
$function$;

REVOKE ALL ON FUNCTION public._puede_cancelar_venta(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cancelar_venta(p_venta_id uuid, p_motivo text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public._puede_cancelar_venta(p_venta_id);
  RETURN public._cancelar_venta(p_venta_id, p_motivo, auth.uid());
END;
$function$;

REVOKE ALL ON FUNCTION public.cancelar_venta(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancelar_venta(uuid, text) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. corregir_venta: cancela la original y cobra la correcta, todo o nada
-- ---------------------------------------------------------------------------
-- Mismos argumentos de cobro que `complete_sale` (sin `p_origen`: siempre en
-- línea). La venta nueva sale con fecha de AHORA y en la caja de quien corrige.
CREATE OR REPLACE FUNCTION public.corregir_venta(
  p_venta_id uuid,
  p_motivo text,
  p_tenant_id uuid,
  p_usuario_id uuid,
  p_cliente_id uuid DEFAULT NULL,
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_items jsonb DEFAULT NULL,
  p_include_iva boolean DEFAULT true,
  p_notas text DEFAULT NULL,
  p_monto_recibido numeric DEFAULT NULL,
  p_idempotency_key uuid DEFAULT NULL,
  p_caja_id uuid DEFAULT NULL,
  p_total_cobrado numeric DEFAULT NULL,
  p_lista_precio_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_original public.ventas%ROWTYPE;
  v_existente public.ventas%ROWTYPE;
  v_cancelacion jsonb;
  v_nueva jsonb;
  v_nueva_id uuid;
BEGIN
  IF v_uid IS NULL OR v_uid <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Reintento de la misma corrección (la red se cortó tras confirmar): se
  -- devuelve la venta nueva en vez de fallar por «ya está cancelada».
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_existente FROM public.ventas WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      IF v_existente.corrige_venta_id = p_venta_id THEN
        RETURN to_jsonb(v_existente);
      END IF;
      RAISE EXCEPTION 'Clave de cobro repetida';
    END IF;
  END IF;

  v_original := public._puede_cancelar_venta(p_venta_id);
  IF v_original.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;
  IF NOT public.authorize('sales.create') THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;
  IF v_original.metodo_pago = 'TARJETA_TERMINAL'
     OR EXISTS (SELECT 1 FROM public.pagos_terminal pt WHERE pt.venta_id = p_venta_id) THEN
    RAISE EXCEPTION 'Una venta cobrada con la terminal no se corrige: cancélala, devuelve el pago en Mercado Pago y cobra de nuevo';
  END IF;

  -- Primero se cancela: así el stock que regresa está disponible para la
  -- venta corregida. Si el cobro nuevo falla, se revierte todo.
  v_cancelacion := public._cancelar_venta(p_venta_id, p_motivo, v_uid);

  v_nueva := public._crear_venta_desde_items(
    p_tenant_id, v_uid, p_cliente_id, p_metodo_pago, p_items,
    p_include_iva, p_notas, p_monto_recibido,
    p_idempotency_key, NULL, p_caja_id, p_total_cobrado,
    false, 'online', p_lista_precio_id,
    CASE WHEN public.authorize('sales.discount_unlimited') THEN NULL ELSE 10 END
  );
  v_nueva_id := (v_nueva ->> 'id')::uuid;

  UPDATE public.ventas SET corrige_venta_id = p_venta_id WHERE id = v_nueva_id;
  UPDATE public.ventas SET corregida_por_venta_id = v_nueva_id WHERE id = p_venta_id;

  RETURN v_nueva || jsonb_build_object(
    'corrige_venta_id', p_venta_id,
    'cancelacion', v_cancelacion
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.corregir_venta(uuid, text, uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid, uuid, numeric, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.corregir_venta(uuid, text, uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid, uuid, numeric, uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 6. Aviso en la campana cuando cancela un colaborador
-- ---------------------------------------------------------------------------
-- `_notif_colaborador` da NULL si quien cancela es el dueño: el dueño no se
-- avisa a sí mismo. Sin agrupar: cada cancelación se ve por separado.
CREATE OR REPLACE FUNCTION public._notif_trg_venta_cancelada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_actor uuid;
BEGIN
  BEGIN
    IF OLD.estado::text = 'CANCELADA' OR NEW.estado::text <> 'CANCELADA' THEN
      RETURN NULL;
    END IF;
    v_actor := public._notif_colaborador(NEW.tenant_id, COALESCE(NEW.cancelada_por, auth.uid()));
    IF v_actor IS NULL THEN
      RETURN NULL;
    END IF;
    PERFORM public._notif_accion(
      NEW.tenant_id, v_actor, 'venta_cancelada', 'cancelar',
      public._notif_nombre(v_actor) || ' canceló la venta #' || LEFT(NEW.id::text, 8),
      NULL,
      'Total ' || public._notif_mxn(NEW.total)
        || COALESCE(' · Motivo: ' || NULLIF(TRIM(NEW.motivo_cancelacion), ''), ''),
      '/reports', 'sales.void', NEW.id
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[notificaciones] aviso de venta cancelada omitido: %', SQLERRM;
  END;
  RETURN NULL;
END;
$function$;

REVOKE ALL ON FUNCTION public._notif_trg_venta_cancelada() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notif_venta_cancelada ON public.ventas;
CREATE TRIGGER trg_notif_venta_cancelada
  AFTER UPDATE OF estado ON public.ventas
  FOR EACH ROW EXECUTE FUNCTION public._notif_trg_venta_cancelada();

-- ---------------------------------------------------------------------------
-- 7. detalle_venta: lo necesario para cancelar, corregir y mostrar el rastro
-- ---------------------------------------------------------------------------
-- Mismo cuerpo y mismas reglas de visibilidad; solo agrega claves.
CREATE OR REPLACE FUNCTION public.detalle_venta(p_venta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_venta RECORD;
  v_resultado jsonb;
BEGIN
  SELECT v.*, u.email::text AS cajero_email,
         public.nombre_de_usuario(u.raw_user_meta_data) AS cajero_nombre,
         c.nombre AS cliente_nombre, c.telefono AS cliente_telefono,
         public.nombre_de_usuario(uc.raw_user_meta_data) AS cancelada_por_nombre,
         uc.email::text AS cancelada_por_email
  INTO v_venta
  FROM public.ventas v
  LEFT JOIN auth.users u ON u.id = v.usuario_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN auth.users uc ON uc.id = v.cancelada_por
  WHERE v.id = p_venta_id;

  IF v_venta.id IS NULL THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_venta.tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  IF NOT public.authorize('sales.view_all') AND v_venta.usuario_id <> v_uid THEN
    RAISE EXCEPTION 'Solo puedes consultar tus propias ventas';
  END IF;

  IF v_venta.sucursal_id IS NOT NULL
     AND v_venta.sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'Esa venta es de una sucursal que no tienes asignada';
  END IF;

  SELECT jsonb_build_object(
    'id', v_venta.id,
    'fecha_venta', v_venta.fecha_venta,
    'usuario_id', v_venta.usuario_id,
    'cajero_email', v_venta.cajero_email,
    'cajero_nombre', v_venta.cajero_nombre,
    'cliente_id', v_venta.cliente_id,
    'cliente_nombre', v_venta.cliente_nombre,
    'cliente_telefono', v_venta.cliente_telefono,
    'metodo_pago', v_venta.metodo_pago,
    'estado', v_venta.estado,
    'subtotal', v_venta.subtotal,
    'impuesto', v_venta.impuesto,
    'descuento', v_venta.descuento,
    'total', v_venta.total,
    'monto_recibido', v_venta.monto_recibido,
    'cambio', v_venta.cambio,
    'notas', v_venta.notas,
    'origen', v_venta.origen,
    'requiere_revision', v_venta.requiere_revision,
    'lista_precio_id', v_venta.lista_precio_id,
    'sucursal_id', v_venta.sucursal_id,
    'facturada', v_venta.factura_id IS NOT NULL,
    'pagada_con_terminal', v_venta.metodo_pago = 'TARJETA_TERMINAL'
      OR EXISTS (SELECT 1 FROM public.pagos_terminal pt WHERE pt.venta_id = v_venta.id),
    'cancelada_en', v_venta.cancelada_en,
    'cancelada_por_nombre', COALESCE(v_venta.cancelada_por_nombre, v_venta.cancelada_por_email),
    'motivo_cancelacion', v_venta.motivo_cancelacion,
    'corrige_venta_id', v_venta.corrige_venta_id,
    'corregida_por_venta_id', v_venta.corregida_por_venta_id,
    'renglones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'producto_id', d.producto_id,
        'variante_id', d.variante_id,
        'nombre', COALESCE(p.nombre, 'Producto eliminado'),
        'unidad_medida', COALESCE(va.unidad_medida::text, p.unidad_medida::text, 'PIEZA'),
        'talla', va.talla,
        'color', va.color,
        'cantidad', d.cantidad,
        'precio_unitario', d.precio_unitario,
        'descuento', d.descuento,
        'subtotal', d.subtotal
      ) ORDER BY p.nombre NULLS LAST)
      FROM public.detalle_ventas d
      LEFT JOIN public.productos p ON p.id = d.producto_id
      LEFT JOIN public.variantes_producto va ON va.id = d.variante_id
      WHERE d.venta_id = v_venta.id
    ), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$function$;
