-- 010_legal_acceptance.sql
-- Tabla de auditoría legal: registra cada aceptación de Términos, Aviso de Privacidad y Política de Cookies.
-- Sirve como evidencia legal ante aclaraciones o contracargos.

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version   text NOT NULL,
  privacy_version text NOT NULL,
  cookies_version text NOT NULL,
  ip_address      inet,
  user_agent      text,
  accepted_at     timestamptz NOT NULL DEFAULT now()
);

-- Una fila por usuario y versión de documentos. Permite múltiples aceptaciones
-- (un usuario puede aceptar v1.0 y luego v1.1), pero evita duplicados exactos.
CREATE UNIQUE INDEX IF NOT EXISTS legal_acceptances_unique_version
  ON public.legal_acceptances (user_id, terms_version, privacy_version, cookies_version);

CREATE INDEX IF NOT EXISTS legal_acceptances_user_id_idx
  ON public.legal_acceptances (user_id, accepted_at DESC);

ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Usuarios ven solo sus propias aceptaciones.
DROP POLICY IF EXISTS "Users can view own legal_acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can view own legal_acceptances"
  ON public.legal_acceptances FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Usuarios insertan solo sus propias aceptaciones.
DROP POLICY IF EXISTS "Users can insert own legal_acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can insert own legal_acceptances"
  ON public.legal_acceptances FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
