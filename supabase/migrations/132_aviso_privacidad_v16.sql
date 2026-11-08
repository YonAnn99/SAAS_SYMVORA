-- =============================================
-- 132: Aviso de privacidad v1.6-2026-11-08 (Google Wallet)
-- ---------------------------------------------
-- El aviso agrega que, cuando el cliente de un negocio guarda su tarjeta de
-- lealtad en Google Wallet, se envian a Google su primer nombre, el codigo de su
-- tarjeta y su avance de sellos (src/lib/legal/versions.ts).
--
-- `ejecutar_baja` (128) anota en `interno.contactos_conservados.aviso_version` el
-- aviso vigente bajo el que se conserva el contacto. Aqui solo cambia ese literal:
-- se toma la definicion VIVA de la funcion y se reemplaza la version, asi el resto
-- del cuerpo queda identico. CREATE OR REPLACE conserva los permisos (solo
-- service_role). Si la version vieja no esta, falla y no toca nada.
--
-- Probado en transaccion revertida el 2026-11-08: misma longitud, sin la v1.5, con
-- la v1.6 y permisos {postgres, service_role}.
-- =============================================

DO $m$
DECLARE
  v_def text;
BEGIN
  SELECT pg_get_functiondef('public.ejecutar_baja(uuid, boolean)'::regprocedure) INTO v_def;
  IF position('''v1.5-2026-10-31''' IN v_def) = 0 THEN
    RAISE EXCEPTION 'ejecutar_baja no tiene la version v1.5-2026-10-31: revisar antes de aplicar';
  END IF;
  EXECUTE replace(v_def, '''v1.5-2026-10-31''', '''v1.6-2026-11-08''');
END
$m$;
