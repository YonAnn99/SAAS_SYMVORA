-- =============================================
-- 021: QA - RLS en role_permissions + search_path fijo
-- ---------------------------------------------
-- 1. role_permissions es una tabla de referencia (rol -> permiso) que
--    solo consulta el service client (src/lib/supabase/auth.ts) y las
--    funciones SECURITY DEFINER (complete_sale/authorize, cuyo owner es
--    postgres y no le aplica RLS). Se habilita RLS para cerrar el acceso
--    directo por anon/authenticated.
-- 2. Se fija SET search_path = public en funciones SECURITY DEFINER
--    que aun lo tenian mutable (lint 0011).
-- =============================================

BEGIN;

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "role_permissions_read_service" ON public.role_permissions;
CREATE POLICY "role_permissions_read_service" ON public.role_permissions
  FOR SELECT TO service_role USING (true);

-- search_path fijo en SECURITY DEFINER
ALTER FUNCTION public.custom_access_token_hook() SET search_path = public;
ALTER FUNCTION public.has_active_subscription(UUID) SET search_path = public;
ALTER FUNCTION public.get_subscription_info(UUID) SET search_path = public;
ALTER FUNCTION public.update_factura_timestamp() SET search_path = public;

COMMIT;
