-- =============================================
-- 020: QA - limpieza y revocacion de EXECUTE a anon
-- ---------------------------------------------
-- 1. Se eliminan las tablas temporales que dejaron los smoke tests
--    (public._smoke_results / public._smoke_results_018), que ademas
--    no tenian RLS habilitado.
-- 2. En Supabase, las funciones creadas reciben EXECUTE directo para
--    anon/authenticated via default ACLs, por lo que REVOKE FROM PUBLIC
--    no basta. Se revoca anon/authenticated de funciones SECURITY
--    DEFINER que solo deben llamarse por service_role o por el
--    authenticated que invoca su propia RPC con guardas de auth.uid().
-- 3. log_activity: se fija SET search_path = public (SECURITY DEFINER).
-- =============================================

BEGIN;

-- 1. Limpieza de tablas temporales de smoke tests
DROP TABLE IF EXISTS public._smoke_results;
DROP TABLE IF EXISTS public._smoke_results_018;

-- 2. Revocaciones. Se conserva EXECUTE para authenticated donde la app
--    lo usa via RPC (browser client) con guarda de auth.uid().

-- Solo service_role (los secrets solo se leen/escriben via API con service role)
REVOKE ALL ON FUNCTION public.guardar_secreto_fiscal(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.leer_secreto_fiscal(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;

-- Trigger interno (007): no requiere EXECUTE por rol alguno
REVOKE ALL ON FUNCTION public.update_venta_factura_link() FROM PUBLIC, anon, authenticated;

-- RPC con guarda auth.uid() propia: solo authenticated (nunca anon)
REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_sale(UUID, UUID, UUID, public.metodo_pago, JSONB, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ajustar_inventario(UUID, NUMERIC, public.motivo_ajuste, TEXT, UUID, UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recibir_orden_compra(UUID, JSONB) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;

-- authorize() y user_tenant_ids() se usan en expresiones RLS por
-- authenticated: solo se revoca anon (que no tiene datos que consultar).
REVOKE ALL ON FUNCTION public.authorize(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_tenant_ids() FROM PUBLIC, anon;

-- 3. log_activity: fijar search_path (SECURITY DEFINER)
ALTER FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) SET search_path = public;

COMMIT;
