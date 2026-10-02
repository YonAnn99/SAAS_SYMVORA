-- =============================================
-- 099: Celular del usuario + seguimiento por WhatsApp
-- ---------------------------------------------
-- QUE HABILITA:
--   1. `contacto_usuarios`: el celular que se pide al crear la cuenta (con su
--      lada) y si la persona acepta avisos de su cuenta por WhatsApp.
--   2. `registros_pendientes`: borrador del registro que se guarda cuando ya
--      hay nombre, negocio y celular, para escribirle a quien no termino.
--   3. Marcas en `subscriptions` para los avisos de seguimiento (onboarding
--      atascado y pago abandonado), una vez cada uno.
--
-- Tabla aparte y no `user_metadata`: se consulta desde los cron y SQL, tiene
-- validacion en la base y guarda consentimiento y verificacion. Tampoco
-- `auth.users.phone`: Supabase lo reserva para entrar por SMS y cambiarlo
-- dispara un codigo.
-- =============================================

BEGIN;

-- ---------------------------------------------
-- 1. Contacto de cada usuario
-- ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacto_usuarios (
  user_id UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  -- E.164 con el "+": +525512345678.
  telefono TEXT NOT NULL CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  -- Pais de la lada elegida (MX, US...), para volver a mostrarla.
  pais CHAR(2) NOT NULL DEFAULT 'MX',
  avisos_whatsapp BOOLEAN NOT NULL DEFAULT true,
  consentimiento_en TIMESTAMPTZ,
  -- Se llena cuando se verifique el numero por codigo de WhatsApp.
  verificado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contacto_usuarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "contacto_usuarios_select" ON public.contacto_usuarios
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "contacto_usuarios_insert" ON public.contacto_usuarios
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- `verificado_en` no lo puede poner el propio usuario: lo protege el trigger.
CREATE POLICY "contacto_usuarios_update" ON public.contacto_usuarios
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Si cambia el telefono, la verificacion anterior ya no vale; y un cliente
-- nunca puede marcarse como verificado (solo la service role).
CREATE OR REPLACE FUNCTION public.contacto_usuarios_proteger()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.actualizado_en := NOW();
  -- Solo se protege lo que llega desde el cliente; service role y SQL directo
  -- (postgres) pueden marcar la verificacion.
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.verificado_en := NULL;
    ELSIF NEW.telefono IS DISTINCT FROM OLD.telefono THEN
      NEW.verificado_en := NULL;
    ELSE
      NEW.verificado_en := OLD.verificado_en;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacto_usuarios_proteger ON public.contacto_usuarios;
CREATE TRIGGER contacto_usuarios_proteger
  BEFORE INSERT OR UPDATE ON public.contacto_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.contacto_usuarios_proteger();

-- ---------------------------------------------
-- 2. Registros que se quedaron a medias
-- ---------------------------------------------
-- Solo la service role la toca (ruta /api/registro/borrador y el cron): RLS
-- activado y SIN politicas.
CREATE TABLE IF NOT EXISTS public.registros_pendientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telefono TEXT NOT NULL UNIQUE CHECK (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  email TEXT,
  nombre TEXT NOT NULL,
  negocio TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'completado', 'contactado')),
  whatsapp_enviado_en TIMESTAMPTZ,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_registros_pendientes_estado
  ON public.registros_pendientes(estado, actualizado_en);

ALTER TABLE public.registros_pendientes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------
-- 3. Marcas de seguimiento en la suscripcion
-- ---------------------------------------------
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS aviso_onboarding_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checkout_iniciado_en TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_pago_abandonado_en TIMESTAMPTZ;

COMMENT ON COLUMN public.subscriptions.aviso_onboarding_en IS
  'Cuando se envio el aviso de "aun no cargas productos / ventas" (una sola vez).';
COMMENT ON COLUMN public.subscriptions.checkout_iniciado_en IS
  'Ultima vez que el dueño abrio el pago en /billing (tarjeta o efectivo).';
COMMENT ON COLUMN public.subscriptions.aviso_pago_abandonado_en IS
  'Cuando se aviso del pago sin terminar; vale para el checkout_iniciado_en anterior.';

COMMIT;
