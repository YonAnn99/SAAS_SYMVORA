-- =============================================
-- 069: La prueba gratuita pasa de 7 a 14 dias
-- ---------------------------------------------
-- Decision del dueno: siete dias se quedaban cortos para que un negocio
-- alcanzara a cargar su catalogo y ver el sistema funcionando de verdad.
--
-- EL PROBLEMA DE FONDO no era el numero, era que estaba REPARTIDO. El 7 vivia
-- en dos sitios de SQL y en unas veinte cadenas de texto entre la landing, los
-- correos, los terminos y la documentacion, sin nada que los mantuviera de
-- acuerdo. Cambiarlo a mano garantizaba dejarse alguno mintiendo.
--
-- A partir de aqui la duracion se declara UNA VEZ:
--
--   public.dias_de_prueba()  -> la duracion real, para todo lo que toca la base
--   src/lib/trial.ts         -> el mismo numero, solo para los TEXTOS
--
-- Los dos no pueden compartir constante (uno es SQL y el otro TypeScript), asi
-- que el acuerdo lo vigila `src/__tests__/trial.test.ts`: lee ESTE archivo,
-- extrae el numero y lo compara con el de TypeScript. Si alguien cambia uno sin
-- el otro, la bateria de tests falla.
--
-- LO QUE NO SE TOCA, para que nadie lo "arregle" despues:
--
--   - `conekta/plans.ts` tiene `trial_period_days: 0` A PROPOSITO. SYMVORA lleva
--     su propia prueba en `subscriptions.trial_end`; ponersela tambien al plan de
--     Conekta duplicaba el periodo y retrasaba el primer cobro real (bug #22).
--   - `reset_demo_tenant()` usa 6 dias con estado 'active'. Es el tenant demo.
--   - Las suscripciones YA EXISTENTES no se mueven: esta migracion solo cambia
--     lo que se aplica de aqui en adelante.
-- =============================================

-- 1. La unica definicion de cuanto dura la prueba.
--
-- IMMUTABLE y no STABLE: devuelve una constante, asi que Postgres puede usarla
-- dentro de un DEFAULT de columna y en indices sin quejarse.
CREATE OR REPLACE FUNCTION public.dias_de_prueba()
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$ SELECT 14 $$;

COMMENT ON FUNCTION public.dias_de_prueba() IS
  'Duracion de la prueba gratuita, en dias. Fuente unica: cambiarla aqui cambia el alta de cuentas nuevas. El espejo para los textos esta en src/lib/trial.ts y hay un test que vigila que no se separen.';

-- 2. Red de seguridad de la columna, por si algun INSERT omite `trial_end`.
ALTER TABLE public.subscriptions
  ALTER COLUMN trial_end
  SET DEFAULT (NOW() + make_interval(days => public.dias_de_prueba()));

-- 3. Los codigos promocionales que no especifiquen dias regalan una prueba
--    COMPLETA, no la de antes. Es un DEFAULT: los codigos ya creados conservan
--    los dias con los que se crearon.
ALTER TABLE public.codigos_promocionales
  ALTER COLUMN trial_days
  SET DEFAULT public.dias_de_prueba();

-- 4. El alta de cuentas nuevas.
--
-- El cuerpo se copio de la version VIVA de la base (`pg_get_functiondef`), no
-- del archivo de la migracion 044: la 056 ya ensenno que el repositorio puede no
-- tener el cuerpo real. El UNICO cambio respecto a lo que habia en produccion es
-- la linea del `trial_end`; todo lo demas va byte por byte.
--
-- Va con CREATE OR REPLACE y la MISMA firma, asi que conserva sus permisos
-- (authenticated, service_role). Un DROP + CREATE los habria perdido y habria
-- dejado el alta rota.

CREATE OR REPLACE FUNCTION public.complete_onboarding(p_user_id uuid, p_nombre_comercial text, p_subdominio text, p_giro_comercial text, p_color_primario text DEFAULT NULL::text, p_configuracion_json jsonb DEFAULT NULL::jsonb, p_logo_url text DEFAULT NULL::text, p_referral_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_id UUID;
  v_tenant JSONB;
  v_referrer_tenant_id UUID;
  v_is_self INT;
  v_member_count BIGINT;
  v_role app_role;
BEGIN
  -- Security: only the authenticated user may bootstrap their own tenant
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: no puedes crear un negocio a nombre de otro usuario';
  END IF;

  -- 1. Create tenant
  INSERT INTO public.tenants (
    nombre_comercial,
    subdominio,
    giro_comercial,
    color_primario,
    logo_url
  ) VALUES (
    p_nombre_comercial,
    p_subdominio,
    p_giro_comercial,
    p_color_primario,
    p_logo_url
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Create tenant settings
  INSERT INTO public.tenant_settings (
    tenant_id,
    configuracion_json
  ) VALUES (
    v_tenant_id,
    COALESCE(p_configuracion_json, '{}'::jsonb)
  );

  -- 3. First user of the tenant gets SUPER_ADMIN (the owner/founder)
  SELECT COUNT(*) INTO v_member_count
  FROM public.tenant_memberships
  WHERE tenant_id = v_tenant_id;

  IF v_member_count = 0 THEN
    v_role := 'SUPER_ADMIN';
  ELSE
    v_role := 'ORG_ADMIN';
  END IF;

  -- 4. Create membership
  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role
  ) VALUES (
    v_tenant_id,
    p_user_id,
    v_role
  );

  -- 5. Create user role (ON CONFLICT must match UNIQUE(user_id, role))
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    v_role
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 6. Create trial subscription server-side. Antes la creaba el
  --    cliente browser; moverla aqui permite eliminar las politicas
  --    INSERT/UPDATE de authenticated sobre subscriptions (bypass de pago).
  INSERT INTO public.subscriptions (
    tenant_id,
    status,
    payment_method,
    trial_start,
    trial_end
  ) VALUES (
    v_tenant_id,
    'trial',
    'card',
    NOW(),
    -- La duracion sale de public.dias_de_prueba(), no de un literal.
    NOW() + make_interval(days => public.dias_de_prueba())
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 7. Generate own referral code (deterministic, unique by tenant id).
  --    El trigger trg_tenants_assign_codigo_referido ya lo asigna en el
  --    INSERT; este UPDATE es redundante pero inofensivo (mismo valor).
  UPDATE public.tenants
  SET codigo_referido = 'SYM' || upper(substr(replace(v_tenant_id::text, '-', ''), 1, 8))
  WHERE id = v_tenant_id;

  -- 8. Apply referral (if provided) -- silently ignore self-referrals and
  --    tenants that were already referred.
  IF p_referral_code IS NOT NULL AND btrim(p_referral_code) <> '' THEN
    BEGIN
      SELECT t.id INTO v_referrer_tenant_id
      FROM public.tenants t
      WHERE t.codigo_referido = UPPER(btrim(p_referral_code));

      IF v_referrer_tenant_id IS NOT NULL THEN
        SELECT 1 INTO v_is_self
        FROM public.tenant_memberships
        WHERE tenant_id = v_referrer_tenant_id
          AND user_id = p_user_id
        LIMIT 1;

        IF v_is_self IS NULL THEN
          INSERT INTO public.referidos (
            tenant_referidor_id,
            tenant_referido_id,
            estado,
            registrado_en
          ) VALUES (
            v_referrer_tenant_id,
            v_tenant_id,
            'REGISTRADO',
            NOW()
          );
        END IF;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- El tenant nuevo ya fue referido con otro codigo: se ignora.
      NULL;
    END;
  END IF;

  -- Return the created tenant
  SELECT to_jsonb(t.*) INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  RETURN v_tenant;

  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'El subdominio "%" ya esta en uso. Prueba otro.', p_subdominio
      USING ERRCODE = '23505';
END;
$function$
;

-- Verificacion (ejecutar a mano tras aplicar):
--   SELECT public.dias_de_prueba();                    -- 14
--   SELECT pg_get_expr(adbin, adrelid) FROM pg_attrdef -- debe citar dias_de_prueba()
--     JOIN pg_attribute a ON a.attrelid = adrelid AND a.attnum = adnum
--    WHERE a.attname = 'trial_end';
