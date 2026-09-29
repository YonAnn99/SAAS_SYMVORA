-- =============================================
-- 096: Acceso segun el estado de pago — gracia y SOLO LECTURA
--
-- Antes:
--   * Tarjeta rechazada (past_due) -> bloqueo total AL INSTANTE, sin aviso.
--   * Pago en efectivo/OXXO -> nadie vencia la cuenta al pasar
--     `current_period_end`: seguia `active` para siempre.
--   * Cuenta cancelada -> nunca se bloqueaba.
--
-- Ahora hay tres niveles de acceso, calculados EN VIVO desde las fechas (no
-- dependen de ningun cron; pagar reactiva al instante porque el webhook pone
-- `active` y un `current_period_end` nuevo):
--
--   completo      trial vigente; active dentro de su periodo (o sin fecha);
--                 canceled antes de `current_period_end` (ya lo pago)
--   gracia        3 dias tras fallar el cobro o vencer el periodo: TODO
--                 funciona, con aviso para pagar
--   solo_lectura  despues: entra, ve y exporta; no vende, no compra, no abre
--                 caja, no edita
--
-- Como se aplica SOLO LECTURA:
--   1. Permisos: `get_effective_permissions(_for_user)` devuelven solo los de
--      lectura. Eso esconde botones (hook usePermissions), bloquea rutas
--      (middleware) y frena los RPC que preguntan con `_puede()`.
--   2. Triggers en las tablas del negocio: los RPC de venta/compra/inventario
--      son SECURITY DEFINER (se saltan la RLS) y varios leen `role_permissions`
--      directo, asi que el unico punto que los atrapa a TODOS es la escritura
--      en la tabla. El trigger solo actua con un usuario final (auth.uid()):
--      el cron de cierre de caja y los webhooks (service_role) siguen operando.
--
-- `authorize()` NO se toca: lo usan ~75 politicas y no hace falta.
-- =============================================

BEGIN;

-- ---------------------------------------------
-- Columnas
-- ---------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS past_due_desde        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oferta_regreso_hasta  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_renovacion_en   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_gracia_en       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_solo_lectura_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_regreso_en      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_ultimo_en       TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.past_due_desde IS
  'Primer cobro fallido del ciclo actual. Desde aqui corren los 3 dias de gracia. Se limpia al pagar.';
COMMENT ON COLUMN public.subscriptions.oferta_regreso_hasta IS
  'Vigencia de la oferta de regreso (primer mes al precio promocional). La pone el cron al mandar el correo del dia 7; se limpia al pagar.';

-- Las que ya estan en past_due arrancan su gracia desde su ultima actualizacion.
UPDATE public.subscriptions
   SET past_due_desde = updated_at
 WHERE status = 'past_due' AND past_due_desde IS NULL;

