-- =============================================================================
-- 106 · log_activity: el usuario lo pone la sesión, no el cliente
--
-- La 018 exigía `auth.uid() = p_user_id`, pero la definición vigente (tras la
-- 034, reconstruida sin el diff) ya no lo hacía: la función es SECURITY
-- DEFINER, la ejecuta `authenticated` y CONFIABA en `p_user_id` y
-- `p_user_email`. Cualquier usuario con sesión podía escribir en la Bitácora a
-- nombre de otro, incluso de otro negocio (el tenant se deduce de ese
-- `p_user_id`). Hallado el 2026-10-04.
--
-- Ahora:
--   * Con sesión de usuario: el usuario es `auth.uid()` y el correo el de
--     `auth.users`. Si `p_user_id` no coincide, se rechaza (el cliente siempre
--     manda el suyo; uno distinto es un intento de suplantación).
--   * Sin sesión de usuario: solo `service_role` (procesos del servidor, como
--     el cierre automático de caja) puede registrar a nombre de `p_user_id`.
--   * Nadie más.
--
-- Misma firma y mismo resultado: solo cambia el cuerpo (CREATE OR REPLACE), y
-- se reaplican REVOKE/GRANT por claridad.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.log_activity(
  p_user_id UUID,
  p_user_email TEXT,
  p_action TEXT,
  p_entity TEXT,
  p_entity_id UUID DEFAULT NULL,
  p_entity_name TEXT DEFAULT NULL,
  p_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_user_id UUID;
  v_email TEXT;
  v_tenant_id UUID;
  v_log_id UUID;
BEGIN
  IF v_uid IS NOT NULL THEN
    IF p_user_id IS DISTINCT FROM v_uid THEN
      RAISE EXCEPTION 'No autorizado';
    END IF;
    v_user_id := v_uid;
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
  ELSIF auth.role() = 'service_role' THEN
    v_user_id := p_user_id;
    v_email := p_user_email;
  ELSE
    RAISE EXCEPTION 'No autorizado';
  END IF;

  SELECT tm.tenant_id INTO v_tenant_id
  FROM public.tenant_memberships tm
  WHERE tm.user_id = v_user_id
  LIMIT 1;

  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant found for user';
  END IF;

  INSERT INTO public.activity_logs (
    tenant_id, user_id, user_email, action, entity,
    entity_id, entity_name, details, ip_address
  ) VALUES (
    v_tenant_id, v_user_id, COALESCE(v_email, ''), p_action, p_entity,
    p_entity_id, p_entity_name, p_details, p_ip_address
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_activity(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, TEXT) TO authenticated, service_role;
