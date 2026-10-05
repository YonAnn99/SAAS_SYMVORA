-- =============================================================================
-- 107 · Ventas simultáneas sin deadlock: bloquear el stock en ORDEN FIJO
--
-- Plan de rendimiento, fase 3.2 (docs/plan-rendimiento-escalabilidad.md).
--
-- EL PROBLEMA. `_crear_venta_desde_items` bloquea cada producto (y su variante)
-- con `FOR UPDATE` en el orden en que vienen en el carrito. Dos cajas cobrando a
-- la vez los mismos productos en distinto orden:
--   caja A: [Coca, Sabritas]  -> bloquea Coca,     espera Sabritas
--   caja B: [Sabritas, Coca]  -> bloquea Sabritas, espera Coca
-- Postgres detecta el deadlock y CANCELA una de las dos ventas con error. Con
-- muchos cajeros en hora pico es cuestion de tiempo.
--
-- LA SOLUCION (no cambia ningun resultado):
--   1. Antes del bucle, bloquear de una vez todos los productos y variantes del
--      carrito ORDENADOS POR ID. Las dos cajas piden los candados en el mismo
--      orden: la segunda simplemente espera a que termine la primera. Los
--      `FOR UPDATE` del bucle vuelven a pedir filas que ya tiene: no esperan.
--   2. Los movimientos de stock (`mover_stock`) tambien en orden por producto y
--      variante, en un bucle aparte. Los renglones de la venta
--      (`detalle_ventas`) se siguen guardando en el orden del carrito, asi que
--      el ticket y la reimpresion no cambian.
--
-- Como la 075: se parte de la definicion DESPLEGADA (`pg_get_functiondef`) y se
-- comprueba que cada sustitucion prenda; si alguna falla, aborta sin tocar
-- nada. La firma no cambia, asi que los grants se conservan.
-- =============================================================================

DO $migracion$
DECLARE
  v_src TEXT;
  v_nuevo TEXT;
  v_ancla_bloqueo CONSTANT TEXT := E'  DROP TABLE IF EXISTS _venta_items;';
  v_ancla_stock CONSTANT TEXT :=
    E'    IF v_line.es_servicio THEN\n'
    || E'      NULL;\n'
    || E'    ELSE\n'
    || E'      PERFORM public.mover_stock(v_sucursal_id, v_line.producto_id, v_line.variante_id, -v_line.cantidad);\n'
    || E'    END IF;\n'
    || E'  END LOOP;';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_crear_venta_desde_items';

  IF v_src IS NULL THEN
    RAISE EXCEPTION '107: no existe _crear_venta_desde_items';
  END IF;
  IF position('107: candados en orden fijo' IN v_src) > 0 THEN
    RAISE NOTICE '107: ya aplicada, nada que hacer';
    RETURN;
  END IF;
  IF position(v_ancla_bloqueo IN v_src) = 0 THEN
    RAISE EXCEPTION '107: no se encontro el ancla del bloqueo previo';
  END IF;
  IF position(v_ancla_stock IN v_src) = 0 THEN
    RAISE EXCEPTION '107: no se encontro el ancla del descuento de stock';
  END IF;

  v_nuevo := v_src;

  -- 1. Candados en orden fijo, antes del bucle de renglones.
  v_nuevo := replace(v_nuevo, v_ancla_bloqueo,
    E'  -- 107: candados en orden fijo. Todos los productos y variantes del\n'
    || E'  -- carrito, ordenados por id: dos cajas con los mismos productos ya no\n'
    || E'  -- se bloquean en cruz (deadlock); la segunda espera a la primera.\n'
    || E'  PERFORM 1 FROM public.productos\n'
    || E'  WHERE id IN (\n'
    || E'    SELECT DISTINCT (e.value->>''productId'')::UUID\n'
    || E'    FROM jsonb_array_elements(p_items) e\n'
    || E'  )\n'
    || E'    AND tenant_id = p_tenant_id\n'
    || E'  ORDER BY id\n'
    || E'  FOR UPDATE;\n'
    || E'\n'
    || E'  PERFORM 1 FROM public.variantes_producto\n'
    || E'  WHERE id IN (\n'
    || E'    SELECT DISTINCT NULLIF(e.value->>''varianteId'', '''')::UUID\n'
    || E'    FROM jsonb_array_elements(p_items) e\n'
    || E'  )\n'
    || E'    AND tenant_id = p_tenant_id\n'
    || E'  ORDER BY id\n'
    || E'  FOR UPDATE;\n'
    || E'\n'
    || v_ancla_bloqueo);

  -- 2. El descuento de stock sale del bucle de renglones a uno propio, ordenado.
  v_nuevo := replace(v_nuevo, v_ancla_stock,
    E'  END LOOP;\n'
    || E'\n'
    || E'  -- 107: el stock se mueve en orden fijo (producto, variante), igual que\n'
    || E'  -- los candados de arriba. Los servicios no mueven stock.\n'
    || E'  FOR v_line IN\n'
    || E'    SELECT producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio\n'
    || E'    FROM _venta_items\n'
    || E'    WHERE NOT es_servicio\n'
    || E'    ORDER BY producto_id, variante_id NULLS FIRST\n'
    || E'  LOOP\n'
    || E'    PERFORM public.mover_stock(v_sucursal_id, v_line.producto_id, v_line.variante_id, -v_line.cantidad);\n'
    || E'  END LOOP;');

  IF v_nuevo = v_src THEN
    RAISE EXCEPTION '107: las sustituciones no cambiaron nada';
  END IF;

  EXECUTE v_nuevo;
END
$migracion$;
