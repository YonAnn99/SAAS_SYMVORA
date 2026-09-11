-- =============================================
-- 053: RBAC real en inventario (tablas + RPCs)
-- ---------------------------------------------
-- Se descubrio al mover Variantes/Lotes/Ajustes de /settings a /products:
-- /products es accesible para CAJERO mientras que las rutas de inventario
-- eran ORG_ADMIN+. Al comprobar si la BD respaldaba esos permisos, resulto
-- que NO, en tres capas:
--
-- 1) Las 4 tablas de inventario (variantes_producto, lotes,
--    ajustes_inventario, stock_variantes) tenian una sola politica FOR ALL
--    con solo aislamiento por tenant, SIN authorize(). Es la forma exacta del
--    bug #1, que la migracion 002 corrigio en productos/ventas pero que nunca
--    se aplico a estas tablas, anadidas en la 005. Un CAJERO podia crear,
--    editar y borrar por PostgREST sin tocar la interfaz.
--
-- 2) ajustar_inventario es SECURITY DEFINER (SALTA RLS) y no validaba ningun
--    permiso. Arreglar solo las tablas habria dejado esta puerta abierta.
--
-- 3) recibir_orden_compra, igual, y peor: SUMA STOCK sin comprobar nada.
--
-- Ademas las dos funciones resolvian el tenant con (auth.jwt() ->> 'tenant_id'),
-- que es el claim de la membresia MAS RECIENTE (custom_access_token_hook usa
-- ORDER BY creado_en DESC LIMIT 1): para un usuario con dos negocios podia ser
-- el equivocado. Ahora el tenant se deriva del propio registro y la membresia
-- se valida contra tenant_memberships.
--
-- NOTA: aplicada a produccion en tres pasos (053a/053b/053c) para verificar
-- entre cada uno; en supabase_migrations figura con esos nombres. Ninguna de
-- las dos funciones cambia de firma, asi que van con CREATE OR REPLACE y no
-- aplican las trampas de los bugs #18 (overload huerfano) ni #23 (grants
-- perdidos) — verificado igualmente tras aplicar.
--
-- Los permisos exigidos (inventory.manage, purchases.manage) YA existian y
-- estan concedidos solo a SUPER_ADMIN y ORG_ADMIN. No se crea ninguno nuevo:
-- este cambio no amplia ni recorta lo que cada rol deberia poder hacer, solo
-- hace que la base de datos lo respalde.
--
-- La LECTURA se deja por tenant a proposito: el CAJERO debe poder consultar
-- lotes y variantes (el POS los necesita); lo que no debe es modificarlos.
-- =============================================
-- (el cuerpo aplicado esta en 053a/053b/053c; ver nota arriba)

BEGIN;

-- =============================================
-- 1. Politicas RLS: patron de productos/ventas
--    SELECT por tenant; INSERT/UPDATE/DELETE con authorize()
-- =============================================

DROP POLICY IF EXISTS "variantes_producto_isolation" ON public.variantes_producto;
CREATE POLICY "variantes_producto_select" ON public.variantes_producto
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()));
CREATE POLICY "variantes_producto_insert" ON public.variantes_producto
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "variantes_producto_update" ON public.variantes_producto
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "variantes_producto_delete" ON public.variantes_producto
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));

DROP POLICY IF EXISTS "lotes_isolation" ON public.lotes;
CREATE POLICY "lotes_select" ON public.lotes
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()));
CREATE POLICY "lotes_insert" ON public.lotes
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "lotes_update" ON public.lotes
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "lotes_delete" ON public.lotes
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));

DROP POLICY IF EXISTS "ajustes_inventario_isolation" ON public.ajustes_inventario;
CREATE POLICY "ajustes_inventario_select" ON public.ajustes_inventario
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()));
CREATE POLICY "ajustes_inventario_insert" ON public.ajustes_inventario
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "ajustes_inventario_update" ON public.ajustes_inventario
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'))
  WITH CHECK (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));
CREATE POLICY "ajustes_inventario_delete" ON public.ajustes_inventario
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT user_tenant_ids()) AND authorize('inventory.manage'));

-- stock_variantes se acota a traves de variantes_producto (no tiene tenant_id)
DROP POLICY IF EXISTS "stock_variantes_isolation" ON public.stock_variantes;
CREATE POLICY "stock_variantes_select" ON public.stock_variantes
  FOR SELECT TO authenticated
  USING (variante_id IN (
    SELECT vp.id FROM public.variantes_producto vp
    WHERE vp.tenant_id IN (SELECT user_tenant_ids())));
CREATE POLICY "stock_variantes_insert" ON public.stock_variantes
  FOR INSERT TO authenticated
  WITH CHECK (variante_id IN (
    SELECT vp.id FROM public.variantes_producto vp
    WHERE vp.tenant_id IN (SELECT user_tenant_ids())) AND authorize('inventory.manage'));
CREATE POLICY "stock_variantes_update" ON public.stock_variantes
  FOR UPDATE TO authenticated
  USING (variante_id IN (
    SELECT vp.id FROM public.variantes_producto vp
    WHERE vp.tenant_id IN (SELECT user_tenant_ids())) AND authorize('inventory.manage'))
  WITH CHECK (variante_id IN (
    SELECT vp.id FROM public.variantes_producto vp
    WHERE vp.tenant_id IN (SELECT user_tenant_ids())) AND authorize('inventory.manage'));
CREATE POLICY "stock_variantes_delete" ON public.stock_variantes
  FOR DELETE TO authenticated
  USING (variante_id IN (
    SELECT vp.id FROM public.variantes_producto vp
    WHERE vp.tenant_id IN (SELECT user_tenant_ids())) AND authorize('inventory.manage'));

COMMIT;

-- =============================================
-- 2 y 3. Los cuerpos completos de ajustar_inventario() y
--    recibir_orden_compra() se aplicaron en 053b y 053c. Ambos siguen el
--    mismo patron que complete_sale: derivan el tenant del registro, validan
--    la membresia contra tenant_memberships y exigen el permiso contra
--    role_permissions (nunca desde el JWT). Para consultar la version viva:
--       SELECT pg_get_functiondef(oid) FROM pg_proc
--        WHERE proname IN ('ajustar_inventario','recibir_orden_compra');
-- =============================================
