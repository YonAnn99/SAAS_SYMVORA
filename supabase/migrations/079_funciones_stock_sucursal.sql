-- =============================================
-- 079: las cinco funciones de stock pasan a mover `stock_sucursal`
-- ---------------------------------------------
-- LA 078 creo el almacen por sucursal pero NADIE lo usaba todavia. Esta lo
-- enchufa: a partir de aqui vender, ajustar, comprar, recibir y cancelar mueven
-- unidades en un LOCAL, y `productos.stock_actual` queda como la suma que
-- mantiene el trigger.
--
-- ⚠️ ES OBLIGATORIO CONVERTIRLAS LAS CINCO, NO VALE IR UNA A UNA EN PRODUCCION.
-- Una funcion que siga escribiendo `stock_actual` a pelo no dispara el trigger
-- —esta en `stock_sucursal`, no en `productos`— asi que su cambio quedaria
-- fuera del reparto, y el siguiente movimiento de cualquier otra funcion
-- recalcularia la suma y LO BORRARIA. O todas, o ninguna.
--
-- QUE SUCURSAL USA CADA UNA, HOY:
--
--   - La VENTA usa la suya de verdad: la hereda de la caja (migracion 076), asi
--     que vender en Norte descuenta Norte. Es el unico camino que ya tenia la
--     informacion, y el unico que de verdad la necesita ya.
--   - Las otras cuatro pasan `NULL`, que `mover_stock` resuelve al local mas
--     antiguo del negocio (`Principal`). Para un negocio de un solo local eso es
--     EXACTAMENTE el comportamiento de siempre. Compras y ajustes reciben su
--     sucursal de verdad en la fase 2, cuando `compras` y `ordenes_compra`
--     tengan columna propia; hacerlo aqui obligaria a cambiar firmas y rehacer
--     grants (bug #23) en la misma migracion que toca el corazon del inventario.
--
-- Se reescriben desde `pg_get_functiondef` con sustituciones verificadas y
-- literales con `$q$` (saltos de linea reales, sin escapar comillas). Si alguna
-- no prende, aborta sin dejar nada a medias. Tecnica de las migraciones 075/076.
-- =============================================

BEGIN;

-- =============================================
-- 0. Re-sincronizar antes de enchufar nada
-- ---------------------------------------------
-- Entre la 078 y esta pudo venderse o ajustarse algo por los caminos viejos,
-- que escriben `stock_actual` sin pasar por `stock_sucursal`. Ese desfase se
-- absorbe en `Principal` ANTES de cambiar las funciones; si no, el primer
-- movimiento nuevo recalcularia la suma y se comeria esas unidades.
-- =============================================

UPDATE public.stock_sucursal ss
SET cantidad = ss.cantidad + (
      p.stock_actual - COALESCE((
        SELECT SUM(x.cantidad) FROM public.stock_sucursal x
        WHERE x.producto_id = p.id AND x.variante_id IS NULL), 0))
FROM public.productos p, public.sucursales s
WHERE ss.producto_id = p.id
  AND ss.variante_id IS NULL
  AND ss.sucursal_id = s.id
  AND s.tenant_id = p.tenant_id
  AND s.nombre = 'Principal'
  AND p.stock_actual IS DISTINCT FROM COALESCE((
        SELECT SUM(x.cantidad) FROM public.stock_sucursal x
        WHERE x.producto_id = p.id AND x.variante_id IS NULL), 0);

UPDATE public.stock_sucursal ss
SET cantidad = ss.cantidad + (
      v.stock_actual - COALESCE((
        SELECT SUM(x.cantidad) FROM public.stock_sucursal x
        WHERE x.variante_id = v.id), 0))
FROM public.variantes_producto v, public.productos p, public.sucursales s
WHERE ss.variante_id = v.id
  AND p.id = v.producto_id
  AND ss.sucursal_id = s.id
  AND s.tenant_id = p.tenant_id
  AND s.nombre = 'Principal'
  AND v.stock_actual IS DISTINCT FROM COALESCE((
        SELECT SUM(x.cantidad) FROM public.stock_sucursal x
        WHERE x.variante_id = v.id), 0);

-- =============================================
-- 1. La venta
-- =============================================

DO $migracion$
DECLARE
  v_src TEXT;
  v_nuevo TEXT;
  v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_crear_venta_desde_items';

  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe _crear_venta_desde_items'; END IF;
  IF v_src LIKE '%stock_disponible%' THEN
    RAISE NOTICE 'La venta ya usa el stock por sucursal; no se reescribe.';
    RETURN;
  END IF;

  v_nuevo := v_src;

  -- 1a. La sucursal se resuelve AL PRINCIPIO. La 076 la resolvia justo antes de
  --     insertar la venta, pero la validacion de existencias ocurre ANTES, en el
  --     bucle de renglones: dejandola donde estaba, el bucle comprobaria el
  --     stock con la sucursal todavia en NULL y validaria contra el total del
  --     negocio en vez de contra el local.
  v_nuevo := replace(v_nuevo,
$q$BEGIN
  IF p_idempotency_key IS NOT NULL THEN$q$,
$q$BEGIN
  -- Antes del bucle de renglones a proposito: ahi se valida el stock y hace
  -- falta saber CONTRA QUE LOCAL se valida.
  SELECT c.sucursal_id INTO v_sucursal_id
  FROM public.cajas c
  WHERE c.id = p_caja_id;

  IF p_idempotency_key IS NOT NULL THEN$q$);

  -- 1b. Y se quita de donde estaba.
  v_nuevo := replace(v_nuevo,
$q$  SELECT c.sucursal_id INTO v_sucursal_id
  FROM public.cajas c
  WHERE c.id = p_caja_id;

  INSERT INTO public.ventas ($q$,
$q$  INSERT INTO public.ventas ($q$);

  -- 1c-d. Las existencias que se validan son las del local. El cuarto argumento
  --       es el valor de siempre: se usa cuando no hay caja abierta y por tanto
  --       no hay sucursal, para no bloquear una venta por eso.
  v_nuevo := replace(v_nuevo,
$q$      v_stock := v_variante.stock_actual;$q$,
$q$      v_stock := public.stock_disponible(v_sucursal_id, v_producto.id, v_variante_id, v_variante.stock_actual);$q$);

  v_nuevo := replace(v_nuevo,
$q$      v_stock := v_producto.stock_actual;$q$,
$q$      v_stock := public.stock_disponible(v_sucursal_id, v_producto.id, NULL, v_producto.stock_actual);$q$);

  -- 1e. Y se descuenta del local. `mover_stock` sirve para los dos casos
  --     (producto suelto y variante), asi que el ELSIF sobra.
  v_nuevo := replace(v_nuevo,
$q$    IF v_line.es_servicio THEN
      NULL;
    ELSIF v_line.variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual - v_line.cantidad,
          actualizado_en = NOW()
      WHERE id = v_line.variante_id;
    ELSE
      UPDATE public.productos
      SET stock_actual = stock_actual - v_line.cantidad,
          actualizado_en = NOW()
      WHERE id = v_line.producto_id;
    END IF;$q$,
$q$    IF v_line.es_servicio THEN
      NULL;
    ELSE
      PERFORM public.mover_stock(v_sucursal_id, v_line.producto_id, v_line.variante_id, -v_line.cantidad);
    END IF;$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%Antes del bucle de renglones a proposito%'
    UNION ALL SELECT 1 WHERE v_nuevo NOT LIKE '%WHERE c.id = p_caja_id;

  INSERT INTO public.ventas (%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%stock_disponible(v_sucursal_id, v_producto.id, v_variante_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%stock_disponible(v_sucursal_id, v_producto.id, NULL%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(v_sucursal_id, v_line.producto_id%'
  ) t;

  IF v_ok <> 5 THEN
    RAISE EXCEPTION 'Venta: solo prendieron % de 5 sustituciones', v_ok;
  END IF;

  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 2. El ajuste de inventario
-- ---------------------------------------------
-- `p_cantidad_ajuste` YA es un delta (`v_stock_nuevo := v_stock_anterior +
-- p_cantidad_ajuste`), asi que va directo a `mover_stock` sin convertir nada.
-- La validacion de que no quede negativo sigue arriba, intacta.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='ajustar_inventario';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe ajustar_inventario'; END IF;
  IF v_src LIKE '%mover_stock%' THEN RETURN; END IF;

  v_nuevo := replace(v_src,
$q$  IF p_variante_id IS NOT NULL THEN
    UPDATE public.variantes_producto
    SET stock_actual = v_stock_nuevo, actualizado_en = NOW()
    WHERE id = p_variante_id;
  ELSE
    UPDATE public.productos
    SET stock_actual = v_stock_nuevo, actualizado_en = NOW()
    WHERE id = p_producto_id;
  END IF;$q$,
$q$  PERFORM public.mover_stock(NULL, p_producto_id, p_variante_id, p_cantidad_ajuste);$q$);

  IF v_nuevo NOT LIKE '%mover_stock(NULL, p_producto_id%' THEN
    RAISE EXCEPTION 'Ajuste: la sustitucion no prendio';
  END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 3. La cancelacion de compra
-- ---------------------------------------------
-- Se pierde el `AND tenant_id = ...` de los UPDATE, y no es un descuido: los
-- renglones salen de una compra cuyo negocio ya se valido arriba, y ademas
-- `mover_stock` resuelve el local a partir del tenant DEL PRODUCTO, asi que
-- mandar unidades al negocio de otro es imposible por construccion.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='cancelar_compra';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe cancelar_compra'; END IF;
  IF v_src LIKE '%mover_stock%' THEN RETURN; END IF;

  v_nuevo := replace(v_src,
$q$    IF v_renglon.variante_id IS NOT NULL THEN
      UPDATE public.variantes_producto
      SET stock_actual = stock_actual - v_renglon.cantidad,
          actualizado_en = NOW()
      WHERE id = v_renglon.variante_id
        AND tenant_id = v_compra.tenant_id;
    ELSE
      UPDATE public.productos
      SET stock_actual = stock_actual - v_renglon.cantidad,
          actualizado_en = NOW()
      WHERE id = v_renglon.producto_id
        AND tenant_id = v_compra.tenant_id;
    END IF;$q$,
$q$    PERFORM public.mover_stock(NULL, v_renglon.producto_id, v_renglon.variante_id, -v_renglon.cantidad);$q$);

  IF v_nuevo NOT LIKE '%mover_stock(NULL, v_renglon.producto_id%' THEN
    RAISE EXCEPTION 'Cancelacion: la sustitucion no prendio';
  END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 4. La recepcion de orden de compra
-- ---------------------------------------------
-- Los UPDATE se CONSERVAN, solo pierden `stock_actual`: siguen poniendo
-- `costo_compra` y siguen sirviendo de guarda (`IF NOT FOUND`) para que un id
-- de otro negocio no cuele. Quitarlos enteros habria tirado las dos cosas.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='recibir_orden_compra';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe recibir_orden_compra'; END IF;
  IF v_src LIKE '%mover_stock%' THEN RETURN; END IF;

  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$      UPDATE public.variantes_producto
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.variante_id
        AND tenant_id = v_tenant_id;$q$,
$q$      UPDATE public.variantes_producto
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.variante_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(NULL, v_item_recibido.producto_id, v_item_recibido.variante_id, v_cantidad);$q$);

  v_nuevo := replace(v_nuevo,
$q$      UPDATE public.productos
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.producto_id
        AND tenant_id = v_tenant_id;$q$,
$q$      UPDATE public.productos
      SET costo_compra = v_item_recibido.costo_unitario,
          actualizado_en = NOW()
      WHERE id = v_item_recibido.producto_id
        AND tenant_id = v_tenant_id;

      PERFORM public.mover_stock(NULL, v_item_recibido.producto_id, NULL, v_cantidad);$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%mover_stock(NULL, v_item_recibido.producto_id, v_item_recibido.variante_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(NULL, v_item_recibido.producto_id, NULL%'
    UNION ALL SELECT 1 WHERE v_nuevo NOT LIKE '%stock_actual = stock_actual + v_cantidad%'
  ) t;
  IF v_ok <> 3 THEN
    RAISE EXCEPTION 'Recepcion: solo prendieron % de 3', v_ok;
  END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 5. La compra directa
-- ---------------------------------------------
-- Mismo criterio: el UPDATE sobrevive por su `RETURNING * INTO v_variante` (de
-- ahi sale `v_producto_id`) y por su guarda. Solo deja de tocar el stock.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_compra_directa';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe registrar_compra_directa'; END IF;
  IF v_src LIKE '%mover_stock%' THEN RETURN; END IF;

  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$      UPDATE public.variantes_producto
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_variante_id
        AND tenant_id = p_tenant_id
      RETURNING * INTO v_variante;$q$,
$q$      UPDATE public.variantes_producto
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_variante_id
        AND tenant_id = p_tenant_id
      RETURNING * INTO v_variante;$q$);

  -- El movimiento va DESPUES de `v_producto_id := v_variante.producto_id`, que
  -- es donde por fin se sabe a que producto padre pertenece la variante.
  v_nuevo := replace(v_nuevo,
$q$      v_producto_id := v_variante.producto_id;$q$,
$q$      v_producto_id := v_variante.producto_id;

      PERFORM public.mover_stock(NULL, v_producto_id, v_variante_id, v_cantidad);$q$);

  v_nuevo := replace(v_nuevo,
$q$      UPDATE public.productos
      SET stock_actual = stock_actual + v_cantidad,
          costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_producto_id
        AND tenant_id = p_tenant_id;$q$,
$q$      UPDATE public.productos
      SET costo_compra = v_costo,
          actualizado_en = NOW()
      WHERE id = v_producto_id
        AND tenant_id = p_tenant_id;

      PERFORM public.mover_stock(NULL, v_producto_id, NULL, v_cantidad);$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%mover_stock(NULL, v_producto_id, v_variante_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(NULL, v_producto_id, NULL%'
    UNION ALL SELECT 1 WHERE v_nuevo NOT LIKE '%stock_actual = stock_actual + v_cantidad%'
  ) t;
  IF v_ok <> 3 THEN
    RAISE EXCEPTION 'Compra directa: solo prendieron % de 3', v_ok;
  END IF;
  EXECUTE v_nuevo;
END
$migracion$;

COMMIT;
