-- =============================================
-- 078: las existencias pasan a vivir en la sucursal (cimientos)
-- ---------------------------------------------
-- QUE RESUELVE: hoy el inventario es UN numero por producto para todo el
-- negocio, asi que vender en Norte descuenta el stock de Centro. A partir de
-- aqui cada local tiene lo suyo.
--
-- ESTA MIGRACION NO CAMBIA NINGUN COMPORTAMIENTO TODAVIA. Solo crea el almacen
-- por sucursal, reparte lo que ya hay y deja las dos funciones auxiliares. Las
-- cinco funciones que mueven stock (ventas, ajustes, compras, recepciones,
-- cancelaciones) se pasan en la 079. Se parte a proposito: el reparto de datos
-- merece verificarse solo, antes de que nada empiece a depender de el.
--
-- EL DISEÑO, Y SU RIESGO, DICHOS CLARO
-- ------------------------------------
-- `stock_sucursal` es la UNICA verdad sobre cuantas unidades hay en un sitio.
-- `productos.stock_actual` y `variantes_producto.stock_actual` se conservan como
-- la SUMA, mantenida por un trigger, porque 130 referencias en 33 ficheros
-- preguntan "cuanto hay en este negocio" y esa pregunta sigue siendo valida
-- (tabla de productos, rejilla del punto de venta, `stock-status`, importador).
--
-- ⚠️ Dos sitios con el mismo dato es la clase de fallo que ya ha mordido a este
-- repo. Se sostiene con tres reglas, y si alguna se rompe el invariante cae:
--
--   1. El trigger es el UNICO que escribe esas dos columnas.
--   2. La aplicacion deja de escribirlas; escribe en `stock_sucursal`.
--   3. `sum(stock_sucursal) = stock_actual` se comprueba con sonda.
--
-- OJO CON UNA SUTILEZA: en un producto con variantes, `productos.stock_actual`
-- NO es la suma de sus variantes — es su stock "sin clasificar", el que se vende
-- cuando no se elige talla ni color (lo llama asi `_crear_venta_desde_items`).
-- Por eso son dos cubos independientes y el trigger los mantiene por separado:
-- las filas con `variante_id IS NULL` suman al producto, las demas a su variante.
-- =============================================

BEGIN;

-- =============================================
-- 1. Todo negocio tiene al menos un local
-- ---------------------------------------------
-- La 076 solo creo `Principal` a los negocios que ya tenian ventas o cajas. Si
-- el stock va a vivir SIEMPRE en una sucursal, todos necesitan una o no habria
-- donde ponerlo. Esto cubre los negocios que aun no han vendido nada.
-- =============================================

INSERT INTO public.sucursales (tenant_id, nombre, direccion)
SELECT t.id, 'Principal', t.direccion
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.sucursales s WHERE s.tenant_id = t.id)
ON CONFLICT (tenant_id, nombre) DO NOTHING;

-- =============================================
-- 2. El almacen por sucursal
-- =============================================

CREATE TABLE IF NOT EXISTS public.stock_sucursal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sucursal_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,

  -- NULL = el stock "sin clasificar" del producto. Con valor = una talla/color.
  variante_id UUID REFERENCES public.variantes_producto(id) ON DELETE CASCADE,

  cantidad DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- El "se vende aqui": deja que un local oculte del punto de venta lo que no
  -- maneja, sin sacarlo del catalogo del negocio. Es lo que cubre la necesidad
  -- real de "productos propios por sucursal" sin partir el catalogo en dos.
  se_vende BOOLEAN NOT NULL DEFAULT TRUE,

  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ⚠️ `NULLS NOT DISTINCT` NO ES DECORATIVO, igual que en `precios_lista`. Por
  -- defecto Postgres considera que dos NULL son distintos, asi que una clave
  -- normal dejaria meter el MISMO producto sin variante dos veces en el mismo
  -- local, con dos cantidades, y ganaria la que la consulta devolviera primero.
  UNIQUE NULLS NOT DISTINCT (sucursal_id, producto_id, variante_id)
);

-- "Cuanto hay de este producto en cada local" es la consulta del modulo y la
-- del reparto; la clave unica sirve para el camino contrario.
CREATE INDEX IF NOT EXISTS idx_stock_sucursal_producto
  ON public.stock_sucursal (producto_id, variante_id);

-- Lectura para todo miembro (el cajero necesita saber si hay existencias),
-- escritura con `inventory.manage`. Misma asimetria que el resto del inventario
-- desde la migracion 053.
ALTER TABLE public.stock_sucursal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stock_sucursal_select" ON public.stock_sucursal
  FOR SELECT TO authenticated
  USING (sucursal_id IN (
    SELECT s.id FROM public.sucursales s
    WHERE s.tenant_id IN (SELECT public.user_tenant_ids())));

