-- =============================================
-- 077: dar de alta sucursales pasa a ser del SUPER_ADMIN
-- ---------------------------------------------
-- QUE CAMBIA: crear, renombrar y cerrar sucursales exige ahora
-- `org.manage_branches`, que de fabrica tiene SOLO el SUPER_ADMIN. Hasta hoy
-- bastaba con `org.manage_settings`, que tambien tiene el ORG_ADMIN.
--
-- "POR DEFECTO", NO "PARA SIEMPRE". El permiso es concedible por usuario con el
-- mecanismo de la migracion 055, asi que el dueño puede cederselo a un encargado
-- desde Usuarios -> Permisos sin tocar codigo. Por eso entra en el CHECK de
-- `user_permission_overrides` y no se queda fuera como `org.delete` o
-- `subscription.manage`.
--
-- ⚠️ EL `SELECT` NO SE TOCA, Y ES DELIBERADO. El CAJERO tiene que poder LEER las
-- sucursales para elegir una al abrir su caja, y el selector del panel necesita
-- sus nombres. Cerrar la lectura lo dejaria sin poder abrir caja — y sin caja el
-- punto de venta no le deja cobrar. Misma asimetria (lectura abierta, escritura
-- con permiso) que ya usan `listas_precios` y las tablas de inventario.
--
-- POR QUE NO BASTA CON OCULTAR LA TARJETA: sin este cambio, un ORG_ADMIN podria
-- seguir creando sucursales por PostgREST sin pasar por la interfaz. En este
-- repo la barrera cosmetica ya fallo cuatro veces (bugs #1, #27, #33, #34); las
-- dos capas se cambian juntas o no se cambia ninguna.
-- =============================================

BEGIN;

-- =============================================
-- 1. El permiso, solo para el dueño
-- ---------------------------------------------
-- No hay que tocar ninguna funcion: `authorize()` y
-- `get_effective_permissions()` leen las dos de esta tabla, asi que el permiso
-- llega solo a RLS y a la interfaz.
-- =============================================

INSERT INTO public.role_permissions (role, permission)
VALUES ('SUPER_ADMIN', 'org.manage_branches')
ON CONFLICT (role, permission) DO NOTHING;

-- =============================================
-- 2. Las politicas de escritura de `sucursales`
-- =============================================

DROP POLICY IF EXISTS "sucursales_insert" ON public.sucursales;
DROP POLICY IF EXISTS "sucursales_update" ON public.sucursales;
DROP POLICY IF EXISTS "sucursales_delete" ON public.sucursales;

CREATE POLICY "sucursales_insert" ON public.sucursales
  FOR INSERT TO authenticated
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('org.manage_branches'));

CREATE POLICY "sucursales_update" ON public.sucursales
  FOR UPDATE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('org.manage_branches'))
  WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids())
              AND public.authorize('org.manage_branches'));

CREATE POLICY "sucursales_delete" ON public.sucursales
  FOR DELETE TO authenticated
  USING (tenant_id IN (SELECT public.user_tenant_ids())
         AND public.authorize('org.manage_branches'));

-- =============================================
-- 3. Que el permiso se pueda ceder
-- ---------------------------------------------
-- Se reescribe entera la lista, como ya hizo la 070. Entran DOS permisos:
--
--   - `org.manage_branches`, el de esta migracion.
--
--   - `cash.manage`, QUE ARREGLA UN FALLO QUE YA ESTABA AQUI. El modulo
--     "Finanzas" figura como concedible en `src/lib/modules.ts`, pero este CHECK
--     lo rechazaba: se quedo fuera cuando la migracion 062 cambio ese modulo de
--     `finances.manage` a `cash.manage` sin actualizar la lista. Resultado: el
--     switch de Finanzas del dialogo de permisos fallaba al guardar. Nadie lo
--     noto porque no habia ningun test que comparase las dos listas — ahora si
--     lo hay, en `src/__tests__/modules.test.ts`.
-- =============================================

ALTER TABLE public.user_permission_overrides
  DROP CONSTRAINT IF EXISTS user_permission_overrides_permission_check;

ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT user_permission_overrides_permission_check
  CHECK (permission = ANY (ARRAY[
    'sales.create', 'sales.view_reports', 'sales.void', 'sales.view_all',
    'inventory.view', 'inventory.manage', 'purchases.manage',
    'cash.manage', 'finances.manage',
    'org.manage_settings', 'org.manage_branches',
    'billing.view', 'billing.create', 'billing.stamp', 'billing.cancel', 'billing.config'
  ]));

COMMIT;
