-- =============================================
-- 075: un SERVICIO se vende sin existencias y sin descontarlas
-- ---------------------------------------------
-- EL PROBLEMA. `productos.es_servicio` existe desde la migracion 001 y el RPC
-- de venta NUNCA lo miraba: validaba stock suficiente y descontaba unidades
-- como si un servicio fuera mercancia. Dos consecuencias, las dos medidas:
--
--   - Con stock 0 la venta REVIENTA:
--     'Stock insuficiente para "Sitio web". Disponible: 0'
--   - Con stock > 0 se descuenta en cada venta, asi que el servicio se "agota"
--     solo y acaba en negativo acumulativo.
--
-- El unico servicio en produccion ("Sitio web") tenia 5 unidades puestas a mano
-- por su dueño para sortear el filtro del Punto de Venta. Tras 5 ventas habria
-- desaparecido para siempre.
--
-- LA EXCEPCION ES SOLO PARA SERVICIOS. Un producto normal sin existencias sigue
-- bloqueando la venta exactamente igual que antes: esto no es un permiso
-- general para vender sin stock. Verificado con sonda (ver el final).
--
-- POR QUE SE REESCRIBE DESDE `pg_get_functiondef` Y NO A MANO. La funcion son
-- ~350 lineas y solo cambian seis puntos. Copiarla entera para tocar seis
-- lineas es la forma mas facil de colar un error de transcripcion que nadie
-- veria hasta la primera venta. Se parte de lo que HAY DESPLEGADO y se
-- comprueba que las seis sustituciones prendan; si alguna falla, aborta sin
-- dejar la funcion a medias.
--
-- La firma NO cambia, asi que no hay que tocar grants (bug #23).
-- =============================================

BEGIN;

DO $migracion$
DECLARE
  v_src TEXT;
  v_nuevo TEXT;
  v_aplicadas INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_crear_venta_desde_items';

  IF v_src IS NULL THEN
    RAISE EXCEPTION 'No existe _crear_venta_desde_items';
  END IF;

  v_nuevo := v_src;

  -- 1. Leer `es_servicio` del producto. Sin esto no hay nada que decidir.
  v_nuevo := replace(v_nuevo,
    'SELECT id, tenant_id, nombre, stock_actual, precio_venta, costo_compra',
    'SELECT id, tenant_id, nombre, stock_actual, precio_venta, costo_compra, es_servicio');

  -- 2-4. Llevarlo hasta el bucle de descuento, que ocurre mucho despues y solo
  --      ve la tabla temporal.
  v_nuevo := replace(v_nuevo,
    E'costo_venta DECIMAL(10,2)\n  );',
    E'costo_venta DECIMAL(10,2),\n    es_servicio BOOLEAN NOT NULL DEFAULT FALSE\n  );');

  v_nuevo := replace(v_nuevo,
    'INSERT INTO _venta_items (producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta)',
    'INSERT INTO _venta_items (producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio)');

  v_nuevo := replace(v_nuevo,
    'VALUES (v_producto.id, v_variante_id, v_cantidad, v_precio, v_line_descuento, v_costo);',
    'VALUES (v_producto.id, v_variante_id, v_cantidad, v_precio, v_line_descuento, v_costo, COALESCE(v_producto.es_servicio, FALSE));');

  -- 5. El bucle lleva una lista EXPLICITA de columnas, no `SELECT *`. Sin esta
  --    sustitucion el error es `record "v_line" has no field "es_servicio"` y
  --    REVIENTAN TODAS las ventas, no solo las de servicios.
  v_nuevo := replace(v_nuevo,
    E'SELECT producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta\n    FROM _venta_items',
    E'SELECT producto_id, variante_id, cantidad, precio_venta, descuento, costo_venta, es_servicio\n    FROM _venta_items');

  -- 6. No exigirle existencias a un servicio...
  v_nuevo := replace(v_nuevo,
    'IF v_stock < v_cantidad THEN',
    'IF NOT COALESCE(v_producto.es_servicio, FALSE) AND v_stock < v_cantidad THEN');

  -- 7. ...ni descontarselas. Se salta el bloque entero, con variante o sin
  --    ella: un servicio no tiene de donde restar.
  v_nuevo := replace(v_nuevo,
    'IF v_line.variante_id IS NOT NULL THEN',
    E'IF v_line.es_servicio THEN\n      NULL;\n    ELSIF v_line.variante_id IS NOT NULL THEN');

  SELECT COUNT(*) INTO v_aplicadas FROM (
    SELECT 1 WHERE v_nuevo LIKE '%costo_compra, es_servicio%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%es_servicio BOOLEAN NOT NULL DEFAULT FALSE%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%costo_venta, es_servicio)%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%costo_venta, es_servicio%FROM _venta_items%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%NOT COALESCE(v_producto.es_servicio, FALSE) AND v_stock%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%IF v_line.es_servicio THEN%'
  ) t;

  IF v_aplicadas <> 6 THEN
    RAISE EXCEPTION 'Solo prendieron % de 6 sustituciones: la funcion desplegada no es la esperada', v_aplicadas;
  END IF;

  EXECUTE v_nuevo;
END
$migracion$;

-- Los datos que ya existen. El unico servicio tenia 5/5 puestas a mano para
-- sortear el filtro del Punto de Venta; con el filtro arreglado ese numero ya
-- no hace falta, y dejarlo ahi solo confunde a quien mire la tabla.
UPDATE public.productos
SET stock_actual = 0, stock_minimo = 0, actualizado_en = NOW()
WHERE es_servicio = TRUE
  AND (stock_actual <> 0 OR stock_minimo <> 0);

COMMIT;

-- Verificacion (sonda en transaccion revertida, ya ejecutada):
--   servicio con stock 0      -> VENDIDO, stock sigue en 0
--   producto normal stock 0   -> bloqueado, "Stock insuficiente"
--   producto normal 10 - 4    -> stock 6 (sigue descontando)
--   variante 7 - 2            -> variante 5, producto padre SIN TOCAR
