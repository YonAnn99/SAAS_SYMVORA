-- 087: `complete_onboarding` no crea un segundo negocio para quien ya tiene uno.
--
-- Hasta ahora solo se llamaba desde el registro con correo, justo despues de
-- `signUp`, y nadie la repetia. Con la pantalla "Completa tu registro" (quien
-- entra con Google por primera vez) se puede enviar dos veces: doble clic,
-- volver atras, dos pestañas. Cada envio creaba otro negocio con el usuario
-- como SUPER_ADMIN.
--
-- Y el resto del sistema da por hecho UN negocio por usuario: `authorize()`
-- busca las excepciones de permiso por auth.uid() sin acotar por negocio, y el
-- token toma la membresia mas reciente (`custom_access_token_hook`).
--
-- El candado por usuario (pg_advisory_xact_lock) cierra la carrera de dos
-- envios simultaneos, que pasarian los dos la comprobacion antes de insertar.
--
-- Se reescribe sobre la definicion viva con sustituciones VERIFICADAS: si el
-- texto de referencia no esta, la migracion aborta en vez de dejar la funcion
-- a medias. Misma firma, asi que no hace falta DROP ni volver a dar permisos.

DO $mig$
DECLARE
  v_def TEXT;
  v_nueva TEXT;
  v_ancla CONSTANT TEXT := $q$  -- 1. Create tenant
$q$;
BEGIN
  v_def := pg_get_functiondef('public.complete_onboarding'::regproc);

  IF position(v_ancla IN v_def) = 0 THEN
    RAISE EXCEPTION '087: no encontre el punto de insercion en complete_onboarding';
  END IF;
  IF position('Ya tienes un negocio registrado' IN v_def) > 0 THEN
    RAISE NOTICE '087: complete_onboarding ya tenia la comprobacion';
    RETURN;
  END IF;

  v_nueva := replace(v_def, v_ancla, $q$  -- 0. Un negocio por usuario (migracion 087). El candado serializa los
  --    envios del mismo usuario para que dos a la vez no pasen los dos.
  PERFORM pg_advisory_xact_lock(hashtext('complete_onboarding:' || p_user_id::text));
  IF EXISTS (SELECT 1 FROM public.tenant_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Ya tienes un negocio registrado';
  END IF;

$q$ || v_ancla);

  EXECUTE v_nueva;
END
$mig$;
