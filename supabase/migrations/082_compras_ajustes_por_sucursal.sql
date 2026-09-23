-- =============================================
-- 082: compras, recepciones y ajustes saben en QUE LOCAL ocurren
-- ---------------------------------------------
-- La 079 dejo cuatro funciones de stock apuntando a `Principal` por defecto
-- (pasaban NULL a `mover_stock`). Correcto para un negocio de un solo local,
-- pero con varios, una compra recibida en Norte acababa en el almacen de
-- Principal. Esta migracion les da su sucursal de verdad:
--
--   - COMPRA DIRECTA y AJUSTE reciben `p_sucursal_id` (opcional, al final).
--   - RECEPCION DE ORDEN usa la sucursal de la ORDEN: se decide al pedirla,
--     porque ahi es donde se sabe a que local va la mercancia.
--   - CANCELACION usa la sucursal de la COMPRA que deshace: las unidades salen
--     de donde entraron, no del local por defecto.
--
-- Ademas cierra tres huecos que aparecieron al revisar la venta:
--
--   1. La venta aceptaba una caja DE OTRO NEGOCIO para resolver su sucursal
--      (`WHERE c.id = p_caja_id`, sin comprobar el tenant). Con eso, el stock
--      podia descontarse en un local ajeno. Nadie lo explotaba —hace falta el
--      UUID de una caja ajena— pero una venta no debe poder tocar el almacen
--      de otro negocio bajo ningun concepto.
--   2. Una venta sin caja resolvia la sucursal a NULL y validaba contra el
--      total del negocio, pero descontaba de `Principal`: podia aprobar una
--      venta y dejar Principal en negativo. Ahora valida y descuenta en el
--      MISMO sitio.
--   3. `mover_stock` no comprobaba que la sucursal fuera del negocio del
--      producto. Ahora si: defensa en profundidad, por si algun dia alguien la
--      llama con datos que no ha validado.
--
-- Y aplica el "se vende aqui": un producto marcado como no vendible en un local
-- no se puede cobrar ahi, aunque tenga existencias.
--
-- ⚠️ CAMBIOS DE FIRMA (bug #23). `ajustar_inventario`, `registrar_compra_directa`
-- y `listar_ventas` cambian de argumentos. `CREATE OR REPLACE` con otra lista de
-- argumentos NO sustituye: crea una SEGUNDA funcion, y PostgREST, al ver dos que
-- encajan con los mismos argumentos con nombre, falla con "Could not choose the
-- best candidate function". Por eso se BORRA la vieja antes de crear la nueva,
-- y se vuelven a conceder permisos a mano — una funcion nueva nace con EXECUTE
-- para PUBLIC, asi que tambien se revoca explicitamente.
-- =============================================

BEGIN;

-- =============================================
-- 1. Las columnas
-- =============================================

ALTER TABLE public.compras
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE RESTRICT;
ALTER TABLE public.ordenes_compra
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE RESTRICT;
ALTER TABLE public.ajustes_inventario
  ADD COLUMN IF NOT EXISTS sucursal_id UUID REFERENCES public.sucursales(id) ON DELETE RESTRICT;

-- Todo lo anterior ocurrio, por definicion, en el unico local que habia.
UPDATE public.compras x SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.tenant_id = x.tenant_id AND s.nombre = 'Principal' AND x.sucursal_id IS NULL;

UPDATE public.ordenes_compra x SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.tenant_id = x.tenant_id AND s.nombre = 'Principal' AND x.sucursal_id IS NULL;

UPDATE public.ajustes_inventario x SET sucursal_id = s.id
FROM public.sucursales s
WHERE s.tenant_id = x.tenant_id AND s.nombre = 'Principal' AND x.sucursal_id IS NULL;

-- =============================================
-- 2. Auxiliares
-- =============================================

-- El local al que va un movimiento cuando nadie dijo cual. Prefiere uno
-- ABIERTO y, entre ellos, el mas antiguo (`Principal`). Si todos estuvieran
-- cerrados devuelve igualmente uno: bloquear una venta porque el dueño cerro
-- todos sus locales en el sistema seria peor que apuntarla en el mas antiguo.
CREATE OR REPLACE FUNCTION public._sucursal_por_defecto(p_tenant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT s.id FROM public.sucursales s
  WHERE s.tenant_id = p_tenant_id
  ORDER BY s.activa DESC, s.creado_en
  LIMIT 1;
$fn$;

-- El "se vende aqui". Se mira la fila del PRODUCTO (variante NULL): es un
-- interruptor por producto y local, no por talla. Sin fila = se vende, que es
-- el valor por defecto de la columna.
CREATE OR REPLACE FUNCTION public.se_vende_en(p_sucursal_id UUID, p_producto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
  SELECT COALESCE((
    SELECT ss.se_vende FROM public.stock_sucursal ss
    WHERE ss.sucursal_id = p_sucursal_id
      AND ss.producto_id = p_producto_id
      AND ss.variante_id IS NULL), TRUE);
$fn$;

-- `mover_stock`, ahora con guardas: la sucursal tiene que ser del negocio del
-- producto, y la variante del producto.
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
  v_tenant UUID;
BEGIN
  SELECT p.tenant_id INTO v_tenant FROM public.productos p WHERE p.id = p_producto_id;
  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Producto % no encontrado', p_producto_id;
  END IF;

  IF v_sucursal IS NULL THEN
    v_sucursal := public._sucursal_por_defecto(v_tenant);
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.sucursales s WHERE s.id = v_sucursal AND s.tenant_id = v_tenant
  ) THEN
    RAISE EXCEPTION 'La sucursal no pertenece al negocio del producto';
  END IF;

  IF v_sucursal IS NULL THEN
    RAISE EXCEPTION 'El negocio no tiene ninguna sucursal donde registrar el movimiento';
  END IF;

  IF p_variante_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.variantes_producto v
    WHERE v.id = p_variante_id AND v.producto_id = p_producto_id
  ) THEN
    RAISE EXCEPTION 'La variante no pertenece al producto';
  END IF;

  INSERT INTO public.stock_sucursal (sucursal_id, producto_id, variante_id, cantidad)
  VALUES (v_sucursal, p_producto_id, p_variante_id, p_delta)
  ON CONFLICT (sucursal_id, producto_id, variante_id) DO UPDATE
    SET cantidad = public.stock_sucursal.cantidad + EXCLUDED.cantidad,
        actualizado_en = NOW();
END;
$fn$;

-- Internas: solo las llaman funciones SECURITY DEFINER, que corren como dueño.
-- `stock_disponible` se concedio a `authenticated` en la 078 y no hacia falta:
-- con el UUID de otro negocio dejaba leer sus existencias.
REVOKE ALL ON FUNCTION public._sucursal_por_defecto(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.se_vende_en(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.stock_disponible(UUID, UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.mover_stock(UUID, UUID, UUID, DECIMAL) FROM PUBLIC, anon, authenticated;

-- =============================================
-- 3. La venta: sucursal a prueba de cajas ajenas, y "se vende aqui"
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = '_crear_venta_desde_items';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe _crear_venta_desde_items'; END IF;
  IF v_src LIKE '%_sucursal_por_defecto%' THEN RETURN; END IF;
  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$  SELECT c.sucursal_id INTO v_sucursal_id
  FROM public.cajas c
  WHERE c.id = p_caja_id;

  IF p_idempotency_key IS NOT NULL THEN$q$,
$q$  -- La caja tiene que ser DE ESTE NEGOCIO: sin el filtro por tenant, una caja
  -- ajena decidia en que almacen se descontaba (migracion 082).
  SELECT c.sucursal_id INTO v_sucursal_id
  FROM public.cajas c
  WHERE c.id = p_caja_id
    AND c.tenant_id = p_tenant_id;

  -- Sin caja explicita, la que el cajero tenga abierta: es la misma que la
  -- funcion usa mas abajo para registrar el movimiento de dinero.
  IF v_sucursal_id IS NULL THEN
    SELECT c.sucursal_id INTO v_sucursal_id
    FROM public.cajas c
    WHERE c.tenant_id = p_tenant_id
      AND c.usuario_id = p_usuario_id
      AND c.estado = 'ABIERTA'
    ORDER BY c.fecha_apertura DESC
    LIMIT 1;
  END IF;

  -- Y si aun asi no hay, el local por defecto. Nunca NULL: validar el stock en
  -- un sitio y descontarlo en otro era justo el fallo.
  IF v_sucursal_id IS NULL THEN
    v_sucursal_id := public._sucursal_por_defecto(p_tenant_id);
  END IF;

  IF p_idempotency_key IS NOT NULL THEN$q$);

  v_nuevo := replace(v_nuevo,
$q$    IF NOT COALESCE(v_producto.es_servicio, FALSE) AND v_stock < v_cantidad THEN$q$,
$q$    IF NOT public.se_vende_en(v_sucursal_id, v_producto.id) THEN
      RAISE EXCEPTION '"%" no se vende en esta sucursal', v_producto.nombre;
    END IF;

    IF NOT COALESCE(v_producto.es_servicio, FALSE) AND v_stock < v_cantidad THEN$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%AND c.tenant_id = p_tenant_id;%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%_sucursal_por_defecto(p_tenant_id)%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%se_vende_en(v_sucursal_id, v_producto.id)%') t;
  IF v_ok <> 3 THEN RAISE EXCEPTION 'Venta: solo prendieron % de 3', v_ok; END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 4. El ajuste: sobre UN local, y con la sucursal en el historial
-- ---------------------------------------------
-- Antes validaba "no puede quedar negativo" contra el TOTAL del negocio. Con
-- existencias por local eso deja pasar un ajuste de -10 en Norte, que tiene 2,
-- solo porque Principal tiene 50. Ahora se valida contra el local ajustado.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='ajustar_inventario';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe ajustar_inventario'; END IF;
  IF v_src LIKE '%p_sucursal_id%' THEN RETURN; END IF;
  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$p_lote_id uuid DEFAULT NULL::uuid)$q$,
$q$p_lote_id uuid DEFAULT NULL::uuid, p_sucursal_id uuid DEFAULT NULL::uuid)$q$);

  v_nuevo := replace(v_nuevo,
$q$  v_ajuste_id UUID;
BEGIN$q$,
$q$  v_ajuste_id UUID;
  v_sucursal UUID;
BEGIN$q$);

  v_nuevo := replace(v_nuevo,
$q$    RAISE EXCEPTION 'No tienes permiso para ajustar el inventario';
  END IF;$q$,
$q$    RAISE EXCEPTION 'No tienes permiso para ajustar el inventario';
  END IF;

  -- El local ajustado. Sin sucursal explicita, el local por defecto: para un
  -- negocio de uno solo, el comportamiento de siempre.
  IF p_sucursal_id IS NOT NULL THEN
    SELECT s.id INTO v_sucursal FROM public.sucursales s
    WHERE s.id = p_sucursal_id AND s.tenant_id = v_tenant_id;
    IF v_sucursal IS NULL THEN
      RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
    END IF;
  ELSE
    v_sucursal := public._sucursal_por_defecto(v_tenant_id);
  END IF;$q$);

  v_nuevo := replace(v_nuevo,
$q$  v_stock_nuevo := v_stock_anterior + p_cantidad_ajuste;$q$,
$q$  -- Lo de arriba solo comprueba que el producto exista y sea de este negocio.
  -- Lo que se ajusta es el stock DEL LOCAL, y contra ese se valida.
  v_stock_anterior := public.stock_disponible(v_sucursal, p_producto_id, p_variante_id, 0);
  v_stock_nuevo := v_stock_anterior + p_cantidad_ajuste;$q$);

  v_nuevo := replace(v_nuevo,
$q$mover_stock(NULL, p_producto_id, p_variante_id, p_cantidad_ajuste)$q$,
$q$mover_stock(v_sucursal, p_producto_id, p_variante_id, p_cantidad_ajuste)$q$);

  v_nuevo := replace(v_nuevo,
$q$    notas, usuario_id
  ) VALUES ($q$,
$q$    notas, usuario_id, sucursal_id
  ) VALUES ($q$);

  v_nuevo := replace(v_nuevo,
$q$    p_notas, v_caller_id
  ) RETURNING id INTO v_ajuste_id;$q$,
$q$    p_notas, v_caller_id, v_sucursal
  ) RETURNING id INTO v_ajuste_id;$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%p_sucursal_id uuid DEFAULT NULL::uuid)%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%v_sucursal UUID;%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%La sucursal no pertenece a este negocio%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%stock_disponible(v_sucursal, p_producto_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(v_sucursal, p_producto_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%notas, usuario_id, sucursal_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%p_notas, v_caller_id, v_sucursal%') t;
  IF v_ok <> 7 THEN RAISE EXCEPTION 'Ajuste: solo prendieron % de 7', v_ok; END IF;

  DROP FUNCTION public.ajustar_inventario(UUID, NUMERIC, public.motivo_ajuste, TEXT, UUID, UUID);
  EXECUTE v_nuevo;
END
$migracion$;

REVOKE ALL ON FUNCTION public.ajustar_inventario(UUID, NUMERIC, public.motivo_ajuste, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ajustar_inventario(UUID, NUMERIC, public.motivo_ajuste, TEXT, UUID, UUID, UUID) TO authenticated, service_role;

-- =============================================
-- 5. La compra directa
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='registrar_compra_directa';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe registrar_compra_directa'; END IF;
  IF v_src LIKE '%p_sucursal_id%' THEN RETURN; END IF;
  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$p_notas text DEFAULT NULL::text)$q$,
$q$p_notas text DEFAULT NULL::text, p_sucursal_id uuid DEFAULT NULL::uuid)$q$);

  v_nuevo := replace(v_nuevo,
$q$  v_tasa_iva CONSTANT DECIMAL := 0.16;
BEGIN$q$,
$q$  v_tasa_iva CONSTANT DECIMAL := 0.16;
  v_sucursal UUID;
BEGIN$q$);

  v_nuevo := replace(v_nuevo,
$q$  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra no tiene renglones';
  END IF;$q$,
$q$  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La compra no tiene renglones';
  END IF;

  -- El local que RECIBE la mercancia. Sin sucursal explicita, el de por
  -- defecto: para un negocio de uno solo, el comportamiento de siempre.
  IF p_sucursal_id IS NOT NULL THEN
    SELECT s.id INTO v_sucursal FROM public.sucursales s
    WHERE s.id = p_sucursal_id AND s.tenant_id = p_tenant_id;
    IF v_sucursal IS NULL THEN
      RAISE EXCEPTION 'La sucursal no pertenece a este negocio';
    END IF;
  ELSE
    v_sucursal := public._sucursal_por_defecto(p_tenant_id);
  END IF;$q$);

  v_nuevo := replace(v_nuevo,
$q$    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, notas
  ) VALUES (
    p_tenant_id, p_proveedor_id, v_caller_id, NULL,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), p_notas
  ) RETURNING id INTO v_compra_id;$q$,
