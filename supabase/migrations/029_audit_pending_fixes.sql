-- 029: Pendientes de auditoría BD (post-028)
--
-- 1. Deprecar `trial_codes` (0 filas, sin UI — reemplazado por
--    `codigos_promocionales`, migración 027). Se eliminan también sus APIs.
-- 2. `tenants_insert` con `with_check=true` → eliminada (los tenants se
--    crean solo vía `complete_onboarding` SECURITY DEFINER).
-- 3. `activity_logs_insert` no validaba `user_id` (spoofing de auditoría)
--    → ahora exige `user_id = auth.uid()`.
-- 4. RBAC en facturación: escrituras exigen `authorize('billing.create')`
--    (CAJERO solo tiene billing.view → lectura). pagos_terminal pasa a
--    solo-lectura para authenticated (escrituras vía APIs service_role).
-- 5. `auth_rls_initplan`: políticas reescritas con `(select ...)` para
--    evaluar una vez por query, no por fila. `referidos` TO PUBLIC →
--    roles explícitos (corrige multiple_permissive_policies).
-- 6. Índices para FKs sin cobertura (performance advisor).

-- ============================================================
-- 1. Deprecar trial_codes
-- ============================================================

DROP TABLE IF EXISTS public.trial_codes;

-- ============================================================
-- 2. tenants_insert: cerrar creación arbitraria de tenants
-- ============================================================

DROP POLICY IF EXISTS "tenants_insert" ON public.tenants;

-- ============================================================
-- 3. activity_logs: integridad de auditoría
-- ============================================================

DROP POLICY IF EXISTS "activity_logs_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND tenant_id IN (select user_tenant_ids())
  );

-- ============================================================
-- 4. RBAC facturación + pagos_terminal
-- ============================================================

-- facturas
DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas;
CREATE POLICY "facturas_select" ON public.facturas
  FOR SELECT TO authenticated
  USING (tenant_id IN (select user_tenant_ids()));
CREATE POLICY "facturas_manage" ON public.facturas
  FOR ALL TO authenticated
  USING (
    tenant_id IN (select user_tenant_ids())
    AND authorize('billing.create')
  )
  WITH CHECK (
    tenant_id IN (select user_tenant_ids())
    AND authorize('billing.create')
  );

-- factura_detalle
DROP POLICY IF EXISTS "tenant_isolation" ON public.factura_detalle;
CREATE POLICY "factura_detalle_select" ON public.factura_detalle
  FOR SELECT TO authenticated
  USING (factura_id IN (
    SELECT f.id FROM public.facturas f
    WHERE f.tenant_id IN (select user_tenant_ids())
  ));
CREATE POLICY "factura_detalle_manage" ON public.factura_detalle
  FOR ALL TO authenticated
  USING (
    factura_id IN (
      SELECT f.id FROM public.facturas f
      WHERE f.tenant_id IN (select user_tenant_ids())
    )
    AND authorize('billing.create')
  )
  WITH CHECK (
    factura_id IN (
      SELECT f.id FROM public.facturas f
      WHERE f.tenant_id IN (select user_tenant_ids())
    )
    AND authorize('billing.create')
  );

-- facturas_cancelaciones
DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas_cancelaciones;
CREATE POLICY "facturas_cancelaciones_select" ON public.facturas_cancelaciones
  FOR SELECT TO authenticated
  USING (factura_id IN (
    SELECT f.id FROM public.facturas f
    WHERE f.tenant_id IN (select user_tenant_ids())
  ));
CREATE POLICY "facturas_cancelaciones_manage" ON public.facturas_cancelaciones
  FOR ALL TO authenticated
  USING (
    factura_id IN (
      SELECT f.id FROM public.facturas f
      WHERE f.tenant_id IN (select user_tenant_ids())
    )
    AND authorize('billing.create')
  )
  WITH CHECK (
    factura_id IN (
      SELECT f.id FROM public.facturas f
      WHERE f.tenant_id IN (select user_tenant_ids())
    )
    AND authorize('billing.create')
  );

