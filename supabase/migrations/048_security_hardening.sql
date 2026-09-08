-- =============================================
-- 048: Security hardening (auditoría sept 2026)
-- ---------------------------------------------
-- 1) log_activity() es SECURITY DEFINER sin search_path fijo — vector
--    clásico de escalación de privilegios en Postgres (un search_path
--    controlado por quien llama podría sombrear objetos de los que
--    depende la función). Se fija a 'public', igual que ya tiene
--    log_table_changes() y get_current_user_email().
--
-- 2) Varias funciones SECURITY DEFINER siguen siendo ejecutables por
--    "anon" (usuarios sin autenticar) pese a que 039_get_tenant_members_rpc.sql
--    ya había revocado ese acceso — probablemente una redefinición
--    posterior (DROP + CREATE, no CREATE OR REPLACE) restableció el
--    privilegio por default de Postgres (EXECUTE a PUBLIC en funciones
--    nuevas). Se vuelve a revocar explícitamente y se deja solo para
--    "authenticated".
-- =============================================

ALTER FUNCTION public.log_activity(
  uuid, text, text, text, uuid, text, jsonb, text
) SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.complete_sale(
  uuid, uuid, uuid, metodo_pago, jsonb, boolean, text, numeric
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_sale(
  uuid, uuid, uuid, metodo_pago, jsonb, boolean, text, numeric
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_current_user_email() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_current_user_email() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.get_tenant_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_members(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.registrar_pago_credito(
  uuid, uuid, uuid, numeric, metodo_pago, text
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_pago_credito(
  uuid, uuid, uuid, numeric, metodo_pago, text
) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.validate_invite_key(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.validate_invite_key(text, text) TO authenticated;

-- log_table_changes() solo debe correr como trigger (SECURITY DEFINER ya
-- le da los permisos que necesita); nunca se llama por RPC directo.
REVOKE EXECUTE ON FUNCTION public.log_table_changes() FROM PUBLIC, anon, authenticated;
