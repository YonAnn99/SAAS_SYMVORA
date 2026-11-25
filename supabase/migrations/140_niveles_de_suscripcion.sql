-- =============================================
-- 140: niveles de suscripción (Básico / Pro / Premium)
-- =============================================
-- Hasta hoy hay UN solo plan. Esta migración agrega el concepto de NIVEL sin tocar a nadie:
--
--   * `subscriptions.nivel` = NULL significa «plan heredado»: los clientes de hoy y quien está en la
--     prueba de 14 días. Sin ningún límite, exactamente como ahora. Solo un cobro confirmado de un nivel
--     nuevo lo llena (el webhook de Conekta, vía `asignar_nivel`).
--   * `subscriptions.nivel_pendiente` guarda el nivel elegido en el checkout MIENTRAS no se paga: si el
--     pago no se completa, el negocio no pierde nada de lo que ya tenía.
--
-- Lo que cambia por nivel (única fuente: `plan_funciones`; el espejo en TypeScript es `src/lib/niveles.ts`
-- y una prueba los compara):
--
--              sucursales   tarjetas de lealtad   catálogo en línea   pedidos del catálogo
--   Básico         1              no                   no                    no
--   Pro            3              sí                   sí                    sí
--   Premium    ilimitadas         sí                   sí                    sí
--   heredado   ilimitadas         sí                   sí                    sí
--
-- La regla se aplica AQUÍ, en la base, y no solo escondiendo botones: cada una es un trigger (aditivo,
-- sin reescribir `complete_sale_lealtad` ni ninguna función de cobro).
--   * `sucursales`: no se puede tener más sucursales ACTIVAS que las del nivel (cerrar una libera el cupo).
--   * `tarjetas_lealtad` y sellos/canjes nuevos de `movimientos_lealtad`: rechazados sin lealtad. Los
--     movimientos tipo `ajuste` NO se bloquean: cancelar una venta vieja revierte su sello con un ajuste.
--   * `catalogos_en_linea`: no puede estar activo sin catálogo en el plan.
--
-- Nada de esto cambia filas existentes: todas las suscripciones quedan con `nivel` NULL (heredado).

