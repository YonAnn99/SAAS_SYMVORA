-- =============================================
-- 067: Listas de precios
-- ---------------------------------------------
-- QUE HABILITA: agrupar productos con precios propios — una liquidacion, un
-- precio de mayoreo, una tarifa de distribuidor — y aplicarles subidas o bajadas
-- por porcentaje de golpe, en vez de editar producto por producto y luego
-- devolverlos a mano.
--
-- ⚠️ ESTA MIGRACION NO CAMBIA NINGUN PRECIO DE VENTA. Solo crea el almacen. El
-- punto de venta sigue cobrando `productos.precio_venta` hasta que una segunda
-- fase toque `_crear_venta_desde_items`, que es la funcion que cobra. Se parte
-- a proposito: ese cambio merece llegar solo y revisado (ver bug #5, migracion
-- 011 — el precio JAMAS se acepta desde el cliente).
--
-- POR QUE DOS TABLAS: la cabecera (`listas_precios`) tiene nombre y estado; el
-- detalle (`precios_lista`) tiene una fila por producto o por variante. Meterlo
-- todo en una columna JSON de `productos` impediria consultar "que listas
-- incluyen este producto" y no dejaria ponerle precio a una talla concreta.
-- =============================================

BEGIN;

-- =============================================
-- 1. La lista
-- =============================================

CREATE TABLE IF NOT EXISTS public.listas_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,

  -- Una lista en borrador se puede armar con calma sin que aparezca para
  -- vender. La fase 2 solo ofrecera las activas en el punto de venta.
  activa BOOLEAN NOT NULL DEFAULT FALSE,

  -- ON DELETE SET NULL: que se borre el usuario no puede borrar la lista de
  -- precios del negocio.
  creado_por UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Dos listas "LIQUIDACION" en el mismo negocio serian indistinguibles en el
  -- desplegable del punto de venta.
  UNIQUE (tenant_id, nombre)
);

-- =============================================
-- 2. El precio de cada producto dentro de la lista
-- =============================================

CREATE TABLE IF NOT EXISTS public.precios_lista (
  lista_id UUID NOT NULL REFERENCES public.listas_precios(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,

  -- NULL = el producto suelto. Con valor = una talla/color concreto. El stock y
  -- el precio de una variante ya viven aparte del padre (migracion 005), asi
  -- que su precio de lista tambien.
  variante_id UUID REFERENCES public.variantes_producto(id) ON DELETE CASCADE,

  -- ⚠️ NULLABLE A PROPOSITO: es el "No definido" de la interfaz — el producto
  -- esta en la lista pero todavia sin precio propio, y se vende al precio
  -- normal. NO es lo mismo que 0, que es un producto de cortesia. El codigo usa
  -- `??` y no `||` justo por esto.
  precio DECIMAL(10,2),

  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- ⚠️ `NULLS NOT DISTINCT` NO ES DECORATIVO. Por defecto Postgres considera
  -- que dos NULL son distintos entre si, asi que una restriccion normal dejaria
  -- meter el MISMO producto sin variante dos veces en la misma lista, con dos
  -- precios, y ganaria el que la consulta devolviera primero.
  -- Requiere Postgres 15+; verificado contra produccion: 17.6.
  UNIQUE NULLS NOT DISTINCT (lista_id, producto_id, variante_id)
);

-- La consulta de la pantalla y la de la fase 2 son ambas "dame los precios de
-- esta lista"; la clave unica ya sirve de indice para eso. Este otro es para el
-- camino inverso: "en que listas esta este producto".
CREATE INDEX IF NOT EXISTS idx_precios_lista_producto
  ON public.precios_lista (producto_id);

-- =============================================
-- 3. RLS
-- ---------------------------------------------
-- LECTURA ABIERTA A TODO MIEMBRO, ESCRITURA SOLO CON `inventory.manage`.
--
-- La asimetria es deliberada: definir un precio de mayoreo es una decision de
-- gestion (el mismo permiso que ya exige cambiar `productos.precio_venta`), pero
-- en la fase 2 el CAJERO tiene que poder LEER las listas para elegir una al
-- vender, igual que hoy lee el catalogo.
--
-- `(select auth.uid())` y `user_tenant_ids()` envueltos en subconsulta: lo exige
-- la optimizacion de la migracion 059 (se evaluan una vez por consulta, no por
-- fila).
-- =============================================

ALTER TABLE public.listas_precios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "listas_precios_select" ON public.listas_precios
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "listas_precios_insert" ON public.listas_precios
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('inventory.manage'));

CREATE POLICY "listas_precios_update" ON public.listas_precios
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('inventory.manage'))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('inventory.manage'));

CREATE POLICY "listas_precios_delete" ON public.listas_precios
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('inventory.manage'));

ALTER TABLE public.precios_lista ENABLE ROW LEVEL SECURITY;

-- El detalle no tiene `tenant_id` propio: se acota a traves de su lista, igual
-- que `detalle_orden_compra` se acota por su orden (migracion 054). Duplicar el
-- tenant aqui abriria la puerta a que una fila apuntara a una lista de otro
-- negocio.
CREATE POLICY "precios_lista_select" ON public.precios_lista
  FOR SELECT TO authenticated
  USING (lista_id IN (
    SELECT l.id FROM public.listas_precios l
    WHERE l.tenant_id IN (SELECT public.user_tenant_ids())));

CREATE POLICY "precios_lista_insert" ON public.precios_lista
  FOR INSERT TO authenticated
  WITH CHECK (lista_id IN (
    SELECT l.id FROM public.listas_precios l
    WHERE l.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

CREATE POLICY "precios_lista_update" ON public.precios_lista
  FOR UPDATE TO authenticated
  USING (lista_id IN (
    SELECT l.id FROM public.listas_precios l
    WHERE l.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'))
  WITH CHECK (lista_id IN (
    SELECT l.id FROM public.listas_precios l
    WHERE l.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

CREATE POLICY "precios_lista_delete" ON public.precios_lista
  FOR DELETE TO authenticated
  USING (lista_id IN (
    SELECT l.id FROM public.listas_precios l
    WHERE l.tenant_id IN (SELECT public.user_tenant_ids()))
    AND public.authorize('inventory.manage'));

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- Las dos tablas con RLS y sus cuatro politicas cada una:
--   SELECT tablename, policyname, cmd FROM pg_policies
--    WHERE tablename IN ('listas_precios','precios_lista') ORDER BY 1, 3;
--
--   -- `precio` debe admitir NULL (es el "No definido"):
--   SELECT column_name, is_nullable FROM information_schema.columns
--    WHERE table_name = 'precios_lista';
--
--   -- La restriccion unica ignora la distincion de NULL:
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid = 'public.precios_lista'::regclass AND contype = 'u';
--   -- Debe salir "UNIQUE NULLS NOT DISTINCT (lista_id, producto_id, variante_id)"
--
--   -- Y meter dos veces el mismo producto sin variante debe FALLAR.
-- =============================================
