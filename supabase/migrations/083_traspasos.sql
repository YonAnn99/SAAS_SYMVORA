-- =============================================
-- 083: traspasos entre sucursales, y fijar existencias de un local
-- ---------------------------------------------
-- TRASPASOS. Con existencias por local, mover mercancia de Centro a Norte es
-- una operacion de verdad. Sin ella habria que hacer dos ajustes a mano —restar
-- en uno, sumar en otro— y basta con que alguien haga solo el primero para que
-- el inventario del negocio pierda unidades sin explicacion. Aqui es UNA
-- operacion: o se mueven todas las lineas, o ninguna.
--
-- La escritura va SOLO por `registrar_traspaso`: las tablas no tienen politicas
-- de INSERT/UPDATE/DELETE, asi que por PostgREST solo se pueden leer. Un
-- traspaso "a mano" sin mover el stock seria un historial que miente.
--
-- CONCURRENCIA. Se bloquea la fila del producto (`FOR UPDATE`), la misma que
-- bloquea la venta. Asi un traspaso y una venta simultaneos del mismo producto
-- se ponen en fila: no pueden los dos ver "hay 3" y llevarse 3 cada uno.
--
-- FIJAR EXISTENCIAS (`establecer_stock_sucursal`). Las pantallas que hoy dicen
-- "stock: 40" (alta de producto, edicion en linea, variantes) necesitan poder
-- decir "40 EN ESTE LOCAL". Recibe el valor final, calcula la diferencia y la
-- mueve. Tambien enciende o apaga el "se vende aqui".
-- =============================================

BEGIN;

-- =============================================
-- 1. Las tablas
-- =============================================

CREATE TABLE IF NOT EXISTS public.traspasos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  sucursal_origen_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
  sucursal_destino_id UUID NOT NULL REFERENCES public.sucursales(id) ON DELETE RESTRICT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (sucursal_origen_id <> sucursal_destino_id)
);

CREATE TABLE IF NOT EXISTS public.detalle_traspaso (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  traspaso_id UUID NOT NULL REFERENCES public.traspasos(id) ON DELETE CASCADE,
  -- Sin ON DELETE, igual que `detalle_ventas` y `detalle_compras`: un producto
  -- con historial no se borra por debajo de el.
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.variantes_producto(id),
  cantidad DECIMAL(10,3) NOT NULL CHECK (cantidad > 0)
);