$q$    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, notas, sucursal_id
  ) VALUES (
    p_tenant_id, p_proveedor_id, v_caller_id, NULL,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), p_notas, v_sucursal
  ) RETURNING id INTO v_compra_id;$q$);

  v_nuevo := replace(v_nuevo,
$q$mover_stock(NULL, v_producto_id$q$,
$q$mover_stock(v_sucursal, v_producto_id$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%p_sucursal_id uuid DEFAULT NULL::uuid)%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%v_sucursal UUID;%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%El local que RECIBE la mercancia%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%p_notas, v_sucursal%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(v_sucursal, v_producto_id, v_variante_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%mover_stock(v_sucursal, v_producto_id, NULL%'
    UNION ALL SELECT 1 WHERE v_nuevo NOT LIKE '%mover_stock(NULL%') t;
  IF v_ok <> 7 THEN RAISE EXCEPTION 'Compra directa: solo prendieron % de 7', v_ok; END IF;

  DROP FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT);
  EXECUTE v_nuevo;
END
$migracion$;

-- `anon` NO se vuelve a conceder: la vieja lo tenia por descuido. Sin sesion no
-- hay `auth.uid()` y la funcion la rechazaba igual, pero no hay motivo para que
-- una funcion que mueve dinero y stock sea invocable sin iniciar sesion.
REVOKE ALL ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_compra_directa(UUID, UUID, JSONB, TEXT, BOOLEAN, TEXT, UUID) TO authenticated, service_role;

-- =============================================
-- 6. La recepcion de orden: al local de la ORDEN
-- ---------------------------------------------
-- La firma no cambia: la sucursal se decide al crear la orden (columna nueva),
-- asi que la recepcion la lee de ahi. Ordenes anteriores sin sucursal caen al
-- local por defecto.
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT; v_ok INT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='recibir_orden_compra';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe recibir_orden_compra'; END IF;
  IF v_src LIKE '%v_sucursal%' THEN RETURN; END IF;
  v_nuevo := v_src;

  v_nuevo := replace(v_nuevo,
$q$  v_tasa_iva DECIMAL := 0;
BEGIN$q$,
$q$  v_tasa_iva DECIMAL := 0;
  v_sucursal UUID;
BEGIN$q$);

  v_nuevo := replace(v_nuevo,
$q$  v_tenant_id := v_orden.tenant_id;$q$,
$q$  v_tenant_id := v_orden.tenant_id;

  -- A que local va la mercancia: el que se decidio al pedirla. Se revalida
  -- contra el negocio, por si la orden apuntara a una sucursal ajena.
  SELECT s.id INTO v_sucursal FROM public.sucursales s
  WHERE s.id = v_orden.sucursal_id AND s.tenant_id = v_tenant_id;
  IF v_sucursal IS NULL THEN
    v_sucursal := public._sucursal_por_defecto(v_tenant_id);
  END IF;$q$);

  v_nuevo := replace(v_nuevo,
$q$    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW()
  ) RETURNING id INTO v_compra_id;$q$,
$q$    numero_factura, subtotal, impuesto, total, estado, fecha_recepcion, sucursal_id
  ) VALUES (
    v_tenant_id, v_orden.proveedor_id, v_caller_id, p_orden_id,
    p_numero_factura, 0, 0, 0, 'RECIBIDA', NOW(), v_sucursal
  ) RETURNING id INTO v_compra_id;$q$);

  v_nuevo := replace(v_nuevo,
$q$mover_stock(NULL, v_item_recibido.producto_id$q$,
$q$mover_stock(v_sucursal, v_item_recibido.producto_id$q$);

  SELECT COUNT(*) INTO v_ok FROM (
    SELECT 1 WHERE v_nuevo LIKE '%v_sucursal UUID;%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%WHERE s.id = v_orden.sucursal_id%'
    UNION ALL SELECT 1 WHERE v_nuevo LIKE '%NOW(), v_sucursal%'
    UNION ALL SELECT 1 WHERE v_nuevo NOT LIKE '%mover_stock(NULL%') t;
  IF v_ok <> 4 THEN RAISE EXCEPTION 'Recepcion: solo prendieron % de 4', v_ok; END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 7. La cancelacion: las unidades salen de donde entraron
-- =============================================

DO $migracion$
DECLARE v_src TEXT; v_nuevo TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_src FROM pg_proc p
  JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='cancelar_compra';
  IF v_src IS NULL THEN RAISE EXCEPTION 'No existe cancelar_compra'; END IF;
  IF v_src LIKE '%v_compra.sucursal_id%' THEN RETURN; END IF;

  v_nuevo := replace(v_src,
$q$mover_stock(NULL, v_renglon.producto_id$q$,
$q$mover_stock(v_compra.sucursal_id, v_renglon.producto_id$q$);
  IF v_nuevo NOT LIKE '%mover_stock(v_compra.sucursal_id%' THEN
    RAISE EXCEPTION 'Cancelacion: la sustitucion no prendio';
  END IF;
  EXECUTE v_nuevo;
END
$migracion$;

-- =============================================
-- 8. El historial de ventas, filtrable por sucursal
-- ---------------------------------------------
-- Se reescribe entera (es corta) porque cambia tambien lo que DEVUELVE: añade
-- `sucursal_nombre` para la columna del historial. Cambiar el RETURNS TABLE
-- obliga a borrar la funcion igualmente.
-- =============================================

DROP FUNCTION IF EXISTS public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER);

CREATE FUNCTION public.listar_ventas(
  p_tenant_id UUID,
  p_desde TIMESTAMPTZ,
  p_hasta TIMESTAMPTZ,
  p_cajero_id UUID DEFAULT NULL,
  p_limite INTEGER DEFAULT 50,
  p_desplazamiento INTEGER DEFAULT 0,
  p_sucursal_id UUID DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  fecha_venta TIMESTAMPTZ,
  usuario_id UUID,
  cajero_email TEXT,
  cliente_nombre TEXT,
  metodo_pago public.metodo_pago,
  estado public.estado_venta,
  total NUMERIC,
  origen TEXT,
  requiere_revision BOOLEAN,
  sucursal_nombre TEXT,
  total_filas BIGINT
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ve_todas BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  v_ve_todas := public.authorize('sales.view_all');

  RETURN QUERY
  SELECT v.id,
         v.fecha_venta,
         v.usuario_id,
         u.email::text,
         c.nombre,
         v.metodo_pago,
         v.estado,
         v.total,
         v.origen,
         v.requiere_revision,
         s.nombre,
         COUNT(*) OVER () AS total_filas
  FROM public.ventas v
  LEFT JOIN auth.users u ON u.id = v.usuario_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN public.sucursales s ON s.id = v.sucursal_id
  WHERE v.tenant_id = p_tenant_id
    AND v.fecha_venta >= p_desde
    AND v.fecha_venta <= p_hasta
    AND (v_ve_todas OR v.usuario_id = v_uid)
    AND (p_cajero_id IS NULL OR NOT v_ve_todas OR v.usuario_id = p_cajero_id)
    -- NULL = todas. Es el filtro del selector de sucursal: acota la consulta,
    -- no concede nada, porque el negocio ya se valido arriba.
    AND (p_sucursal_id IS NULL OR v.sucursal_id = p_sucursal_id)
  ORDER BY v.fecha_venta DESC
  LIMIT GREATEST(p_limite, 1)
  OFFSET GREATEST(p_desplazamiento, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER, UUID) TO authenticated, service_role;

COMMIT;
