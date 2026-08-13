-- Smoke test para los cambios de la migracion 018:
--  1. complete_sale / _crear_venta_desde_items registra el movimiento de
--     caja con tipo 'VENTA' (NO 'ENTRADA') -> corrige el doble conteo en
--     el cierre de caja de la pagina de finanzas.
--  2. Venta a credito sin cliente -> rechazada con error claro.
--  3. Venta a credito con cliente -> acumula saldo_pendiente.
-- Ejecutar con "Without RLS" en el SQL Editor (como postgres).

CREATE TABLE IF NOT EXISTS public._smoke_results_018 (
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
  v_caja uuid;
  v_venta jsonb;
  v_tipo text;
  v_saldo numeric;
  v_fail int := 0;
BEGIN
  TRUNCATE public._smoke_results_018;

  SELECT user_id INTO v_user FROM public.tenant_memberships ORDER BY creado_en LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios con membresia para el smoke test';
  END IF;

  INSERT INTO public.tenants (nombre_comercial, subdominio, giro_comercial)
  VALUES ('SMOKE 018', 'smoke-018-' || gen_random_uuid(), 'GENERAL')
  RETURNING id INTO v_tenant;

  INSERT INTO public.productos (tenant_id, nombre, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo)
  VALUES (v_tenant, 'PROD 018', 'PIEZA', 100, 50, 10, 1)
  RETURNING id INTO v_producto;

  INSERT INTO public.clientes (tenant_id, nombre)
  VALUES (v_tenant, 'CLIENTE CREDITO 018')
  RETURNING id INTO v_cliente;

  INSERT INTO public.cajas (tenant_id, usuario_id, fondo_inicial, estado)
  VALUES (v_tenant, v_user, 500, 'ABIERTA')
  RETURNING id INTO v_caja;

  -- 1) Venta de contado: el movimiento de caja debe ser tipo 'VENTA'
  BEGIN
    SELECT public._crear_venta_desde_items(
      v_tenant, v_user, NULL, 'EFECTIVO',
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'descuento', 0)),
      'smoke 018'
    ) INTO v_venta;

    SELECT tipo INTO v_tipo
    FROM public.movimientos_caja
    WHERE caja_id = v_caja
    ORDER BY fecha DESC LIMIT 1;

    IF v_tipo = 'VENTA' THEN
      INSERT INTO public._smoke_results_018 VALUES (1, 'OK', 'movimiento de caja tipo VENTA (no ENTRADA)');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results_018 VALUES (1, 'FALLO', 'tipo=' || COALESCE(v_tipo, 'NULL'));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results_018 VALUES (1, 'FALLO', SQLERRM);
  END;

  -- 2) Venta a credito sin cliente: debe rechazarse
  BEGIN
    SELECT public._crear_venta_desde_items(
      v_tenant, v_user, NULL, 'CREDITO',
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'descuento', 0)),
      'smoke 018'
    ) INTO v_venta;
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results_018 VALUES (2, 'FALLO', 'no rechazo credito sin cliente');
  EXCEPTION WHEN OTHERS THEN
    IF position('Selecciona un cliente' in SQLERRM) > 0 THEN
      INSERT INTO public._smoke_results_018 VALUES (2, 'OK', 'credito sin cliente rechazado');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results_018 VALUES (2, 'FALLO', 'error inesperado: ' || SQLERRM);
    END IF;
  END;

  -- 3) Venta a credito con cliente: acumula saldo_pendiente
  BEGIN
    SELECT public._crear_venta_desde_items(
      v_tenant, v_user, v_cliente, 'CREDITO',
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'descuento', 0)),
      'smoke 018'
    ) INTO v_venta;

    SELECT saldo_pendiente INTO v_saldo FROM public.clientes WHERE id = v_cliente;

    IF v_saldo = ((v_venta->>'total')::numeric) THEN
      INSERT INTO public._smoke_results_018 VALUES (3, 'OK', 'saldo_pendiente=' || v_saldo || ' = total venta');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results_018 VALUES (3, 'FALLO', 'saldo=' || COALESCE(v_saldo, 0) || ' total=' || v_venta->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results_018 VALUES (3, 'FALLO', SQLERRM);
  END;

  -- Limpieza
  DELETE FROM public.detalle_ventas WHERE venta_id IN (SELECT id FROM public.ventas WHERE tenant_id = v_tenant);
  DELETE FROM public.ventas WHERE tenant_id = v_tenant;
  DELETE FROM public.movimientos_caja WHERE caja_id = v_caja;
  DELETE FROM public.cajas WHERE id = v_caja;
  DELETE FROM public.productos WHERE id = v_producto;
  DELETE FROM public.clientes WHERE id = v_cliente;
  DELETE FROM public.tenant_settings WHERE tenant_id = v_tenant;
  DELETE FROM public.tenants WHERE id = v_tenant;

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Smoke test 018: % cheque(s) fallaron', v_fail;
  END IF;
END $$;

SELECT * FROM public._smoke_results_018 ORDER BY check_no;

DROP TABLE public._smoke_results_018;
