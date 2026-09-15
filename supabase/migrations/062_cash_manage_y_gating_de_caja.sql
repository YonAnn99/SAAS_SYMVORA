-- =============================================
-- 062: Permiso `cash.manage` + el middleware sabe si hay caja abierta
-- ---------------------------------------------
-- Se quiere obligar a abrir caja antes de poder vender: el Punto de Venta
-- queda cerrado hasta que el usuario tenga una caja ABIERTA.
--
-- EL PROBLEMA QUE HAY QUE RESOLVER PRIMERO: un CAJERO no podia abrir caja.
-- Las 6 politicas de escritura de `cajas` y `movimientos_caja` exigen
-- `finances.manage`, que CAJERO no tiene (solo tiene billing.view,
-- inventory.view, sales.create y sales.view_reports). Sin esto, la nueva regla
-- dejaria al cajero —el usuario principal del POS— bloqueado del punto de venta
-- para siempre. Y las cajas son POR USUARIO (`cajas.usuario_id`), asi que un
-- admin tampoco puede abrirle la suya.
--
-- Se crea un permiso ACOTADO en vez de conceder `finances.manage`: el cajero
-- debe poder operar SU caja, no ver el modulo de Finanzas entero ni tocar las
-- cajas de sus companeros.
-- =============================================

BEGIN;

-- =============================================
-- 1. El permiso
-- =============================================

INSERT INTO public.role_permissions (role, permission) VALUES
  ('CAJERO',      'cash.manage'),
  ('ORG_ADMIN',   'cash.manage'),
  ('SUPER_ADMIN', 'cash.manage')
ON CONFLICT (role, permission) DO NOTHING;

-- =============================================
-- 2. Politicas de `cajas`
-- ---------------------------------------------
-- Dos caminos: quien tiene `finances.manage` sigue como hasta ahora (cualquier
-- caja del negocio); quien solo tiene `cash.manage` queda limitado a la suya.
--
-- `(SELECT auth.uid())` va ENVUELTO a proposito. Sin el `SELECT`, Postgres lo
-- trata como volatil y lo reevalua UNA VEZ POR FILA — es el aviso
-- `auth_rls_initplan` que se corrigio en `sugerencias` en la migracion 059.
--
-- `cajas_select` NO se toca: ya es por tenant y el cajero necesita leer para
-- ver su caja activa desde el POS.
-- =============================================

DROP POLICY IF EXISTS "cajas_insert" ON public.cajas;
CREATE POLICY "cajas_insert" ON public.cajas
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (SELECT user_tenant_ids())
    AND (
      authorize('finances.manage')
      OR (authorize('cash.manage') AND usuario_id = (SELECT auth.uid()))
    )
  );

DROP POLICY IF EXISTS "cajas_update" ON public.cajas;
CREATE POLICY "cajas_update" ON public.cajas
  FOR UPDATE TO authenticated
  USING (
    tenant_id IN (SELECT user_tenant_ids())
    AND (
      authorize('finances.manage')
      OR (authorize('cash.manage') AND usuario_id = (SELECT auth.uid()))
    )
  )
  WITH CHECK (
    tenant_id IN (SELECT user_tenant_ids())
    AND (
      authorize('finances.manage')
      OR (authorize('cash.manage') AND usuario_id = (SELECT auth.uid()))
    )
  );

-- Borrar caja NO se abre a `cash.manage`: cerrar es un UPDATE de estado, y
-- eliminar el registro entero destruye el historico del corte. Sigue siendo
-- exclusivo de `finances.manage`.
DROP POLICY IF EXISTS "cajas_delete" ON public.cajas;
CREATE POLICY "cajas_delete" ON public.cajas
  FOR DELETE TO authenticated
  USING (
    tenant_id IN (SELECT user_tenant_ids())
    AND authorize('finances.manage')
  );

-- =============================================
-- 3. Politicas de `movimientos_caja`
-- ---------------------------------------------
-- La tabla no tiene `usuario_id`: la pertenencia se comprueba a traves de la
-- caja a la que cuelga el movimiento.
-- =============================================

DROP POLICY IF EXISTS "movimientos_caja_insert" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_insert" ON public.movimientos_caja
  FOR INSERT TO authenticated
  WITH CHECK (
    caja_id IN (
      SELECT c.id FROM public.cajas c
      WHERE c.tenant_id IN (SELECT user_tenant_ids())
        AND (
          authorize('finances.manage')
          OR (authorize('cash.manage') AND c.usuario_id = (SELECT auth.uid()))
        )
    )
  );