CREATE INDEX IF NOT EXISTS idx_traspasos_tenant_fecha
  ON public.traspasos (tenant_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS idx_detalle_traspaso_traspaso
  ON public.detalle_traspaso (traspaso_id);

ALTER TABLE public.traspasos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_traspaso ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traspasos_select" ON public.traspasos
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "detalle_traspaso_select" ON public.detalle_traspaso
  FOR SELECT TO authenticated
  USING (traspaso_id IN (
    SELECT t.id FROM public.traspasos t
    WHERE t.tenant_id IN (SELECT public.user_tenant_ids())));

-- =============================================
-- 2. El permiso, por usuario y por negocio
-- ---------------------------------------------
-- `get_effective_permissions_for_user` respeta las excepciones concedidas por
-- el dueño (migracion 055) y va acotado al negocio. Mirar solo
-- `role_permissions`, como hacen las funciones mas antiguas, dejaria fuera a un
-- cajero al que el dueño le concedio Inventario a proposito.
-- =============================================

CREATE OR REPLACE FUNCTION public._puede(p_tenant_id UUID, p_permiso TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.get_effective_permissions_for_user(p_tenant_id, auth.uid()) ep
    WHERE ep.permission = p_permiso);
$fn$;

REVOKE ALL ON FUNCTION public._puede(UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. Registrar un traspaso
-- =============================================

CREATE OR REPLACE FUNCTION public.registrar_traspaso(
  p_origen_id UUID,
  p_destino_id UUID,
  p_items JSONB,
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant UUID;
  v_tenant_destino UUID;
  v_destino_activa BOOLEAN;
  v_traspaso UUID;
  v_item JSONB;
  v_producto UUID;
  v_variante UUID;
  v_cantidad DECIMAL(10,3);
  v_nombre TEXT;
  v_servicio BOOLEAN;
  v_disponible DECIMAL(10,3);
  v_lineas INT := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_origen_id IS NULL OR p_destino_id IS NULL OR p_origen_id = p_destino_id THEN
    RAISE EXCEPTION 'Elige dos sucursales distintas';
  END IF;

  SELECT s.tenant_id INTO v_tenant FROM public.sucursales s WHERE s.id = p_origen_id;
  SELECT s.tenant_id, s.activa INTO v_tenant_destino, v_destino_activa
  FROM public.sucursales s WHERE s.id = p_destino_id;

  IF v_tenant IS NULL OR v_tenant_destino IS NULL OR v_tenant <> v_tenant_destino THEN
    RAISE EXCEPTION 'Las dos sucursales tienen que ser del mismo negocio';
  END IF;

  -- El ORIGEN puede estar cerrado —vaciar un local que cierra es justo para lo
  -- que sirve un traspaso—, pero el DESTINO no: seria mandar mercancia a un
  -- sitio que ya no vende.
  IF NOT v_destino_activa THEN
    RAISE EXCEPTION 'La sucursal de destino esta cerrada';
  END IF;

  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para traspasar mercancia';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'El traspaso no tiene productos';
  END IF;

  INSERT INTO public.traspasos (tenant_id, sucursal_origen_id, sucursal_destino_id, usuario_id, notas)
  VALUES (v_tenant, p_origen_id, p_destino_id, auth.uid(), NULLIF(btrim(p_notas), ''))
  RETURNING id INTO v_traspaso;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_producto := (v_item->>'producto_id')::UUID;
    v_variante := NULLIF(v_item->>'variante_id', '')::UUID;
    v_cantidad := (v_item->>'cantidad')::DECIMAL;

    IF v_cantidad IS NULL OR v_cantidad <= 0 THEN
      RAISE EXCEPTION 'Cada producto necesita una cantidad mayor que cero';
    END IF;

    -- Se bloquea la fila del producto: la misma que bloquea la venta.
    SELECT p.nombre, COALESCE(p.es_servicio, FALSE) INTO v_nombre, v_servicio
    FROM public.productos p
    WHERE p.id = v_producto AND p.tenant_id = v_tenant
    FOR UPDATE;

    IF v_nombre IS NULL THEN
      RAISE EXCEPTION 'Un producto del traspaso no pertenece a este negocio';
    END IF;

    IF v_servicio THEN
      RAISE EXCEPTION '"%" es un servicio: no tiene existencias que traspasar', v_nombre;
    END IF;

    IF v_variante IS NOT NULL THEN
      PERFORM 1 FROM public.variantes_producto v
      WHERE v.id = v_variante AND v.producto_id = v_producto
      FOR UPDATE;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'La variante no pertenece a "%"', v_nombre;
      END IF;
    END IF;

    v_disponible := public.stock_disponible(p_origen_id, v_producto, v_variante, 0);
    IF v_disponible < v_cantidad THEN
      RAISE EXCEPTION 'No hay suficiente "%" en la sucursal de origen. Disponible: %', v_nombre, v_disponible;
    END IF;

    PERFORM public.mover_stock(p_origen_id, v_producto, v_variante, -v_cantidad);
    PERFORM public.mover_stock(p_destino_id, v_producto, v_variante, v_cantidad);

    INSERT INTO public.detalle_traspaso (traspaso_id, producto_id, variante_id, cantidad)
    VALUES (v_traspaso, v_producto, v_variante, v_cantidad);

    v_lineas := v_lineas + 1;
  END LOOP;

  RETURN jsonb_build_object('traspaso_id', v_traspaso, 'lineas', v_lineas);
END;
$fn$;

REVOKE ALL ON FUNCTION public.registrar_traspaso(UUID, UUID, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_traspaso(UUID, UUID, JSONB, TEXT) TO authenticated, service_role;

-- =============================================
-- 4. Fijar las existencias de un local
-- ---------------------------------------------
-- `p_cantidad` es el valor FINAL ("en Norte hay 12"), no una diferencia: es lo
-- que escribe el usuario en un campo de stock. `NULL` = no tocar la cantidad,
-- para poder cambiar solo el "se vende aqui".
-- =============================================

CREATE OR REPLACE FUNCTION public.establecer_stock_sucursal(
  p_sucursal_id UUID,
  p_producto_id UUID,
  p_variante_id UUID DEFAULT NULL,
  p_cantidad DECIMAL DEFAULT NULL,
  p_se_vende BOOLEAN DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
DECLARE
  v_tenant UUID;
  v_actual DECIMAL(10,3);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT s.tenant_id INTO v_tenant FROM public.sucursales s WHERE s.id = p_sucursal_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Sucursal no encontrada';
  END IF;

  IF NOT public._puede(v_tenant, 'inventory.manage') THEN
    RAISE EXCEPTION 'No tienes permiso para modificar existencias';
  END IF;

  PERFORM 1 FROM public.productos p
  WHERE p.id = p_producto_id AND p.tenant_id = v_tenant
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'El producto no pertenece a este negocio';
  END IF;

  IF p_cantidad IS NOT NULL THEN
    IF p_cantidad < 0 THEN
      RAISE EXCEPTION 'Las existencias no pueden ser negativas';
    END IF;
    v_actual := public.stock_disponible(p_sucursal_id, p_producto_id, p_variante_id, 0);
    IF p_cantidad <> v_actual THEN
      PERFORM public.mover_stock(p_sucursal_id, p_producto_id, p_variante_id, p_cantidad - v_actual);
    END IF;
  END IF;

  IF p_se_vende IS NOT NULL THEN
    -- Si la fila no existe (nunca hubo existencias ahi) se crea con cero.
    INSERT INTO public.stock_sucursal (sucursal_id, producto_id, variante_id, cantidad, se_vende)
    VALUES (p_sucursal_id, p_producto_id, p_variante_id, 0, p_se_vende)
    ON CONFLICT (sucursal_id, producto_id, variante_id) DO UPDATE
      SET se_vende = EXCLUDED.se_vende, actualizado_en = NOW();
  END IF;
END;
$fn$;

REVOKE ALL ON FUNCTION public.establecer_stock_sucursal(UUID, UUID, UUID, DECIMAL, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.establecer_stock_sucursal(UUID, UUID, UUID, DECIMAL, BOOLEAN) TO authenticated, service_role;

COMMIT;
