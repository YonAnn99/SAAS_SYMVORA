-- 088: permisos de fabrica del CAJERO, y permiso propio para la Bitacora.
--
-- Decision del dueño (2026-09-23): de fabrica el cajero opera —vende, consulta
-- productos y clientes, compra y recibe mercancia, y abre y cierra SU caja—
-- pero no ve las cifras del negocio ni la auditoria.
--
--   Queda: Punto de venta (sales.create), Finanzas = su caja (cash.manage),
--          Compras y ordenes de compra (purchases.manage, NUEVO),
--          productos y clientes (abiertos a todo miembro), inventory.view y
--          billing.view.
--   Sale:  Dashboard y Reportes (sales.view_reports) y Bitacora (activity.view,
--          que ya no tiene de fabrica).
--
-- Es solo lo de FABRICA: las excepciones por usuario de
-- `user_permission_overrides` no se tocan, asi que a un cajero al que el dueño
-- ya le concedio Reportes se le respeta.
--
-- BITACORA. Hasta ahora no pedia ningun permiso: la veia cualquiera en el menu
-- y la politica de lectura de `activity_logs` solo miraba el negocio. Esconder
-- el enlace sin cerrar la tabla no protegeria nada (se lee igual desde la API),
-- por eso el permiso entra tambien en la politica. Solo la lee la pagina
-- /activity; las escrituras (triggers y `logActivity`) no cambian.

BEGIN;

-- 1. Cajero: fuera Reportes/Dashboard, dentro Compras.
DELETE FROM public.role_permissions
WHERE role = 'CAJERO' AND permission = 'sales.view_reports';

INSERT INTO public.role_permissions (role, permission)
VALUES ('CAJERO', 'purchases.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- 2. Bitacora: permiso propio, de fabrica para los administradores.
INSERT INTO public.role_permissions (role, permission)
VALUES ('SUPER_ADMIN', 'activity.view'), ('ORG_ADMIN', 'activity.view')
ON CONFLICT (role, permission) DO NOTHING;

DROP POLICY IF EXISTS "activity_logs_select" ON public.activity_logs;
CREATE POLICY "activity_logs_select" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND (SELECT public.authorize('activity.view')));

-- 3. Concedible por usuario: se redefine el CHECK entero (como en 055, 070 y
--    077). `src/__tests__/modules.test.ts` lee el de la migracion mas alta.
ALTER TABLE public.user_permission_overrides
  DROP CONSTRAINT IF EXISTS user_permission_overrides_permission_check;

ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT user_permission_overrides_permission_check
  CHECK (permission = ANY (ARRAY[
    'sales.create', 'sales.view_reports', 'sales.void', 'sales.view_all',
    'inventory.view', 'inventory.manage', 'purchases.manage',
    'cash.manage', 'finances.manage',
    'org.manage_settings', 'org.manage_branches',
    'activity.view',
    'billing.view', 'billing.create', 'billing.stamp', 'billing.cancel', 'billing.config'
  ]));

COMMIT;