DROP POLICY IF EXISTS "movimientos_caja_update" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_update" ON public.movimientos_caja
  FOR UPDATE TO authenticated
  USING (
    caja_id IN (
      SELECT c.id FROM public.cajas c
      WHERE c.tenant_id IN (SELECT user_tenant_ids())
        AND (
          authorize('finances.manage')
          OR (authorize('cash.manage') AND c.usuario_id = (SELECT auth.uid()))
        )
    )
  )
  WITH CHECK (
    caja_id IN (
      SELECT c.id FROM public.cajas c
      WHERE c.tenant_id IN (SELECT user_tenant_ids())
        AND (
          authorize('finances.manage')
          OR (authorize('cash.manage') AND c.usuario_id = (SELECT auth.uid()))
        )
    )
  );

-- Borrar movimientos altera el corte a posteriori: solo `finances.manage`.
DROP POLICY IF EXISTS "movimientos_caja_delete" ON public.movimientos_caja;
CREATE POLICY "movimientos_caja_delete" ON public.movimientos_caja
  FOR DELETE TO authenticated
  USING (
    caja_id IN (
      SELECT c.id FROM public.cajas c
      WHERE c.tenant_id IN (SELECT user_tenant_ids())
        AND authorize('finances.manage')
    )
  );

-- =============================================
-- 4. El middleware necesita saber si hay caja abierta
-- ---------------------------------------------
-- Se añade `tiene_caja_abierta` a `get_middleware_context` (migracion 060) en
-- vez de hacer una consulta suelta: ese RPC corre en CADA navegacion
-- autenticada y acaba de pasar de 4 round trips a 1. Añadir una consulta aparte
-- desharia justo ese trabajo.
--
-- ⚠️ Cambia el TIPO DE RETORNO, asi que `CREATE OR REPLACE` no basta: hay que
-- DROP + CREATE. Es la trampa del bug #18 (quedarse con dos firmas) y del #23
-- (perder los GRANT al recrear). Ambas cosas se verifican al final.
-- =============================================

DROP FUNCTION IF EXISTS public.get_middleware_context(UUID);

CREATE FUNCTION public.get_middleware_context(p_user_id UUID)
RETURNS TABLE (
  tenant_id           UUID,
  rol                 public.app_role,
  subscription_status public.subscription_status,
  trial_end           TIMESTAMPTZ,
  permisos            TEXT[],
  tiene_caja_abierta  BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant_id UUID;
  v_rol       public.app_role;
BEGIN
  SELECT tm.tenant_id, tm.role
    INTO v_tenant_id, v_rol
    FROM public.tenant_memberships tm
   WHERE tm.user_id = p_user_id
   ORDER BY tm.creado_en DESC
   LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    v_tenant_id,
    v_rol,
    t.subscription_status,
    s.trial_end,
    COALESCE(
      ARRAY(
        SELECT p.permission
          FROM public.get_effective_permissions_for_user(v_tenant_id, p_user_id) p
      ),
      ARRAY[]::TEXT[]
    ),
    EXISTS (
      SELECT 1 FROM public.cajas c
       WHERE c.usuario_id = p_user_id
         AND c.tenant_id = v_tenant_id
         AND c.estado = 'ABIERTA'
    )
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
  WHERE t.id = v_tenant_id;
END;
$$;

-- Reponer los permisos: `DROP` los borra. Solo el middleware (service_role) la
-- llama; a `authenticated` le devolveria el contexto de cualquier usuario que
-- se le pasara por parametro.
REVOKE ALL ON FUNCTION public.get_middleware_context(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_middleware_context(UUID) TO service_role;

-- Consulta la usa el middleware en cada navegacion.
CREATE INDEX IF NOT EXISTS idx_cajas_usuario_abierta
  ON public.cajas (usuario_id, tenant_id)
  WHERE estado = 'ABIERTA';

COMMIT;

-- =============================================
-- VERIFICACION
--
--   -- Una SOLA firma y el GRANT en su sitio (bugs #18 y #23):
--   SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'get_middleware_context';   -- 1
--   SELECT has_function_privilege('service_role',
--     'public.get_middleware_context(uuid)', 'EXECUTE');                    -- true
--   SELECT has_function_privilege('authenticated',
--     'public.get_middleware_context(uuid)', 'EXECUTE');                    -- false
--
--   -- Un CAJERO abre SU caja pero no la de otro (ejecutar con ROLLBACK):
--   --   INSERT ... usuario_id = <el suyo>   -> pasa
--   --   INSERT ... usuario_id = <ajeno>     -> "violates row-level security"
--
--   -- El barrido de auditoria de la 054 debe dar el MISMO resultado de
--   -- siempre: solo service_role mas activity_logs y sugerencias.
-- =============================================