-- ---------------------------------------------------------------------------
-- 1. Columnas
-- ---------------------------------------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS nivel text,
  ADD COLUMN IF NOT EXISTS nivel_pendiente text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_nivel_check') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_nivel_check
      CHECK (nivel IS NULL OR nivel IN ('basico', 'pro', 'premium'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_nivel_pendiente_check') THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_nivel_pendiente_check
      CHECK (nivel_pendiente IS NULL OR nivel_pendiente IN ('basico', 'pro', 'premium'));
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 2. Qué incluye cada nivel (fuente única del lado de la base)
-- ---------------------------------------------------------------------------
-- Un negocio sin suscripción (la demo) o con `nivel` NULL (heredado, prueba) lo tiene todo.
CREATE OR REPLACE FUNCTION public.plan_funciones(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT CASE (SELECT s.nivel FROM public.subscriptions s WHERE s.tenant_id = p_tenant_id)
    WHEN 'basico' THEN jsonb_build_object(
      'nivel', 'basico', 'sucursales_max', 1,
      'lealtad', false, 'catalogo', false, 'pedidos', false)
    WHEN 'pro' THEN jsonb_build_object(
      'nivel', 'pro', 'sucursales_max', 3,
      'lealtad', true, 'catalogo', true, 'pedidos', true)
    WHEN 'premium' THEN jsonb_build_object(
      'nivel', 'premium', 'sucursales_max', NULL,
      'lealtad', true, 'catalogo', true, 'pedidos', true)
    ELSE jsonb_build_object(
      'nivel', NULL, 'sucursales_max', NULL,
      'lealtad', true, 'catalogo', true, 'pedidos', true)
  END
$$;

-- Lo que ve la pantalla: las funciones del nivel + cuántas sucursales activas se usan. Solo para quien
-- pertenece al negocio.
CREATE OR REPLACE FUNCTION public.info_plan(p_tenant_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usadas integer;
BEGIN
  IF p_tenant_id IS NULL OR NOT (p_tenant_id IN (SELECT public.user_tenant_ids())) THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;
  SELECT count(*) INTO v_usadas FROM public.sucursales s WHERE s.tenant_id = p_tenant_id AND s.activa;
  RETURN public.plan_funciones(p_tenant_id) || jsonb_build_object('sucursales_usadas', v_usadas);
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Sucursales: no más activas que las del nivel
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._plan_limite_sucursales()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_max integer;
  v_usadas integer;
BEGIN
  -- Una sucursal que nace cerrada, o que ya estaba activa, no ocupa un cupo nuevo.
  IF NOT COALESCE(NEW.activa, true) THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND COALESCE(OLD.activa, true) THEN
    RETURN NEW;
  END IF;

  v_max := (public.plan_funciones(NEW.tenant_id) ->> 'sucursales_max')::integer;
  IF v_max IS NULL THEN
    RETURN NEW;
  END IF;

  -- Dos altas simultáneas del mismo negocio no pueden pasarse del tope.
  PERFORM pg_advisory_xact_lock(hashtext('sucursales:' || NEW.tenant_id::text));

  SELECT count(*) INTO v_usadas
  FROM public.sucursales s
  WHERE s.tenant_id = NEW.tenant_id AND s.activa AND s.id IS DISTINCT FROM NEW.id;

  IF v_usadas >= v_max THEN
    RAISE EXCEPTION 'limite_sucursales' USING ERRCODE = 'P0001', HINT = v_max::text;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_limite_sucursales ON public.sucursales;
CREATE TRIGGER trg_plan_limite_sucursales
  BEFORE INSERT OR UPDATE OF activa ON public.sucursales
  FOR EACH ROW EXECUTE FUNCTION public._plan_limite_sucursales();

-- ---------------------------------------------------------------------------
-- 4. Tarjetas de lealtad: sin lealtad en el plan, no hay tarjetas ni sellos nuevos
-- ---------------------------------------------------------------------------
-- Dos funciones y no una compartida: `tarjetas_lealtad` no tiene la columna `tipo` y PL/pgSQL no
-- garantiza el cortocircuito de `AND`, así que leer `NEW.tipo` ahí rompía el alta de tarjetas de todos.
CREATE OR REPLACE FUNCTION public._plan_exige_lealtad_tarjeta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT COALESCE((public.plan_funciones(NEW.tenant_id) ->> 'lealtad')::boolean, true) THEN
    RAISE EXCEPTION 'plan_sin_lealtad' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public._plan_exige_lealtad_sello()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- El `ajuste` (p. ej. el que revierte el sello al cancelar una venta) siempre pasa.
  IF NEW.tipo NOT IN ('sello', 'canje') THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE((public.plan_funciones(NEW.tenant_id) ->> 'lealtad')::boolean, true) THEN
    RAISE EXCEPTION 'plan_sin_lealtad' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_lealtad_tarjetas ON public.tarjetas_lealtad;
CREATE TRIGGER trg_plan_lealtad_tarjetas
  BEFORE INSERT ON public.tarjetas_lealtad
  FOR EACH ROW EXECUTE FUNCTION public._plan_exige_lealtad_tarjeta();

DROP TRIGGER IF EXISTS trg_plan_lealtad_movimientos ON public.movimientos_lealtad;
CREATE TRIGGER trg_plan_lealtad_movimientos
  BEFORE INSERT ON public.movimientos_lealtad
  FOR EACH ROW EXECUTE FUNCTION public._plan_exige_lealtad_sello();

-- ---------------------------------------------------------------------------
-- 5. Catálogo en línea: no puede estar activo sin catálogo en el plan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._plan_exige_catalogo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT COALESCE((public.plan_funciones(NEW.tenant_id) ->> 'catalogo')::boolean, true) THEN
    RAISE EXCEPTION 'plan_sin_catalogo' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_plan_catalogo ON public.catalogos_en_linea;
CREATE TRIGGER trg_plan_catalogo
  BEFORE INSERT OR UPDATE ON public.catalogos_en_linea
  FOR EACH ROW WHEN (NEW.activo IS TRUE)
  EXECUTE FUNCTION public._plan_exige_catalogo();

-- ---------------------------------------------------------------------------
-- 6. Asignar un nivel (SOLO el servidor: el webhook de Conekta tras un cobro confirmado)
-- ---------------------------------------------------------------------------
-- Cambia el nivel y aplica lo que implica bajar: rechaza si el negocio tiene más sucursales activas de
-- las que permite el nivel (hay que cerrarlas antes) y despublica el catálogo si ya no está en el plan.
-- Las tarjetas de lealtad NO se borran: se conservan congeladas (los triggers impiden sellos nuevos).
-- `p_nivel` NULL devuelve el negocio a «heredado».
CREATE OR REPLACE FUNCTION public.asignar_nivel(p_tenant_id uuid, p_nivel text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_funciones jsonb;
  v_max integer;
  v_usadas integer;
BEGIN
  IF p_nivel IS NOT NULL AND p_nivel NOT IN ('basico', 'pro', 'premium') THEN
    RAISE EXCEPTION 'nivel_invalido';
  END IF;

  UPDATE public.subscriptions
  SET nivel = p_nivel, nivel_pendiente = NULL, updated_at = now()
  WHERE tenant_id = p_tenant_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'sin_suscripcion';
  END IF;

  v_funciones := public.plan_funciones(p_tenant_id);
  v_max := (v_funciones ->> 'sucursales_max')::integer;
  IF v_max IS NOT NULL THEN
    SELECT count(*) INTO v_usadas FROM public.sucursales s WHERE s.tenant_id = p_tenant_id AND s.activa;
    IF v_usadas > v_max THEN
      -- Revierte el UPDATE de arriba: no se queda a medias.
      RAISE EXCEPTION 'limite_sucursales' USING ERRCODE = 'P0001', HINT = v_max::text;
    END IF;
  END IF;

  IF NOT COALESCE((v_funciones ->> 'catalogo')::boolean, true) THEN
    UPDATE public.catalogos_en_linea SET activo = false WHERE tenant_id = p_tenant_id AND activo IS TRUE;
  END IF;

  RETURN v_funciones;
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Permisos
-- ---------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.plan_funciones(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.asignar_nivel(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.asignar_nivel(uuid, text) TO service_role;
REVOKE ALL ON FUNCTION public.info_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.info_plan(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public._plan_limite_sucursales() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._plan_exige_lealtad_tarjeta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._plan_exige_lealtad_sello() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._plan_exige_catalogo() FROM PUBLIC, anon, authenticated;
