-- =============================================
-- 081: todo negocio nace con su sucursal `Principal`
-- ---------------------------------------------
-- EL FALLO QUE CIERRA, Y QUE ABRIO LA 078. Desde que las existencias viven en
-- `stock_sucursal`, TODO movimiento de stock necesita un local donde apuntarse.
-- La 078 creo `Principal` para los negocios que ya existian, pero nada creaba
-- uno para los que se registran despues. El siguiente negocio nuevo habria:
--
--   - fallado al COBRAR: su caja no tiene sucursal, `mover_stock` busca la mas
--     antigua del negocio, no encuentra ninguna y lanza error;
--   - fallado al dar de alta un producto con existencias iniciales, por el
--     mismo camino (la capa de compatibilidad de la 080).
--
-- No llego a disparar: el ultimo registro es anterior a la 078. Pero era una
-- trampa armada para el primer cliente nuevo.
--
-- POR QUE UN TRIGGER EN `tenants` Y NO UNA LINEA EN `complete_onboarding`. Hay
-- mas de un camino que crea negocios (el onboarding, `reset_demo_tenant`, y los
-- que se añadan mañana). Colgarlo de la tabla lo cubre a todos sin tener que
-- acordarse de cada uno.
-- =============================================

BEGIN;

CREATE OR REPLACE FUNCTION public._crear_sucursal_principal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $fn$
BEGIN
  INSERT INTO public.sucursales (tenant_id, nombre, direccion)
  VALUES (NEW.id, 'Principal', NEW.direccion)
  ON CONFLICT (tenant_id, nombre) DO NOTHING;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_tenants_sucursal_principal ON public.tenants;
CREATE TRIGGER trg_tenants_sucursal_principal
  AFTER INSERT ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public._crear_sucursal_principal();

-- Por si alguno se colo entre la 078 y esta.
INSERT INTO public.sucursales (tenant_id, nombre, direccion)
SELECT t.id, 'Principal', t.direccion
FROM public.tenants t
WHERE NOT EXISTS (SELECT 1 FROM public.sucursales s WHERE s.tenant_id = t.id)
ON CONFLICT (tenant_id, nombre) DO NOTHING;

COMMIT;
