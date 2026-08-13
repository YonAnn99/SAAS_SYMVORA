-- SYMVORA SaaS - Seguridad de credenciales fiscales
-- S3 de la guía CFDI: cifrado de credenciales con Supabase Vault
-- + almacenamiento del XML timbrado oficial para descargas

-- =============================================
-- SUPABASE VAULT
-- =============================================

CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Guarda (o actualiza) un secreto fiscal. Retorna el ID del secreto.
CREATE OR REPLACE FUNCTION public.guardar_secreto_fiscal(
  p_nombre TEXT,
  p_valor TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO vault.secrets (name, secret, description)
  VALUES (p_nombre, p_valor, 'Credencial fiscal Symvora')
  ON CONFLICT (name) DO UPDATE
    SET secret = EXCLUDED.secret,
        description = 'Credencial fiscal Symvora',
        updated_at = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Lee el valor en claro de un secreto fiscal por su ID.
CREATE OR REPLACE FUNCTION public.leer_secreto_fiscal(
  p_secret_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = vault, public
AS $$
DECLARE
  v_valor TEXT;
BEGIN
  SELECT decrypted_secret INTO v_valor
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id
  LIMIT 1;

  RETURN v_valor;
END;
$$;

-- Los secretos solo pueden leerse/escribirse desde el servidor (service_role).
REVOKE ALL ON FUNCTION public.guardar_secreto_fiscal(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.leer_secreto_fiscal(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.guardar_secreto_fiscal(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.leer_secreto_fiscal(UUID) TO service_role;

-- =============================================
-- XML TIMBRADO OFICIAL
-- =============================================

-- Guarda el XML oficial (con TimbreFiscalDigital) devuelto por el PAC
-- para que la descarga no regenere un XML sin sello SAT.
DO $$ BEGIN
  ALTER TABLE public.facturas ADD COLUMN xml_timbrado TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