CREATE POLICY "stock_sucursal_insert" ON public.stock_sucursal
  FOR INSERT TO authenticated
  WITH CHECK (sucursal_id IN (
    SELECT s.id FROM public.sucursales s
    WHERE s.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

CREATE POLICY "stock_sucursal_update" ON public.stock_sucursal
  FOR UPDATE TO authenticated
  USING (sucursal_id IN (
    SELECT s.id FROM public.sucursales s
    WHERE s.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'))
  WITH CHECK (sucursal_id IN (
    SELECT s.id FROM public.sucursales s
    WHERE s.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

CREATE POLICY "stock_sucursal_delete" ON public.stock_sucursal
  FOR DELETE TO authenticated
  USING (sucursal_id IN (
    SELECT s.id FROM public.sucursales s
    WHERE s.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

-- =============================================
-- 3. El trigger que mantiene la suma
-- ---------------------------------------------
-- EL UNICO que escribe `stock_actual` a partir de ahora. No hay recursion:
-- tocar `productos` no dispara nada sobre `stock_sucursal`.
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
  -- En un DELETE la fila viva es OLD; en el resto, NEW. Un UPDATE que mueva la
  -- fila de producto o variante (no deberia pasar, pero la clave no lo impide)
  -- tiene que recalcular los DOS lados.
  v_producto := COALESCE(NEW.producto_id, OLD.producto_id);
  v_variante := COALESCE(NEW.variante_id, OLD.variante_id);

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

  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_stock_sucursal_sync ON public.stock_sucursal;
CREATE TRIGGER trg_stock_sucursal_sync
  AFTER INSERT OR UPDATE OR DELETE ON public.stock_sucursal
  FOR EACH ROW EXECUTE FUNCTION public._sincronizar_stock_total();

-- =============================================
-- 4. Repartir lo que ya hay
-- ---------------------------------------------
-- Todo el stock actual va a `Principal`. Ningun numero cambia de valor, solo de
-- sitio: el trigger recalcula la suma y debe devolver exactamente lo mismo.
-- =============================================

INSERT INTO public.stock_sucursal (sucursal_id, producto_id, variante_id, cantidad)
SELECT s.id, p.id, NULL, p.stock_actual
FROM public.productos p
JOIN public.sucursales s ON s.tenant_id = p.tenant_id AND s.nombre = 'Principal'
ON CONFLICT DO NOTHING;

INSERT INTO public.stock_sucursal (sucursal_id, producto_id, variante_id, cantidad)
SELECT s.id, v.producto_id, v.id, v.stock_actual
FROM public.variantes_producto v
JOIN public.productos p ON p.id = v.producto_id
JOIN public.sucursales s ON s.tenant_id = p.tenant_id AND s.nombre = 'Principal'
ON CONFLICT DO NOTHING;

-- =============================================
-- 5. Las dos auxiliares
-- ---------------------------------------------
-- Existen para que la 079 pueda cambiar las cinco funciones de stock con
-- sustituciones de UNA linea en vez de cirugia a mano en cinco sitios. Cuanto
-- mas pequeño el parche, menos sitio para colar un error de transcripcion.
-- =============================================

-- Cuantas unidades hay disponibles donde se esta vendiendo.
-- `p_fallback` es lo que se responde cuando no hay sucursal en juego (una venta
-- sin caja abierta): se conserva el comportamiento anterior en vez de bloquear.
CREATE OR REPLACE FUNCTION public.stock_disponible(
  p_sucursal_id UUID,
  p_producto_id UUID,
  p_variante_id UUID,
  p_fallback DECIMAL DEFAULT 0
)
RETURNS DECIMAL
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_cantidad DECIMAL(10,3);
BEGIN
  IF p_sucursal_id IS NULL THEN
    RETURN p_fallback;
  END IF;

  SELECT ss.cantidad INTO v_cantidad
  FROM public.stock_sucursal ss
  WHERE ss.sucursal_id = p_sucursal_id
    AND ss.producto_id = p_producto_id
    -- `IS NOT DISTINCT FROM` y no `=`: la venta "general" lleva variante NULL y
    -- `= NULL` no es cierto nunca. Mismo fallo que ya se corrigio en las listas
    -- de precios.
    AND ss.variante_id IS NOT DISTINCT FROM p_variante_id;

  -- Sin fila = nunca ha habido existencias de eso en ese local, que es cero.
  RETURN COALESCE(v_cantidad, 0);
END;
$fn$;

-- Suma (o resta, con delta negativo) unidades en un local. Crea la fila si es
-- la primera vez que ese producto pisa esa sucursal.
--
-- Con `p_sucursal_id` NULL cae al local mas antiguo del negocio, que tras el
-- reparto de arriba es `Principal`. Ocurre en una venta sin caja abierta: es
-- preferible apuntar el movimiento a un sitio determinista que dejar el
-- inventario sin descontar y que derive en silencio.
CREATE OR REPLACE FUNCTION public.mover_stock(
  p_sucursal_id UUID,
  p_producto_id UUID,
  p_variante_id UUID,
  p_delta DECIMAL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_sucursal UUID := p_sucursal_id;
BEGIN
  IF v_sucursal IS NULL THEN
    SELECT s.id INTO v_sucursal
    FROM public.sucursales s
    JOIN public.productos p ON p.tenant_id = s.tenant_id
    WHERE p.id = p_producto_id AND s.activa
    ORDER BY s.creado_en
    LIMIT 1;
  END IF;

  IF v_sucursal IS NULL THEN
    RAISE EXCEPTION 'El negocio no tiene ninguna sucursal donde registrar el movimiento';
  END IF;

  INSERT INTO public.stock_sucursal (sucursal_id, producto_id, variante_id, cantidad)
  VALUES (v_sucursal, p_producto_id, p_variante_id, p_delta)
  ON CONFLICT (sucursal_id, producto_id, variante_id) DO UPDATE
    SET cantidad = public.stock_sucursal.cantidad + EXCLUDED.cantidad,
        actualizado_en = NOW();
END;
$fn$;

REVOKE ALL ON FUNCTION public.mover_stock(UUID, UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.stock_disponible(UUID, UUID, UUID, DECIMAL) TO authenticated;

COMMIT;
