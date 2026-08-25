-- 030: Refinamiento de políticas RBAC facturación (post-029)
--
-- Reemplaza las políticas FOR ALL de facturación por INSERT/UPDATE/DELETE
-- separadas: elimina el warning multiple_permissive_policies para SELECT
-- (la política ALL cubría SELECT también, generando dos rutas permissivas).
-- user_roles: une select_admin + select_own en una sola política.

-- facturas
DROP POLICY IF EXISTS "facturas_manage" ON public.facturas;
CREATE POLICY "facturas_insert" ON public.facturas
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));
CREATE POLICY "facturas_update" ON public.facturas
  FOR UPDATE TO authenticated
  USING (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'))
  WITH CHECK (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));
CREATE POLICY "facturas_delete" ON public.facturas
  FOR DELETE TO authenticated
  USING (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));

-- factura_detalle
DROP POLICY IF EXISTS "factura_detalle_manage" ON public.factura_detalle;
CREATE POLICY "factura_detalle_insert" ON public.factura_detalle
  FOR INSERT TO authenticated
  WITH CHECK (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));
CREATE POLICY "factura_detalle_update" ON public.factura_detalle
  FOR UPDATE TO authenticated
  USING (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'))
  WITH CHECK (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));
CREATE POLICY "factura_detalle_delete" ON public.factura_detalle
  FOR DELETE TO authenticated
  USING (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));

-- facturas_cancelaciones
DROP POLICY IF EXISTS "facturas_cancelaciones_manage" ON public.facturas_cancelaciones;
CREATE POLICY "facturas_cancelaciones_insert" ON public.facturas_cancelaciones
  FOR INSERT TO authenticated
  WITH CHECK (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));
CREATE POLICY "facturas_cancelaciones_update" ON public.facturas_cancelaciones
  FOR UPDATE TO authenticated
  USING (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'))
  WITH CHECK (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));
CREATE POLICY "facturas_cancelaciones_delete" ON public.facturas_cancelaciones
  FOR DELETE TO authenticated
  USING (factura_id IN (SELECT f.id FROM public.facturas f WHERE f.tenant_id IN (select user_tenant_ids())) AND authorize('billing.create'));

-- facturas_folios
DROP POLICY IF EXISTS "facturas_folios_manage" ON public.facturas_folios;
CREATE POLICY "facturas_folios_insert" ON public.facturas_folios
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));
CREATE POLICY "facturas_folios_update" ON public.facturas_folios
  FOR UPDATE TO authenticated
  USING (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'))
  WITH CHECK (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));
CREATE POLICY "facturas_folios_delete" ON public.facturas_folios
  FOR DELETE TO authenticated
  USING (tenant_id IN (select user_tenant_ids()) AND authorize('billing.create'));

-- user_roles: unificar SELECT
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR authorize('org.manage_members'));

-- Índice para la FK añadida en 028
CREATE INDEX IF NOT EXISTS idx_productos_proveedor ON public.productos(proveedor_id);
