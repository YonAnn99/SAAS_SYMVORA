-- 089: marca de "ya se aviso al dueño" en cada caja.
--
-- Cuando un cajero o un administrador cierra su caja, el SUPER_ADMIN recibe el
-- corte por correo (`/api/email/cierre-caja`). La llamada sale del navegador
-- justo despues de cerrar, y un navegador reintenta, recarga o se abre en dos
-- pestañas. Esta columna hace que el aviso salga UNA vez: el endpoint solo
-- envia si logra marcarla (`UPDATE ... WHERE aviso_cierre_enviado_en IS NULL`).
--
-- La marca solo la pone el servidor. Si el usuario pudiera escribirla, un
-- cajero podria ponerla antes de cerrar y el dueño nunca veria ese corte: el
-- trigger conserva el valor anterior en cualquier cambio que venga de una
-- sesion de usuario (auth.uid() presente). El endpoint usa service role.

ALTER TABLE public.cajas
  ADD COLUMN IF NOT EXISTS aviso_cierre_enviado_en TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public._aviso_cierre_solo_servidor()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.aviso_cierre_enviado_en := NULL;
  ELSE
    NEW.aviso_cierre_enviado_en := OLD.aviso_cierre_enviado_en;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_cajas_aviso_cierre_solo_servidor ON public.cajas;
CREATE TRIGGER trg_cajas_aviso_cierre_solo_servidor
  BEFORE INSERT OR UPDATE OF aviso_cierre_enviado_en ON public.cajas
  FOR EACH ROW EXECUTE FUNCTION public._aviso_cierre_solo_servidor();
