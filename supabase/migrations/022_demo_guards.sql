-- =============================================
-- 022: Demo isolation guards
-- ---------------------------------------------
-- Endurece el aislamiento entre el modo demo y la base de datos
-- de producción. Aunque el usuario demo (demo@symvora.com) solo
-- tiene membership en el tenant "abarrotes-don-pedro" y por tanto
-- RLS le impide ver/modificar filas de otros tenants, las mutaciones
-- que sí puede hacer dentro del tenant demo consumen IDs de
-- secuencias, espacio en tablas y disparan triggers/actividad.
--
-- Esta migración añade:
--   1) Funcion `public.is_demo_user()`: helper SECURITY DEFINER que
--      devuelve true cuando el JWT pertenece al usuario demo. Pensada
--      para usarse en policies RLS, en futuras RPCs y en
--      comprobaciones desde el backend.
--   2) Funcion `public.current_user_is_demo()`: version "rapida" para
--      policies: se invoca con `to authenticated` y devuelve true si
--      `auth.uid()` mapea al email demo.
--   3) Revoca EXECUTE de `reset_demo_tenant` tambien a `authenticated`
--      (antes solo estaba REVOKE a PUBLIC/anon, pero por la ACL por
--      defecto Supabase deja EXECUTE a `authenticated`).
--   4) Marca `auth.users.app_metadata.is_demo = true` para el usuario
--      demo. Esto permite que la detección server-side (que ya está
--      en `src/lib/supabase/demo-guard.ts`) no dependa solo del
--      email (que en teoría es inmutable, pero por defensa en
--      profundidad).
-- =============================================

BEGIN;

-- 1) Funcion base: lee el email del usuario actual via JWT.
--    SECURITY DEFINER + search_path fijo por buenas practicas
--    (mismo patron que las demas funciones SECURITY DEFINER).
CREATE OR REPLACE FUNCTION public.is_demo_user()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
    FROM auth.users
    WHERE id = auth.uid();

  IF v_email IS NULL THEN
    RETURN FALSE;
  END IF;

  RETURN v_email = 'demo@symvora.com';
END;
$$;

ALTER FUNCTION public.is_demo_user() OWNER TO postgres;

-- 2) Version pensada para policies RLS. No es SECURITY DEFINER: se
--    evalua con el caller y devuelve un boolean.
CREATE OR REPLACE FUNCTION public.current_user_is_demo()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND email = 'demo@symvora.com'
  );
$$;

ALTER FUNCTION public.current_user_is_demo() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.is_demo_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_demo_user() TO service_role;

REVOKE ALL ON FUNCTION public.current_user_is_demo() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_is_demo() TO authenticated, service_role;

-- 3) Refuerza la revocacion de reset_demo_tenant. La migracion 018
--    ya lo hacia, pero por seguridad lo repetimos de forma
--    idempotente para defendernos contra migraciones futuras que
--    recreen la funcion con grants por defecto.
REVOKE ALL ON FUNCTION public.reset_demo_tenant() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reset_demo_tenant() TO service_role;

-- 4) Marca app_metadata del usuario demo. Solo se ejecuta si existe
--    el usuario (no rompe migraciones frescas sin el seed).
--    Supabase expone los metadatos en la columna `raw_app_meta_data`
--    (jsonb) y los sincroniza con `app_metadata` que ve el backend.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'demo@symvora.com') THEN
    UPDATE auth.users
      SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                              || jsonb_build_object('is_demo', true),
          updated_at = now()
      WHERE email = 'demo@symvora.com';
  END IF;
END $$;

COMMIT;
