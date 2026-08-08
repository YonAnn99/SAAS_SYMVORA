-- SYMVORA SaaS - RBAC Migration
-- Replaces insecure FOR ALL policies with granular per-operation RLS
-- that enforce role-based access control via authorize()
--
-- EXECUTION: Run this in Supabase SQL Editor (Without RLS option)
-- This migration is safe to run on existing data - it only changes policies.

-- =============================================
-- DROP ALL EXISTING INSECURE POLICIES
-- =============================================

DROP POLICY IF EXISTS "tenant_isolation" ON public.tenants;
DROP POLICY IF EXISTS "tenant_settings_isolation" ON public.tenant_settings;
DROP POLICY IF EXISTS "tenant_memberships_isolation" ON public.tenant_memberships;
DROP POLICY IF EXISTS "productos_isolation" ON public.productos;
DROP POLICY IF EXISTS "clientes_isolation" ON public.clientes;
DROP POLICY IF EXISTS "proveedores_isolation" ON public.proveedores;
DROP POLICY IF EXISTS "ventas_isolation" ON public.ventas;
DROP POLICY IF EXISTS "detalle_ventas_isolation" ON public.detalle_ventas;
DROP POLICY IF EXISTS "compras_isolation" ON public.compras;
DROP POLICY IF EXISTS "detalle_compras_isolation" ON public.detalle_compras;
DROP POLICY IF EXISTS "cajas_isolation" ON public.cajas;
DROP POLICY IF EXISTS "movimientos_caja_isolation" ON public.movimientos_caja;
DROP POLICY IF EXISTS "user_roles_own" ON public.user_roles;

-- =============================================
-- TENANTS
-- =============================================

CREATE POLICY "tenants_select" ON public.tenants
FOR SELECT TO authenticated
USING (id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "tenants_insert" ON public.tenants
FOR INSERT TO authenticated
WITH CHECK (public.authorize('org.delete'));

CREATE POLICY "tenants_update" ON public.tenants
FOR UPDATE TO authenticated
USING (id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'))
WITH CHECK (id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'));

CREATE POLICY "tenants_delete" ON public.tenants
FOR DELETE TO authenticated
USING (public.authorize('org.delete'));

-- =============================================
-- TENANT SETTINGS
-- =============================================

CREATE POLICY "tenant_settings_select" ON public.tenant_settings
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "tenant_settings_insert" ON public.tenant_settings
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'));

CREATE POLICY "tenant_settings_update" ON public.tenant_settings
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'));

CREATE POLICY "tenant_settings_delete" ON public.tenant_settings
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_settings'));

-- =============================================
-- TENANT MEMBERSHIPS
-- =============================================

CREATE POLICY "tenant_memberships_select" ON public.tenant_memberships
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "tenant_memberships_insert" ON public.tenant_memberships
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_members'));

CREATE POLICY "tenant_memberships_update" ON public.tenant_memberships
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_members'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_members'));

CREATE POLICY "tenant_memberships_delete" ON public.tenant_memberships
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('org.manage_members'));

-- =============================================
-- USER ROLES - SUPER_ADMIN only for writes
-- =============================================

CREATE POLICY "user_roles_select_own" ON public.user_roles
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "user_roles_select_admin" ON public.user_roles
FOR SELECT TO authenticated
USING (public.authorize('org.manage_members'));

CREATE POLICY "user_roles_insert" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (public.authorize('org.delete'));

CREATE POLICY "user_roles_update" ON public.user_roles
FOR UPDATE TO authenticated
USING (public.authorize('org.delete'))
WITH CHECK (public.authorize('org.delete'));

CREATE POLICY "user_roles_delete" ON public.user_roles
FOR DELETE TO authenticated
USING (public.authorize('org.delete'));

-- =============================================
-- PRODUCTOS - inventory.manage
-- =============================================

CREATE POLICY "productos_select" ON public.productos
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "productos_insert" ON public.productos
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "productos_update" ON public.productos
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "productos_delete" ON public.productos
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

-- =============================================
-- CLIENTES - inventory.manage
-- =============================================

CREATE POLICY "clientes_select" ON public.clientes
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "clientes_insert" ON public.clientes
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "clientes_update" ON public.clientes
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "clientes_delete" ON public.clientes
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

