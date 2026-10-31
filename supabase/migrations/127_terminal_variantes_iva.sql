-- =============================================
-- 127: cobro con terminal Mercado Pago Point = la misma cuenta que el cobro directo
-- =============================================
-- Hasta aqui el monto que se mandaba a la terminal lo calculaba TypeScript
-- (`computeTerminalOrderTotal`) con otras reglas que `_crear_venta_desde_items`:
--   * sin variantes: validaba el stock del producto general (siempre 0) y
--     cobraba su precio (0) -> "Stock insuficiente" con cualquier variante;
--   * sin sucursal: miraba `productos.stock_actual`, no el del local;
--   * IVA SIEMPRE: el carrito trae "Incluir IVA" apagado por defecto, asi que la
--     terminal cobraba 16 % mas de lo que decia la pantalla.
--
-- Aditiva:
-- 1. `pagos_terminal.include_iva` (DEFAULT true = lo de antes, para pestañas con
--    el codigo viejo y filas existentes).
-- 2. `cotizar_venta_terminal`: ensaya la venta con `_crear_venta_desde_items`
--    dentro de un sub-bloque que se revierte, y devuelve sus importes. El monto
--    de la terminal sale de LA MISMA funcion que despues registra la venta:
--    variantes, listas, stock por sucursal, lotes caducados, insumos, tope de
--    descuento e IVA. Solo service_role (la llama /api/mercadopago/create-order).
-- 3. `confirm_terminal_payment`: usa el IVA guardado y permite stock negativo:
--    cuando llega aqui el cliente YA PAGO; si otra caja vendio la ultima pieza
--    en esos segundos, la venta se registra con `requiere_revision` en vez de
--    dejar el cobro sin venta.

ALTER TABLE public.pagos_terminal
  ADD COLUMN IF NOT EXISTS include_iva BOOLEAN NOT NULL DEFAULT TRUE;

CREATE OR REPLACE FUNCTION public.cotizar_venta_terminal(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID,
  p_items JSONB,
  p_include_iva BOOLEAN,
  p_lista_precio_id UUID DEFAULT NULL,
  p_tope_descuento_pct NUMERIC DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_venta JSONB;
  v_importes JSONB;
BEGIN
  -- El sub-bloque con EXCEPTION es un savepoint: todo lo que hace
  -- `_crear_venta_desde_items` (venta, detalle, stock, lotes, caja, avisos) se
  -- deshace al lanzar SY127. Los demas errores (stock insuficiente, variante
  -- invalida, tope de descuento...) salen tal cual, con el mismo mensaje que
  -- en el cobro directo.
  BEGIN
    v_venta := public._crear_venta_desde_items(
      p_tenant_id          => p_tenant_id,
      p_usuario_id         => p_usuario_id,
      p_cliente_id         => p_cliente_id,
      p_metodo_pago        => 'TARJETA_TERMINAL',
      p_items              => p_items,
      p_include_iva        => p_include_iva,
      p_lista_precio_id    => p_lista_precio_id,
      p_tope_descuento_pct => p_tope_descuento_pct
    );
    v_importes := jsonb_build_object(
      'subtotal', (v_venta->>'subtotal')::NUMERIC,
      'descuento', COALESCE((v_venta->>'descuento')::NUMERIC, 0),
      'impuesto', COALESCE((v_venta->>'impuesto')::NUMERIC, 0),
      'total', (v_venta->>'total')::NUMERIC
    );
    RAISE EXCEPTION USING ERRCODE = 'SY127', MESSAGE = 'cotizacion';
  EXCEPTION WHEN SQLSTATE 'SY127' THEN
    NULL;
  END;

  RETURN v_importes;
END;
$$;

REVOKE ALL ON FUNCTION public.cotizar_venta_terminal(UUID, UUID, UUID, JSONB, BOOLEAN, UUID, NUMERIC)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cotizar_venta_terminal(UUID, UUID, UUID, JSONB, BOOLEAN, UUID, NUMERIC)
  TO service_role;

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

  -- ARGUMENTOS CON NOMBRE (posicionalmente la nota caia en p_include_iva).
  -- p_include_iva: el mismo con que se cotizo el monto (127; las filas viejas
  -- traen TRUE, que es como se cobraban).
  -- p_permitir_stock_negativo: el cliente ya pago. Si falta stock, la venta se
  -- registra con `requiere_revision` en lugar de dejar el cobro sin venta.
  v_venta := public._crear_venta_desde_items(
    p_tenant_id               => v_pago.tenant_id,
    p_usuario_id              => v_pago.usuario_id,
    p_cliente_id              => v_pago.cliente_id,
    p_metodo_pago             => 'TARJETA_TERMINAL',
    p_items                   => v_pago.payload_items,
    p_include_iva             => COALESCE(v_pago.include_iva, TRUE),
    p_notas                   => 'Pago con terminal Mercado Pago Point (orden ' || v_pago.external_reference || ')',
    p_permitir_stock_negativo => TRUE,
    p_lista_precio_id         => v_pago.lista_precio_id
  );

  UPDATE public.pagos_terminal
  SET estado = 'PAGADA',
      venta_id = (v_venta->>'id')::UUID,
      actualizado_en = NOW()
  WHERE id = v_pago.id;

  RETURN v_venta;
END;
$function$;
