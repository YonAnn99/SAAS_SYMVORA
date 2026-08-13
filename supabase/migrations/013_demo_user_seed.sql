-- =============================================
-- 013: Demo user bootstrap
-- ---------------------------------------------
-- Crea el usuario demo@symvora.com (en auth.users) y ejecuta el primer
-- reset_demo_tenant() para tener el snapshot inicial listo.
--
-- auth.users solo se puede escribir via Supabase Auth Admin API, no por SQL.
-- Esta migracion intenta insertarlo via SQL crudo (funciona si tienes los
-- privilegios adecuados). Si falla, ejecutar manualmente desde el Dashboard:
--   Authentication > Users > Add user > email_confirm = true
--   email: demo@symvora.com
--   password: (no importa, login es por magic link)
--
-- Despues de la insercion manual, ejecutar:
--   SELECT public.reset_demo_tenant();
-- =============================================

DO $$
BEGIN
  BEGIN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated',
      'authenticated',
      'demo@symvora.com',
      crypt('demo-no-login-' || gen_random_uuid()::text, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Demo User","is_demo":true}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      ''
    )
    ON CONFLICT (email) DO NOTHING;
  EXCEPTION WHEN insufficient_privilege THEN
    RAISE NOTICE 'No se pudo crear auth.users via SQL (privilegios insuficientes). Crear manualmente desde Supabase Dashboard > Authentication > Users: email=demo@symvora.com, email_confirm=true. Despues ejecutar: SELECT public.reset_demo_tenant();';
  END;
END $$;

-- Identity row (necesaria para que auth.users funcione correctamente)
DO $$
BEGIN
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  )
  SELECT
    gen_random_uuid(),
    u.id,
    jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
    'email',
    u.id::text,
    NOW(),
    NOW(),
    NOW()
  FROM auth.users u
  WHERE u.email = 'demo@symvora.com'
    AND NOT EXISTS (
      SELECT 1 FROM auth.identities i
      WHERE i.user_id = u.id AND i.provider = 'email'
    );
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'No se pudo crear auth.identities (privilegios insuficientes).';
END $$;

-- Seed inicial: solo si el tenant demo NO existe aun
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE subdominio = 'abarrotes-don-pedro'
  ) THEN
    BEGIN
      PERFORM public.reset_demo_tenant();
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'reset_demo_tenant() fallo durante el seed inicial (%). Se creara lazy en la primera llamada del API.', SQLERRM;
    END;
  END IF;
END $$;
