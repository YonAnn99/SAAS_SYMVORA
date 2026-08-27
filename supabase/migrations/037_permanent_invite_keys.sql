-- =============================================
-- 037: Make invite keys permanent
-- ---------------------------------------------
-- Remove used/expires_at columns from user_invite_keys.
-- Keys are now permanent: employee uses same key every login
-- until admin deletes it.
-- =============================================

BEGIN;

-- Drop old function first (depends on old column types)
DROP FUNCTION IF EXISTS public.validate_invite_key(TEXT, TEXT);

-- Remove columns that no longer apply
ALTER TABLE public.user_invite_keys DROP COLUMN IF EXISTS used;
ALTER TABLE public.user_invite_keys DROP COLUMN IF EXISTS used_at;
ALTER TABLE public.user_invite_keys DROP COLUMN IF EXISTS expires_at;

-- Add DELETE policy so admin can revoke keys
CREATE POLICY "invite_keys_delete" ON public.user_invite_keys
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Simplified validate function: just match email + key, return tenant/role
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
  SELECT tenant_id, role
  INTO v_record
  FROM public.user_invite_keys
  WHERE LOWER(email) = LOWER(p_email)
    AND key = UPPER(p_key)
  LIMIT 1;

  IF v_record IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, NULL::TEXT, FALSE;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_record.tenant_id, v_record.role, TRUE;
END;
$$;

COMMIT;
