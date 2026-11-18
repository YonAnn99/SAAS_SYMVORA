-- =============================================
-- 138: ventas y sus renglones solo se escriben por las funciones del sistema
-- =============================================
-- Hueco encontrado al hacer la 137 (cancelar y corregir ventas). La RLS
-- permitía, sin pasar por ninguna validación:
--   * `ventas`: INSERT con `sales.create` (cualquier cajero creaba una venta
--     con el total que quisiera) y UPDATE/DELETE con `sales.void` (cambiar el
--     total de un ticket ya cobrado o borrarlo sin regresar stock ni caja);
--   * `detalle_ventas`: INSERT/UPDATE/DELETE con `sales.create` (cualquier
--     cajero cambiaba precios o cantidades de renglones ya cobrados).
-- Ninguna pantalla lo hacía: todas las escrituras van por funciones
-- `SECURITY DEFINER` (dueño postgres, que no pasa por RLS):
-- `_crear_venta_desde_items` (complete_sale, complete_sale_lealtad, terminal),
-- `_cancelar_venta`/`corregir_venta` (137), `update_venta_factura_link`, y las
-- de demo y baja de cuenta. El servidor usa service_role, que tampoco.
--
-- Sin políticas de escritura, `authenticated` solo LEE (las de SELECT quedan
-- igual). Probado en transacción revertida: cobrar y cancelar siguen; UPDATE y
-- DELETE directos afectan 0 filas e INSERT se rechaza.
--
-- Si algún día una pantalla necesita escribir aquí, que sea con una función
-- nueva, no reabriendo estas políticas.

DROP POLICY IF EXISTS ventas_insert ON public.ventas;
DROP POLICY IF EXISTS ventas_update ON public.ventas;
DROP POLICY IF EXISTS ventas_delete ON public.ventas;

DROP POLICY IF EXISTS detalle_ventas_insert ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_update ON public.detalle_ventas;
DROP POLICY IF EXISTS detalle_ventas_delete ON public.detalle_ventas;