-- facturas_folios
DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas_folios;
CREATE POLICY "facturas_folios_select" ON public.facturas_folios
  FOR SELECT TO authenticated
  USING (tenant_id IN (select user_tenant_ids()));
CREATE POLICY "facturas_folios_manage" ON public.facturas_folios
  FOR ALL TO authenticated
  USING (
    tenant_id IN (select user_tenant_ids())
    AND authorize('billing.create')
  )
  WITH CHECK (
    tenant_id IN (select user_tenant_ids())
    AND authorize('billing.create')
  );

-- pagos_terminal: solo lectura para authenticated (escrituras vía service_role)
DROP POLICY IF EXISTS "pagos_terminal_tenant_isolation" ON public.pagos_terminal;
CREATE POLICY "pagos_terminal_select" ON public.pagos_terminal
  FOR SELECT TO authenticated
  USING (tenant_id IN (select user_tenant_ids()));

-- ============================================================
-- 5. auth_rls_initplan + roles explícitos
-- ============================================================

-- subscriptions
DROP POLICY IF EXISTS "Users can view own tenant subscription" ON public.subscriptions;
CREATE POLICY "Users can view own tenant subscription" ON public.subscriptions
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT tm.tenant_id FROM public.tenant_memberships tm
      WHERE tm.user_id = (select auth.uid())
    )
  );

-- payment_history
DROP POLICY IF EXISTS "Users can view own tenant payments" ON public.payment_history;
CREATE POLICY "Users can view own tenant payments" ON public.payment_history
  FOR SELECT TO authenticated
  USING (
    subscription_id IN (
      SELECT s.id FROM public.subscriptions s
      JOIN public.tenant_memberships tm ON s.tenant_id = tm.tenant_id
      WHERE tm.user_id = (select auth.uid())
    )
  );

-- user_roles
DROP POLICY IF EXISTS "user_roles_select_own" ON public.user_roles;
CREATE POLICY "user_roles_select_own" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

-- referidos: roles explícitos + SELECT unificado
DROP POLICY IF EXISTS "referido_ve_su_referido" ON public.referidos;
DROP POLICY IF EXISTS "referidor_ve_sus_referidos" ON public.referidos;
DROP POLICY IF EXISTS "service_role_gestiona_referidos" ON public.referidos;
CREATE POLICY "referidos_select" ON public.referidos
  FOR SELECT TO authenticated
  USING (
    tenant_referido_id IN (select user_tenant_ids())
    OR tenant_referidor_id IN (select user_tenant_ids())
  );
CREATE POLICY "referidos_service_all" ON public.referidos
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- 6. Índices para FKs sin cobertura
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_variante ON public.ajustes_inventario(variante_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_lote ON public.ajustes_inventario(lote_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_usuario ON public.ajustes_inventario(usuario_id);
CREATE INDEX IF NOT EXISTS idx_codigos_promo_usado_por ON public.codigos_promocionales(usado_por_tenant_id);
CREATE INDEX IF NOT EXISTS idx_compras_usuario ON public.compras(usuario_id);
CREATE INDEX IF NOT EXISTS idx_detalle_compras_producto ON public.detalle_compras(producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_orden_compra_producto ON public.detalle_orden_compra(producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_orden_compra_variante ON public.detalle_orden_compra(variante_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_usuario ON public.ordenes_compra(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_terminal_usuario ON public.pagos_terminal(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pagos_terminal_cliente ON public.pagos_terminal(cliente_id);
CREATE INDEX IF NOT EXISTS idx_pagos_terminal_venta ON public.pagos_terminal(venta_id);
CREATE INDEX IF NOT EXISTS idx_stock_variantes_lote ON public.stock_variantes(lote_id);
CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON public.ventas(cliente_id);
CREATE INDEX IF NOT EXISTS idx_ventas_factura ON public.ventas(factura_id);
