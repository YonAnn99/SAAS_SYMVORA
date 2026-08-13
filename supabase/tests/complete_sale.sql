-- Smoke test para el RPC public.complete_sale (migraciones 009 y 011).
-- Emula el contexto autenticado via request.jwt.claims, siembra datos desechables,
-- valida 8 escenarios (precio desde la BD, clamp de descuento, RBAC, stock),
-- registra resultados en _smoke_results y auto-limpia los datos sembrados al
-- final (DELETE del tenant, cascade limpia el resto).
-- Ejecutar con "Without RLS" en el SQL Editor.

CREATE TABLE IF NOT EXISTS public._smoke_results (
  check_no int PRIMARY KEY,
  status text NOT NULL,
  detail text
);

DO $$
DECLARE
  v_user uuid;
  v_tenant uuid;
  v_tenant_sin_membresia uuid;
  v_producto uuid;
  v_producto_otro uuid;
  v_cliente uuid;
  v_result jsonb;
  v_stock numeric;
  v_fail int := 0;
BEGIN
  TRUNCATE public._smoke_results;

  SELECT user_id INTO v_user FROM public.tenant_memberships ORDER BY creado_en LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No hay usuarios con membresia para el smoke test';
  END IF;

  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_user)::text, true);

  INSERT INTO public.tenants (nombre_comercial, subdominio, giro_comercial)
  VALUES ('SMOKE COMPLETE_SALE', 'smoke-' || gen_random_uuid(), 'GENERAL')
  RETURNING id INTO v_tenant;

  INSERT INTO public.tenant_memberships (tenant_id, user_id, role)
  VALUES (v_tenant, v_user, 'ORG_ADMIN');

  INSERT INTO public.tenants (nombre_comercial, subdominio, giro_comercial)
  VALUES ('SMOKE SIN MEMBRESIA', 'smoke-nm-' || gen_random_uuid(), 'GENERAL')
  RETURNING id INTO v_tenant_sin_membresia;

  INSERT INTO public.productos (tenant_id, nombre, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo)
  VALUES (v_tenant, 'PRODUCTO SMOKE', 'PIEZA', 100, 50, 5, 1)
  RETURNING id INTO v_producto;

  INSERT INTO public.productos (tenant_id, nombre, unidad_medida, precio_venta, costo_compra, stock_actual, stock_minimo)
  VALUES (v_tenant, 'PRODUCTO SMOKE 2', 'PIEZA', 50, 25, 10, 1)
  RETURNING id INTO v_producto_otro;

  INSERT INTO public.clientes (tenant_id, nombre)
  VALUES (v_tenant, 'CLIENTE SMOKE')
  RETURNING id INTO v_cliente;

  -- 1) Venta exitosa + stock e IVA correctos
  SELECT public.complete_sale(
    v_tenant, v_user, v_cliente,
    'EFECTIVO'::public.metodo_pago,
    jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 2, 'precioUnitario', 100, 'descuento', 0)),
    'smoke ok'
  ) INTO v_result;

  SELECT stock_actual INTO v_stock FROM public.productos WHERE id = v_producto;
  IF v_stock = 3 AND (v_result->>'total')::numeric = 232 THEN
    INSERT INTO public._smoke_results VALUES (1, 'OK', 'venta exitosa, stock 5->3, subtotal=200 total=232');
  ELSE
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (1, 'FALLO', 'stock=' || v_stock || ' total=' || v_result->>'total');
  END IF;

  -- 2) Multi-producto dentro de una sola venta (stock de ambos decrementa)
  BEGIN
    SELECT public.complete_sale(
      v_tenant, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(
        jsonb_build_object('productId', v_producto, 'cantidad', 1, 'precioUnitario', 100, 'descuento', 0),
        jsonb_build_object('productId', v_producto_otro, 'cantidad', 4, 'precioUnitario', 50, 'descuento', 0)
      ),
      'multi'
    ) INTO v_result;
    IF (SELECT stock_actual FROM public.productos WHERE id = v_producto) = 2
       AND (SELECT stock_actual FROM public.productos WHERE id = v_producto_otro) = 6
       AND (v_result->>'total')::numeric = 348 THEN
      INSERT INTO public._smoke_results VALUES (2, 'OK', 'multi-producto, total=348');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (2, 'FALLO', 'stocks/total incorrectos: ' || v_result->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (2, 'FALLO', SQLERRM);
  END;

  -- 3) Sobreventa rechazada
  BEGIN
    SELECT public.complete_sale(
      v_tenant, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 99, 'precioUnitario', 100, 'descuento', 0)),
      'oversell'
    ) INTO v_result;
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (3, 'FALLO', 'no rechazo sobreventa');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Stock insuficiente%' THEN
      INSERT INTO public._smoke_results VALUES (3, 'OK', 'sobreventa rechazada');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (3, 'FALLO', 'error inesperado: ' || SQLERRM);
    END IF;
  END;

  -- 4) p_usuario_id ajeno (impersonacion) rechazada
  BEGIN
    SELECT public.complete_sale(
      v_tenant, gen_random_uuid(), NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'precioUnitario', 100, 'descuento', 0)),
      'impersonation'
    ) INTO v_result;
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (4, 'FALLO', 'no rechazo p_usuario_id ajeno');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'No autorizado' THEN
      INSERT INTO public._smoke_results VALUES (4, 'OK', 'usuario ajeno rechazado');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (4, 'FALLO', 'error inesperado: ' || SQLERRM);
    END IF;
  END;

  -- 5) Tenant sin membresia rechazado
  BEGIN
    SELECT public.complete_sale(
      v_tenant_sin_membresia, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'precioUnitario', 100, 'descuento', 0)),
      'no member'
    ) INTO v_result;
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (5, 'FALLO', 'no rechazo tenant sin membresia');
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM = 'No perteneces a este negocio' THEN
      INSERT INTO public._smoke_results VALUES (5, 'OK', 'tenant sin membresia rechazado');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (5, 'FALLO', 'error inesperado: ' || SQLERRM);
    END IF;
  END;

  -- 6) Integridad de precio: el RPC IGNORA el precioUnitario del cliente
  --    y usa productos.precio_venta (100). Se envia 1 a proposito.
  BEGIN
    SELECT public.complete_sale(
      v_tenant, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'precioUnitario', 1, 'descuento', 0)),
      'price integrity'
    ) INTO v_result;
    IF (SELECT precio_unitario FROM public.detalle_ventas WHERE venta_id = (v_result->>'id')::uuid) = 100
       AND (v_result->>'subtotal')::numeric = 100
       AND (v_result->>'total')::numeric = 116 THEN
      INSERT INTO public._smoke_results VALUES (6, 'OK', 'precio desde BD (100), ignora precioUnitario=1');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (6, 'FALLO', 'uso precio cliente: ' || v_result->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (6, 'FALLO', SQLERRM);
  END;

  -- 7) Clamp de descuento: descuento 99999 > subtotal (100) -> se clampa a 100
  BEGIN
    SELECT public.complete_sale(
      v_tenant, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto, 'cantidad', 1, 'precioUnitario', 100, 'descuento', 99999)),
      'discount clamp'
    ) INTO v_result;
    IF (v_result->>'descuento')::numeric = 100
       AND (v_result->>'total')::numeric = 0 THEN
      INSERT INTO public._smoke_results VALUES (7, 'OK', 'descuento clampeado a 100, total=0');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (7, 'FALLO', 'descuento=' || v_result->>'descuento' || ' total=' || v_result->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (7, 'FALLO', SQLERRM);
  END;

  -- 8) Descuento legitimo preservado: descuento 10 sobre precio 50 -> total 46.4
  BEGIN
    SELECT public.complete_sale(
      v_tenant, v_user, NULL,
      'EFECTIVO'::public.metodo_pago,
      jsonb_build_array(jsonb_build_object('productId', v_producto_otro, 'cantidad', 1, 'precioUnitario', 50, 'descuento', 10)),
      'legit discount'
    ) INTO v_result;
    IF (v_result->>'descuento')::numeric = 10
       AND (v_result->>'total')::numeric = 46.4 THEN
      INSERT INTO public._smoke_results VALUES (8, 'OK', 'descuento legitimo 10, total=46.4');
    ELSE
      v_fail := v_fail + 1;
      INSERT INTO public._smoke_results VALUES (8, 'FALLO', 'descuento=' || v_result->>'descuento' || ' total=' || v_result->>'total');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_fail := v_fail + 1;
    INSERT INTO public._smoke_results VALUES (8, 'FALLO', SQLERRM);
  END;

  DELETE FROM public.ventas WHERE tenant_id IN (v_tenant, v_tenant_sin_membresia);
  DELETE FROM public.productos WHERE id IN (v_producto, v_producto_otro);
  DELETE FROM public.tenant_memberships WHERE tenant_id IN (v_tenant, v_tenant_sin_membresia);
  DELETE FROM public.tenant_settings WHERE tenant_id IN (v_tenant, v_tenant_sin_membresia);
  DELETE FROM public.clientes WHERE id = v_cliente;
  DELETE FROM public.tenants WHERE id IN (v_tenant, v_tenant_sin_membresia);

  PERFORM set_config('request.jwt.claims', '{}', true);

  IF v_fail > 0 THEN
    RAISE EXCEPTION 'Smoke test complete_sale: % cheque(s) fallaron', v_fail;
  END IF;
END $$;

SELECT * FROM public._smoke_results ORDER BY check_no;

DROP TABLE public._smoke_results;