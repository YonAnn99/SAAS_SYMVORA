-- Smoke test para el RPC public.confirm_terminal_payment (migracion 017).
-- Emula el flujo del webhook de Mercado Pago: una orden pagada crea la venta
-- (metodo_pago TARJETA_TERMINAL), un webhook duplicado NO crea una segunda
-- venta (idempotencia), una orden rechazada no toca inventario y una orden
-- desconocida se rechaza. Ejecutar con "Without RLS" en el SQL Editor.

CREATE TABLE IF NOT EXISTS public._smoke_results (
  check_no int PRIMARY KEY,
  status text NOT NULL,
  detail text
);

DO $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_producto uuid;
  v_cliente uuid;
  v_pago_pagado uuid;
  v_pago_rechazado uuid;
  v_venta_1 jsonb;
  v_venta_2 jsonb;
  v_stock numeric;
  v_ventas_count int;
  v_fail int := 0;
BEGIN
  TRUNCATE public._smoke_results;

  SELECT user_id INTO v_user FROM public.tenant_memberships ORDER BY creado_en LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios con membresia para el smoke test';
  END IF;

  INSERT INTO public.tenants (nombre_comercial, subdominio, giro_comercial)
  VALUES ('SMOKE TERMINAL', 'smoke-term-' || gen_random_uuid(), 'GENERAL')
  RETURNING id INTO v_tenant;

  INSERT INTO public.productos (tenant_id, nombre, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo)
  VALUES (v_tenant, 'PRODUCTO TERMINAL', 'PIEZA', 100, 50, 5, 1)
  RETURNING id INTO v_producto;

  INSERT INTO public.clientes (tenant_id, nombre)
  VALUES (v_tenant, 'CLIENTE TERMINAL')
  RETURNING id INTO v_cliente;

  -- Orden pagada (webhook processed)
  INSERT INTO public.pagos_terminal (
    tenant_id, usuario_id, cliente_id, mp_order_id, external_reference, monto, estado, payload_items
  ) VALUES (
    v_tenant, v_user, v_cliente, 'ORD-SMOKE-PAGADA', 'ext-pagada', 232,
    'ESPERANDO_PAGO',
    jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 2, 'descuento', 0))
  ) RETURNING id INTO v_pago_pagado;

  -- Orden rechazada (webhook failed)
  INSERT INTO public.pagos_terminal (
    tenant_id, usuario_id, cliente_id, mp_order_id, external_reference, monto, estado, payload_items
  ) VALUES (
    v_tenant, v_user, v_cliente, 'ORD-SMOKE-RECHAZADA', 'ext-rechazada', 232,
    'ESPERANDO_PAGO',
    jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 2, 'descuento', 0))
  ) RETURNING id INTO v_pago_rechazado;

  -- 1) Pago aprobado: crea la venta, descuenta stock, marca PAGADA
  BEGIN
    SELECT public.confirm_terminal_payment('ORD-SMOKE-PAGADA', true, 'processed')
    INTO v_venta_1;

    SELECT stock_actual INTO v_stock FROM public.productos WHERE id = v_producto;
    IF (v_venta_1->>'metodo_pago')::text = 'TARJETA_TERMINAL'
       AND (v_venta_1->>'total')::numeric = 232
       AND v_stock = 3
       AND (SELECT estado FROM public.pagos_terminal WHERE id = v_pago_pagado) = 'PAGADA'
       AND (SELECT venta_id FROM public.pagos_terminal WHERE id = v_pago_pagado) = (v_venta_1->>'id')::uuid THEN
      INSERT INTO public._smoke_results VALUES (1, 'OK', 'venta creada con TARJETA_TERMINAL, stock 5->3, total=232');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (1, 'FALLO', 'metodo=' || v_venta_1->>'metodo_pago' || ' stock=' || v_stock || ' total=' || v_venta_1->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (1, 'FALLO', SQLERRM);
  END;

  -- 2) Webhook duplicado: NO crea segunda venta, devuelve la misma
  BEGIN
    SELECT public.confirm_terminal_payment('ORD-SMOKE-PAGADA', true, 'processed')
    INTO v_venta_2;

    SELECT count(*) INTO v_ventas_count
    FROM public.ventas WHERE tenant_id = v_tenant;

    IF v_venta_2->>'id' = v_venta_1->>'id' AND v_ventas_count = 1 THEN
      INSERT INTO public._smoke_results VALUES (2, 'OK', 'idempotente: mismo venta_id, 1 venta');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (2, 'FALLO', 'ventas=' || v_ventas_count || ' ids: ' || v_venta_1->>'id' || ' vs ' || v_venta_2->>'id');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (2, 'FALLO', SQLERRM);
  END;

  -- 3) Pago rechazado: marca RECHAZADA, no crea venta ni toca stock
  BEGIN
    SELECT public.confirm_terminal_payment('ORD-SMOKE-RECHAZADA', false, 'failed')
    INTO v_venta_2;

    SELECT stock_actual INTO v_stock FROM public.productos WHERE id = v_producto;
    IF v_venta_2 IS NULL
       AND v_stock = 3
       AND (SELECT estado FROM public.pagos_terminal WHERE id = v_pago_rechazado) = 'failed' THEN
      INSERT INTO public._smoke_results VALUES (3, 'OK', 'rechazada sin venta, stock intacto');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (3, 'FALLO', 'venta=' || COALESCE(v_venta_2->>'id', 'NULL') || ' stock=' || v_stock);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (3, 'FALLO', SQLERRM);
  END;

  -- 4) Orden desconocida: rechazada con error claro
  BEGIN
    SELECT public.confirm_terminal_payment('ORD-NO-EXISTE', true, 'processed')
    INTO v_venta_2;
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (4, 'FALLO', 'no rechazo orden desconocida');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'Orden de terminal no encontrada' THEN
      INSERT INTO public._smoke_results VALUES (4, 'OK', 'orden desconocida rechazada');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (4, 'FALLO', 'error inesperado: ' || SQLERRM);
    END IF;
  END;

  -- Limpieza
  DELETE FROM public.pagos_terminal WHERE id IN (v_pago_pagado, v_pago_rechazado);
  DELETE FROM public.ventas WHERE tenant_id = v_tenant;
  DELETE FROM public.productos WHERE id = v_producto;
  DELETE FROM public.clientes WHERE id = v_cliente;
  DELETE FROM public.tenant_settings WHERE tenant_id = v_tenant;
  DELETE FROM public.tenants WHERE id = v_tenant;

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Smoke test confirm_terminal_payment: % cheque(s) fallaron', v_fail;
  END IF;
END $$;

SELECT * FROM public._smoke_results ORDER BY check_no;

DROP TABLE public._smoke_results;
