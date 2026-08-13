-- SYMVORA SaaS - Corrección de credenciales fiscales (015)
--
-- Supabase Vault en este proyecto solo permite cifrar/descifrar a
-- supabase_admin (las funciones vault._crypto_aead_det_* no son ejecutables
-- por postgres/service_role y no existe vault.create_secret), por lo que las
-- funciones creadas en 014 son inutilizables. Se sustituyen por cifrado
-- pgcrypto (pgp_sym_encrypt) con una clave manejada por el servidor en la
-- variable de entorno FISCAL_SECRET_KEY. Los secretos NUNCA se guardan en
-- texto plano: la JSONB configuracion_fiscal solo almacena los IDs.

-- =============================================
-- DESHACER FUNCIONES DEL VAULT (014)
-- =============================================

DROP FUNCTION IF EXISTS public.guardar_secreto_fiscal(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.leer_secreto_fiscal(UUID);

-- =============================================
-- TABLA DE SECRETOS FISCALES (cifrados)
-- =============================================

CREATE TABLE IF NOT EXISTS public.factura_fiscal_secrets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  valor BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, nombre)
);

ALTER TABLE public.factura_fiscal_secrets ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "service_role_fiscal_secrets" ON public.factura_fiscal_secrets;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

CREATE POLICY "service_role_fiscal_secrets" ON public.factura_fiscal_secrets
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.factura_fiscal_secrets FROM PUBLIC;
REVOKE ALL ON TABLE public.factura_fiscal_secrets FROM authenticated;
GRANT ALL ON TABLE public.factura_fiscal_secrets TO service_role;

-- =============================================
-- FUNCIONES DE ACCESO
-- =============================================

-- Guarda (o actualiza) un secreto cifrado para un tenant. Retorna el ID.
-- La clave p_clave proviene de la variable de entorno FISCAL_SECRET_KEY
-- del servidor y nunca se persiste en la base de datos.
CREATE OR REPLACE FUNCTION public.guardar_secreto_fiscal(
  p_tenant_id UUID,
  p_nombre TEXT,
  p_valor TEXT,
  p_clave TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.factura_fiscal_secrets (tenant_id, nombre, valor)
  VALUES (p_tenant_id, p_nombre, extensions.pgp_sym_encrypt(p_valor, p_clave))
  ON CONFLICT (tenant_id, nombre) DO UPDATE
    SET valor = EXCLUDED.valor,
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Lee el valor en claro de un secreto (solo si pertenece al tenant).
CREATE OR REPLACE FUNCTION public.leer_secreto_fiscal(
  p_secret_id UUID,
  p_tenant_id UUID,
  p_clave TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_valor TEXT;
BEGIN
  SELECT extensions.pgp_sym_decrypt(valor, p_clave)::text INTO v_valor
  FROM public.factura_fiscal_secrets
  WHERE id = p_secret_id AND tenant_id = p_tenant_id;

  RETURN v_valor;
END;
$$;

REVOKE ALL ON FUNCTION public.guardar_secreto_fiscal(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leer_secreto_fiscal(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_secreto_fiscal(UUID, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.leer_secreto_fiscal(UUID, UUID, TEXT) TO service_role;