-- =============================================
-- PROVEEDORES - inventory.manage
-- =============================================

CREATE POLICY "proveedores_select" ON public.proveedores
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "proveedores_insert" ON public.proveedores
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "proveedores_update" ON public.proveedores
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

CREATE POLICY "proveedores_delete" ON public.proveedores
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('inventory.manage'));

-- =============================================
-- VENTAS - sales.create / sales.void
-- =============================================

CREATE POLICY "ventas_select" ON public.ventas
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "ventas_insert" ON public.ventas
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create'));

CREATE POLICY "ventas_update" ON public.ventas
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.void'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.void'));

CREATE POLICY "ventas_delete" ON public.ventas
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.void'));

-- =============================================
-- DETALLE VENTAS - via parent venta
-- =============================================

CREATE POLICY "detalle_ventas_select" ON public.detalle_ventas
FOR SELECT TO authenticated
USING (venta_id IN (SELECT id FROM public.ventas WHERE tenant_id IN (SELECT public.user_tenant_ids())));

CREATE POLICY "detalle_ventas_insert" ON public.detalle_ventas
FOR INSERT TO authenticated
WITH CHECK (venta_id IN (SELECT id FROM public.ventas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create')));

CREATE POLICY "detalle_ventas_update" ON public.detalle_ventas
FOR UPDATE TO authenticated
USING (venta_id IN (SELECT id FROM public.ventas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create')))
WITH CHECK (venta_id IN (SELECT id FROM public.ventas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create')));

CREATE POLICY "detalle_ventas_delete" ON public.detalle_ventas
FOR DELETE TO authenticated
USING (venta_id IN (SELECT id FROM public.ventas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create')));

-- =============================================
-- COMPRAS - purchases.manage
-- =============================================

CREATE POLICY "compras_select" ON public.compras
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "compras_insert" ON public.compras
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage'));

CREATE POLICY "compras_update" ON public.compras
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage'));

CREATE POLICY "compras_delete" ON public.compras
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage'));

-- =============================================
-- DETALLE COMPRAS - via parent compra
-- =============================================

CREATE POLICY "detalle_compras_select" ON public.detalle_compras
FOR SELECT TO authenticated
USING (compra_id IN (SELECT id FROM public.compras WHERE tenant_id IN (SELECT public.user_tenant_ids())));

CREATE POLICY "detalle_compras_insert" ON public.detalle_compras
FOR INSERT TO authenticated
WITH CHECK (compra_id IN (SELECT id FROM public.compras WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage')));

CREATE POLICY "detalle_compras_update" ON public.detalle_compras
FOR UPDATE TO authenticated
USING (compra_id IN (SELECT id FROM public.compras WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage')))
WITH CHECK (compra_id IN (SELECT id FROM public.compras WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage')));

CREATE POLICY "detalle_compras_delete" ON public.detalle_compras
FOR DELETE TO authenticated
USING (compra_id IN (SELECT id FROM public.compras WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('purchases.manage')));

-- =============================================
-- CAJAS - finances.manage
-- =============================================

CREATE POLICY "cajas_select" ON public.cajas
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "cajas_insert" ON public.cajas
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage'));

CREATE POLICY "cajas_update" ON public.cajas
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage'));

CREATE POLICY "cajas_delete" ON public.cajas
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage'));

-- =============================================
-- MOVIMIENTOS CAJA - via parent caja
-- =============================================

CREATE POLICY "movimientos_caja_select" ON public.movimientos_caja
FOR SELECT TO authenticated
USING (caja_id IN (SELECT id FROM public.cajas WHERE tenant_id IN (SELECT public.user_tenant_ids())));

CREATE POLICY "movimientos_caja_insert" ON public.movimientos_caja
FOR INSERT TO authenticated
WITH CHECK (caja_id IN (SELECT id FROM public.cajas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage')));

CREATE POLICY "movimientos_caja_update" ON public.movimientos_caja
FOR UPDATE TO authenticated
USING (caja_id IN (SELECT id FROM public.cajas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage')))
WITH CHECK (caja_id IN (SELECT id FROM public.cajas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage')));

CREATE POLICY "movimientos_caja_delete" ON public.movimientos_caja
FOR DELETE TO authenticated
USING (caja_id IN (SELECT id FROM public.cajas WHERE tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('finances.manage')));
