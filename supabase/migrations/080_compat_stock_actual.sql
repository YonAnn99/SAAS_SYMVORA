-- =============================================
-- 080: escribir `stock_actual` sigue funcionando (capa de compatibilidad)
-- ---------------------------------------------
-- EL FALLO QUE CIERRA, Y QUE LA 079 ABRIO. Desde que `stock_sucursal` es la
-- verdad, cuatro sitios del navegador se quedaron escribiendo a pelo en
-- `productos.stock_actual`: el alta de producto, el dialogo de variantes, el
-- importador y la edicion en linea de la tabla.
--
-- Esas escrituras NO disparan el trigger de suma —vive en `stock_sucursal`, no
-- en `productos`— asi que el numero quedaba fuera del reparto y **la siguiente
-- venta recalculaba la suma y lo borraba**. Silenciosamente: el comerciante
-- ponia 40 unidades, vendia una, y se encontraba con las de antes.
--
-- POR QUE UN TRIGGER Y NO REESCRIBIR LOS CUATRO SITIOS. Se hara, y ademas hace
-- falta para que el usuario elija A QUE LOCAL van esas unidades. Pero eso es
-- trabajo de interfaz, y mientras tanto el dato no puede estar en riesgo. Esto
-- traduce la escritura vieja a un movimiento en el local por defecto, que para
-- un negocio de una sola sucursal es exactamente lo correcto.
--
-- NO ES PERMANENTE: cuando las cuatro pantallas manden la sucursal
-- explicitamente, este trigger deja de dispararse solo (la suma ya coincidira) y
-- se puede retirar.
-- =============================================

BEGIN;

-- =============================================
-- 1. El trigger de suma avisa de que escribe el
-- ---------------------------------------------
-- Sin esta marca habria recursion infinita: la suma escribe `stock_actual`, el
-- traductor de abajo lo interpretaria como una escritura de la aplicacion, y
-- volveria a mover stock.
--
-- La marca se pone y se QUITA alrededor de cada UPDATE, no solo se pone: con
-- `set_config(..., true)` el valor dura toda la transaccion, asi que dejarla
-- encendida haria que una escritura legitima posterior —en la misma venta, por
-- ejemplo— se ignorara en silencio.
-- =============================================

CREATE OR REPLACE FUNCTION public._sincronizar_stock_total()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_producto UUID;
  v_variante UUID;
BEGIN
  v_producto := COALESCE(NEW.producto_id, OLD.producto_id);
  v_variante := COALESCE(NEW.variante_id, OLD.variante_id);

  PERFORM set_config('app.sync_stock', '1', true);

  UPDATE public.productos p
  SET stock_actual = COALESCE((
        SELECT SUM(ss.cantidad) FROM public.stock_sucursal ss
        WHERE ss.producto_id = p.id AND ss.variante_id IS NULL), 0),
      actualizado_en = NOW()
  WHERE p.id = v_producto;

  IF v_variante IS NOT NULL THEN
    UPDATE public.variantes_producto v
    SET stock_actual = COALESCE((
          SELECT SUM(ss.cantidad) FROM public.stock_sucursal ss
          WHERE ss.variante_id = v.id), 0),
        actualizado_en = NOW()
    WHERE v.id = v_variante;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.variante_id IS DISTINCT FROM NEW.variante_id
     AND OLD.variante_id IS NOT NULL THEN
    UPDATE public.variantes_producto v
    SET stock_actual = COALESCE((
          SELECT SUM(ss.cantidad) FROM public.stock_sucursal ss
          WHERE ss.variante_id = v.id), 0),
        actualizado_en = NOW()
    WHERE v.id = OLD.variante_id;
  END IF;

  PERFORM set_config('app.sync_stock', '0', true);

  RETURN NULL;
END;
$fn$;

-- =============================================
-- 2. El traductor
-- ---------------------------------------------
-- Calcula el desfase entre lo que acaba de escribir la aplicacion y lo que hay
-- repartido, y mueve esa diferencia al local por defecto. El resultado es que
-- la suma vuelve a cuadrar con lo que el usuario pidio.
-- =============================================

CREATE OR REPLACE FUNCTION public._stock_actual_a_sucursal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_suma DECIMAL(10,3);
  v_delta DECIMAL(10,3);
BEGIN
  -- Viene del trigger de suma: no hay nada que traducir.
  IF COALESCE(current_setting('app.sync_stock', true), '0') = '1' THEN
    RETURN NULL;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.stock_actual IS NOT DISTINCT FROM OLD.stock_actual THEN
    RETURN NULL;
  END IF;

  IF TG_TABLE_NAME = 'productos' THEN
    SELECT COALESCE(SUM(ss.cantidad), 0) INTO v_suma
    FROM public.stock_sucursal ss
    WHERE ss.producto_id = NEW.id AND ss.variante_id IS NULL;

    v_delta := NEW.stock_actual - v_suma;
    IF v_delta <> 0 THEN
      PERFORM public.mover_stock(NULL, NEW.id, NULL, v_delta);
    END IF;
  ELSE
    SELECT COALESCE(SUM(ss.cantidad), 0) INTO v_suma
    FROM public.stock_sucursal ss
    WHERE ss.variante_id = NEW.id;

    v_delta := NEW.stock_actual - v_suma;
    IF v_delta <> 0 THEN
      PERFORM public.mover_stock(NULL, NEW.producto_id, NEW.id, v_delta);
    END IF;
  END IF;

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_productos_stock_compat ON public.productos;
CREATE TRIGGER trg_productos_stock_compat
  AFTER INSERT OR UPDATE OF stock_actual ON public.productos
  FOR EACH ROW EXECUTE FUNCTION public._stock_actual_a_sucursal();

DROP TRIGGER IF EXISTS trg_variantes_stock_compat ON public.variantes_producto;
CREATE TRIGGER trg_variantes_stock_compat
  AFTER INSERT OR UPDATE OF stock_actual ON public.variantes_producto
  FOR EACH ROW EXECUTE FUNCTION public._stock_actual_a_sucursal();

COMMIT;
