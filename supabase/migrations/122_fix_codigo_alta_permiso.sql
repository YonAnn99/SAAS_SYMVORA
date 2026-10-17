-- ============================================================================
-- 122 · Arreglo de la 121: guardar el programa con "Registro con QR" fallaba
-- ============================================================================
-- Al activar el registro con QR, Clientes → Tarjetas de lealtad respondia
-- "permission denied for function _codigo_alta_lealtad".
--
-- El trigger `_programas_lealtad_codigo_alta` corria como quien guarda
-- (authenticated) y la 121 le quito a authenticated el EXECUTE del generador
-- del codigo, a proposito: el codigo no lo debe poder pedir ni elegir nadie.
-- Las pruebas de la 121 corrieron como postgres y no lo vieron.
--
-- Arreglo: el trigger pasa a SECURITY DEFINER (mismo cuerpo). Asi genera el
-- codigo sin abrir el generador a nadie. Solo toca NEW de la fila que ya paso
-- la RLS de escritura (loyalty.manage).
-- ============================================================================

CREATE OR REPLACE FUNCTION public._programas_lealtad_codigo_alta()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(current_setting('symvora.regenerar_codigo_alta', true), '') <> 'si' THEN
    NEW.codigo_alta := CASE WHEN TG_OP = 'UPDATE' THEN OLD.codigo_alta ELSE NULL END;
  END IF;
  IF NEW.alta_publica AND NEW.codigo_alta IS NULL THEN
    NEW.codigo_alta := public._codigo_alta_lealtad();
  END IF;
  RETURN NEW;
END; $$;
-- Es de trigger: nadie la llama directo.
REVOKE ALL ON FUNCTION public._programas_lealtad_codigo_alta() FROM PUBLIC, anon, authenticated;
