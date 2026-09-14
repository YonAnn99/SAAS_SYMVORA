-- =============================================
-- 057: custom_access_token_hook no puede leer tenant_memberships
-- ---------------------------------------------
-- SINTOMA: toda escritura protegida por authorize() falla con
-- "new row violates row-level security policy". Verificado en los logs de
-- produccion del 2026-09-14: POST /rest/v1/cajas devolvia 403 una y otra vez,
-- y lo mismo compras, proveedores y ordenes_compra. Se noto al abrir caja
-- desde Finanzas, pero la caja solo era el sintoma visible.
--
-- CADENA: authorize() decide leyendo `auth.jwt() ->> 'user_role'`. Si el claim
-- no viene, devuelve FALSE y las ~75 politicas de escritura que la llaman
-- rechazan todo. El UNICO mecanismo que inyecta ese claim es
-- custom_access_token_hook, que Supabase Auth ejecuta como el rol
-- `supabase_auth_admin` al emitir cada token.
--
-- CAUSA RAIZ: la migracion 038 cambio la fuente del hook de `user_roles` a
-- `tenant_memberships` ("source of truth, scoped per tenant") pero NO se llevo
-- consigo los permisos. La migracion 001 habia preparado `user_roles` con dos
-- cosas que `tenant_memberships` nunca recibio:
--
--   GRANT ALL ON TABLE public.user_roles TO supabase_auth_admin;
--   CREATE POLICY "Allow auth admin to read user roles" ON public.user_roles
--     AS PERMISSIVE FOR SELECT TO supabase_auth_admin USING (true);
--
-- Hacen falta LAS DOS. El GRANT sin la politica no basta: `tenant_memberships`
-- tiene RLS activo y `supabase_auth_admin` no es superusuario ni tiene
-- BYPASSRLS, asi que sin politica el SELECT devolveria cero filas y el hook
-- pondria `user_role: null` — el mismo fallo, en silencio. Y la politica sin
-- el GRANT tampoco: el privilegio de tabla se comprueba antes que RLS.
--
-- Se concede solo SELECT (el hook unicamente lee). La 001 concedio ALL sobre
-- `user_roles`, que era mas de lo necesario; no se replica ese exceso.
--
-- ORDEN DE APLICACION: esta migracion es inofensiva por si sola y hay que
-- aplicarla ANTES de activar el hook en el dashboard. Si se activa el hook sin
-- estos permisos, el SELECT lanza "permission denied for table
-- tenant_memberships", el hook revienta y Supabase Auth deja de emitir tokens:
-- se cae el login de todo el mundo, no solo las escrituras.
--
-- LECCION: al reapuntar una funcion a otra tabla, revisar que los permisos de
-- la tabla vieja viajen con ella. Aqui el rol que ejecuta no es el usuario
-- final sino `supabase_auth_admin`, asi que el fallo no aparece en ninguna
-- prueba hecha desde la aplicacion.
-- =============================================

BEGIN;

-- 1. Privilegio de tabla. Sin esto el SELECT del hook falla con
--    "permission denied" antes siquiera de evaluar RLS.
GRANT SELECT ON TABLE public.tenant_memberships TO supabase_auth_admin;

-- 2. Politica RLS. Sin esto el SELECT no falla: devuelve cero filas, el hook
--    escribe `user_role: null` y todo sigue roto sin un solo error en los logs.
--    USING (true) es correcto aqui: el hook ya filtra por el user_id del evento
--    que le pasa Supabase Auth, y este rol no es alcanzable desde PostgREST.
DROP POLICY IF EXISTS "Allow auth admin to read tenant memberships" ON public.tenant_memberships;
CREATE POLICY "Allow auth admin to read tenant memberships" ON public.tenant_memberships
  AS PERMISSIVE FOR SELECT TO supabase_auth_admin USING (true);

COMMIT;

-- =============================================
-- VERIFICACION — debe devolver las tres columnas en true.
--
--   SELECT
--     has_table_privilege('supabase_auth_admin','public.tenant_memberships','SELECT') AS tiene_grant,
--     EXISTS (SELECT 1 FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
--              WHERE c.relname = 'tenant_memberships'
--                AND 'supabase_auth_admin' = ANY(
--                      SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles))) AS tiene_politica,
--     has_function_privilege('supabase_auth_admin','public.custom_access_token_hook(jsonb)','EXECUTE') AS puede_ejecutar_hook;
--
-- DESPUES, en el dashboard: Authentication -> Hooks -> Customize Access Token
-- (JWT) Claims -> apuntar a public.custom_access_token_hook y activarlo.
-- El claim solo entra en tokens NUEVOS: hay que cerrar sesion y volver a
-- entrar; refrescar la pagina no basta.
--
-- Comprobacion final, ya dentro de la aplicacion (consola del navegador):
--
--   const { data } = await supabase.auth.getSession();
--   JSON.parse(atob(data.session.access_token.split('.')[1])).user_role
--
-- Debe imprimir el rol ('SUPER_ADMIN', 'ORG_ADMIN' o 'CAJERO'), nunca null.
-- =============================================
