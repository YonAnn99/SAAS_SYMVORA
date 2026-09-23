-- 086: una caja abierta por usuario Y SUCURSAL.
--
-- El dueño puede cobrar en otro local sin cerrar el turno del suyo: si va a
-- Norte, abre (o retoma) SU caja de Norte y la de Principal sigue abierta. Cada
-- venta hereda la sucursal de la caja con la que se cobra
-- (`_crear_venta_desde_items`, p_caja_id) y el dinero entra en ESA caja, asi que
-- el corte de cada local solo cuenta lo que se cobro ahi.
--
-- Esto exige tres cosas en la base:
--   1. Que no haya cajas abiertas sin sucursal en un negocio de varios locales.
--      El dialogo de abrir caja podia mandarla vacia si se abria antes de cargar
--      las sucursales; con NULL no se sabe a que corte pertenece el dinero.
--   2. Que el trigger lo rechace de aqui en adelante (con 2+ sucursales).
--   3. Que no pueda haber DOS abiertas del mismo usuario en el mismo local (un
--      doble clic en "Abrir caja" las duplicaba y el POS cobraba en una
--      cualquiera).
--
-- Los totales de cada corte se filtran por la sucursal de la caja en la
-- aplicacion (fetchVentasTotal / fetchVentasTotalForAutoClose): con dos cajas
-- abiertas a la vez, "ventas del usuario desde la apertura" contaba las dos.

-- 1. Datos: las abiertas sin sucursal van al local por defecto del negocio. Sin
--    usuario en sesion el trigger no interviene (auth.uid() es NULL aqui).
UPDATE public.cajas c
SET sucursal_id = public._sucursal_por_defecto(c.tenant_id)
WHERE c.estado = 'ABIERTA'
  AND c.sucursal_id IS NULL;

-- 2. Abrir caja sin sucursal solo se admite cuando no hay nada que elegir.
CREATE OR REPLACE FUNCTION public._caja_en_sucursal_permitida()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_permitidas UUID[];
BEGIN
  -- Procesos del sistema (cierre automatico con service_role): sin usuario.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT array_agg(s.id) INTO v_permitidas
  FROM public.sucursales s
  WHERE s.tenant_id = NEW.tenant_id AND s.activa
    AND s.id IN (SELECT public.mis_sucursales());

  IF NEW.sucursal_id IS NULL THEN
    IF COALESCE(array_length(v_permitidas, 1), 0) = 1 THEN
      NEW.sucursal_id := v_permitidas[1];
    ELSIF COALESCE(array_length(v_permitidas, 1), 0) > 1 THEN
      RAISE EXCEPTION 'Elige en qué sucursal abres la caja';
    END IF;
    RETURN NEW;
  END IF;

  IF NOT (NEW.sucursal_id = ANY (COALESCE(v_permitidas, '{}'))) THEN
    RAISE EXCEPTION 'No puedes abrir caja en una sucursal que no tienes asignada';
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Una abierta por usuario y local. NULLS NOT DISTINCT: en un negocio sin
--    sucursales (no deberia quedar ninguno, migracion 081) sigue valiendo "una
--    caja abierta por usuario", como antes.
CREATE UNIQUE INDEX IF NOT EXISTS uq_cajas_abierta_usuario_sucursal
  ON public.cajas (tenant_id, usuario_id, sucursal_id) NULLS NOT DISTINCT
  WHERE estado = 'ABIERTA';
