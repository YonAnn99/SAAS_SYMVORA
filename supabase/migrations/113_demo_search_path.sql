-- =============================================================================
-- 113 · search_path fijo en current_user_is_demo
--
-- La 112 la redefinio (para reconocer a los usuarios de visitante) sin
-- `SET search_path`, y el linter de Supabase la marca como "role mutable
-- search_path". Solo se fija el search_path; el cuerpo no cambia.
-- =============================================================================

ALTER FUNCTION public.current_user_is_demo() SET search_path = public, auth;
