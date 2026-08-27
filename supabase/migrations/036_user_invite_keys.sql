-- =============================================
-- 036: User Invite Keys
-- ---------------------------------------------
-- Tabla para almacenar claves de invitacion
-- en vez de usar links de Supabase Auth que expiran.
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.user_invite_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  key TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'CAJERO',
  used BOOLEAN NOT NULL DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invite_keys_tenant ON public.user_invite_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_invite_keys_email ON public.user_invite_keys(email);
CREATE INDEX IF NOT EXISTS idx_invite_keys_key ON public.user_invite_keys(key);

-- RLS
ALTER TABLE public.user_invite_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "invite_keys_select" ON public.user_invite_keys
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "invite_keys_insert" ON public.user_invite_keys
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "invite_keys_update" ON public.user_invite_keys
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Allow anon to validate keys (for login)
CREATE POLICY "invite_keys_validate_anon" ON public.user_invite_keys
FOR SELECT TO anon
USING (TRUE);

-- Function to validate and use an invite key
CREATE OR REPLACE FUNCTION public.validate_invite_key(
  p_email TEXT,
  p_key TEXT
)
RETURNS TABLE(
  p_tenant_id UUID,
  p_role TEXT,
  p_valid BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_record RECORD;
BEGIN
  SELECT id, tenant_id, role, used, expires_at
  INTO v_record
  FROM public.user_invite_keys
  WHERE LOWER(email) = LOWER(p_email)
    AND key = p_key
    AND used = FALSE
    AND expires_at > NOW()
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE;
    RETURN;
  END IF;

  -- Mark as used
  UPDATE public.user_invite_keys
  SET used = TRUE, used_at = NOW()
  WHERE id = v_record.id;

  RETURN QUERY SELECT v_record.tenant_id, v_record.role, TRUE;
END;
$$;

COMMIT;
