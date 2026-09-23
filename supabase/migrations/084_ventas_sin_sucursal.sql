-- =============================================
-- 084: las ventas que quedaron sin sucursal entre la 080 y la 082
-- ---------------------------------------------
-- Entre esas dos migraciones, una venta cobrada sin caja explicita guardaba
-- `sucursal_id = NULL`, pero su stock SI se descontaba: `mover_stock(NULL, …)`
-- lo apuntaba al local por defecto del negocio. La 082 cerro el hueco (la venta
-- ya nunca queda sin local). Esto pone a esas ventas el local del que de verdad
-- salio su mercancia, para que la comparativa por sucursal cuadre.
--
-- No es inventar el dato: es el mismo criterio que uso `mover_stock` en su
-- momento, asi que venta y existencias vuelven a contar la misma historia.
-- Afecto a una sola venta, en el negocio de pruebas.
-- =============================================

UPDATE public.ventas v
SET sucursal_id = public._sucursal_por_defecto(v.tenant_id)
WHERE v.sucursal_id IS NULL;