-- ---------------------------------------------
-- La regla. Espejo en TypeScript: src/lib/acceso-suscripcion.ts
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.acceso_tenant(p_tenant_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE
    WHEN t.subscription_status IS NULL THEN 'completo'
    WHEN t.subscription_status = 'trial' THEN
      CASE WHEN s.trial_end IS NULL OR s.trial_end >= now()
           THEN 'completo' ELSE 'solo_lectura' END
    WHEN t.subscription_status = 'active' THEN
      CASE WHEN s.current_period_end IS NULL OR s.current_period_end >= now()
             THEN 'completo'
           WHEN s.current_period_end + INTERVAL '3 days' >= now()
             THEN 'gracia'
           ELSE 'solo_lectura' END
    WHEN t.subscription_status = 'past_due' THEN
      CASE WHEN COALESCE(s.past_due_desde, s.updated_at, now()) + INTERVAL '3 days' >= now()
           THEN 'gracia' ELSE 'solo_lectura' END
    WHEN t.subscription_status = 'canceled' THEN
      CASE WHEN s.current_period_end IS NOT NULL AND s.current_period_end >= now()
           THEN 'completo' ELSE 'solo_lectura' END
    ELSE 'solo_lectura'  -- expired
  END
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
  WHERE t.id = p_tenant_id
$$;

-- Solo service_role: con un UUID ajeno, `authenticated` sabria el estado de
-- pago de otro negocio. El panel usa `mi_acceso_cuenta()`.
REVOKE ALL ON FUNCTION public.acceso_tenant(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acceso_tenant(UUID) TO service_role;

-- El acceso del negocio de quien llama (por su membresia, no por parametro).
CREATE OR REPLACE FUNCTION public.mi_acceso_cuenta()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT public.acceso_tenant(tm.tenant_id)
    FROM public.tenant_memberships tm
   WHERE tm.user_id = auth.uid()
   ORDER BY tm.creado_en DESC
   LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.mi_acceso_cuenta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_acceso_cuenta() TO authenticated, service_role;

-- Lo que conserva una cuenta en solo lectura: ver, reportes y PAGAR.
CREATE OR REPLACE FUNCTION public.permisos_solo_lectura()
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT ARRAY[
    'inventory.view',
    'sales.view_all',
    'sales.view_reports',
    'activity.view',
    'billing.view',
    'subscription.manage'
  ]::TEXT[]
$$;

-- ---------------------------------------------
-- Permisos efectivos filtrados. Mismo cuerpo que antes (membresia real,
-- rol - quitados + concedidos) envuelto en el filtro de solo lectura.
-- CREATE OR REPLACE con la misma firma conserva los GRANT.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public.get_effective_permissions(p_tenant_id UUID)
RETURNS TABLE(permission TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_caller UUID;
  v_role public.app_role;
  v_solo_lectura BOOLEAN;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RETURN;
  END IF;

  -- Membresia real, no el claim del JWT.
  SELECT tm.role INTO v_role
  FROM public.tenant_memberships tm
  WHERE tm.user_id = v_caller AND tm.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  v_solo_lectura := public.acceso_tenant(p_tenant_id) = 'solo_lectura';

  -- Permisos del rol MENOS los quitados, MAS los concedidos.
  RETURN QUERY
    SELECT e.permission FROM (
        SELECT rp.permission
        FROM public.role_permissions rp
        WHERE rp.role = v_role
          AND NOT EXISTS (
            SELECT 1 FROM public.user_permission_overrides o
            WHERE o.user_id = v_caller
              AND o.tenant_id = p_tenant_id
              AND o.permission = rp.permission
              AND o.granted = FALSE
          )
      UNION
        SELECT o.permission
        FROM public.user_permission_overrides o
        WHERE o.user_id = v_caller
          AND o.tenant_id = p_tenant_id
          AND o.granted = TRUE
    ) e
    WHERE NOT v_solo_lectura
       OR e.permission = ANY (public.permisos_solo_lectura());
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_effective_permissions_for_user(p_tenant_id UUID, p_user_id UUID)
RETURNS TABLE(permission TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
  v_solo_lectura BOOLEAN;
BEGIN
  SELECT tm.role INTO v_role
  FROM public.tenant_memberships tm
  WHERE tm.user_id = p_user_id AND tm.tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RETURN;
  END IF;

  v_solo_lectura := public.acceso_tenant(p_tenant_id) = 'solo_lectura';

  RETURN QUERY
    SELECT e.permission FROM (
        SELECT rp.permission
        FROM public.role_permissions rp
        WHERE rp.role = v_role
          AND NOT EXISTS (
            SELECT 1 FROM public.user_permission_overrides o
            WHERE o.user_id = p_user_id
              AND o.tenant_id = p_tenant_id
              AND o.permission = rp.permission
              AND o.granted = FALSE
          )
      UNION
        SELECT o.permission
        FROM public.user_permission_overrides o
        WHERE o.user_id = p_user_id
          AND o.tenant_id = p_tenant_id
          AND o.granted = TRUE
    ) e
    WHERE NOT v_solo_lectura
       OR e.permission = ANY (public.permisos_solo_lectura());
END;
$function$;

-- ---------------------------------------------
-- Triggers: la red de seguridad para TODA escritura de un usuario final.
-- ---------------------------------------------
CREATE OR REPLACE FUNCTION public._bloquear_si_solo_lectura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant UUID;
BEGIN
  -- Sin usuario final (cron, webhooks con service_role, SQL directo): pasa.
  -- Tampoco actua anidado (pg_trigger_depth() > 1): las cascadas de FK y los
  -- triggers de stock corren ahi, y bloquearlos romperia p. ej. eliminar la
  -- organizacion. La escritura que origina todo (depth 1) ya se reviso.
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    v_tenant := OLD.tenant_id;
  ELSE
    v_tenant := NEW.tenant_id;
  END IF;

  IF v_tenant IS NOT NULL AND public.acceso_tenant(v_tenant) = 'solo_lectura' THEN
    RAISE EXCEPTION 'Tu cuenta está en solo lectura. Reactiva tu plan para volver a registrar cambios.'
      USING ERRCODE = 'P0001', HINT = 'CUENTA_SOLO_LECTURA';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

-- movimientos_caja no tiene tenant_id: se resuelve por su caja.
CREATE OR REPLACE FUNCTION public._bloquear_movimiento_si_solo_lectura()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_tenant UUID;
BEGIN
  IF auth.uid() IS NULL OR pg_trigger_depth() > 1 THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    SELECT c.tenant_id INTO v_tenant FROM public.cajas c WHERE c.id = OLD.caja_id;
  ELSE
    SELECT c.tenant_id INTO v_tenant FROM public.cajas c WHERE c.id = NEW.caja_id;
  END IF;

  IF v_tenant IS NOT NULL AND public.acceso_tenant(v_tenant) = 'solo_lectura' THEN
    RAISE EXCEPTION 'Tu cuenta está en solo lectura. Reactiva tu plan para volver a registrar cambios.'
      USING ERRCODE = 'P0001', HINT = 'CUENTA_SOLO_LECTURA';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public._bloquear_si_solo_lectura() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bloquear_movimiento_si_solo_lectura() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  v_tabla TEXT;
BEGIN
  FOREACH v_tabla IN ARRAY ARRAY[
    'ventas', 'compras', 'ordenes_compra', 'productos', 'clientes',
    'proveedores', 'ajustes_inventario', 'variantes_producto', 'lotes',
    'listas_precios', 'pagos_credito', 'sucursales', 'traspasos',
    'pagos_terminal'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_solo_lectura ON public.%I', v_tabla);
    EXECUTE format(
      'CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura()',
      v_tabla
    );
  END LOOP;
END;
$$;

-- Cajas: no se ABRE ni se borra ninguna, pero CERRAR (UPDATE) si se permite,
-- para que quien quedo en solo lectura con la caja abierta pueda hacer su corte.
DROP TRIGGER IF EXISTS trg_solo_lectura ON public.cajas;
CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR DELETE ON public.cajas
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_si_solo_lectura();

DROP TRIGGER IF EXISTS trg_solo_lectura ON public.movimientos_caja;
CREATE TRIGGER trg_solo_lectura BEFORE INSERT OR UPDATE OR DELETE ON public.movimientos_caja
  FOR EACH ROW EXECUTE FUNCTION public._bloquear_movimiento_si_solo_lectura();

-- ---------------------------------------------
-- Contexto del middleware: + `acceso`. Parte de la version 062 (la vigente).
-- Cambia el tipo de retorno -> DROP + CREATE y reponer GRANT (bugs #18/#23).
-- ---------------------------------------------
DROP FUNCTION IF EXISTS public.get_middleware_context(UUID);

CREATE FUNCTION public.get_middleware_context(p_user_id UUID)
RETURNS TABLE (
  tenant_id           UUID,
  rol                 public.app_role,
  subscription_status public.subscription_status,
  trial_end           TIMESTAMPTZ,
  permisos            TEXT[],
  tiene_caja_abierta  BOOLEAN,
  acceso              TEXT
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
    ),
    public.acceso_tenant(v_tenant_id)
  FROM public.tenants t
  LEFT JOIN public.subscriptions s ON s.tenant_id = t.id
  WHERE t.id = v_tenant_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_middleware_context(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_middleware_context(UUID) TO service_role;

COMMIT;

-- =============================================
-- VERIFICACION
--   SELECT nombre_comercial, public.acceso_tenant(id) FROM tenants;
--   -- Una sola firma y GRANT correcto de get_middleware_context:
--   SELECT count(*) FROM pg_proc WHERE proname = 'get_middleware_context';       -- 1
--   SELECT has_function_privilege('authenticated',
--     'public.get_middleware_context(uuid)', 'EXECUTE');                         -- false
-- =============================================
