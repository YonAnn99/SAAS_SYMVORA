-- ===========================================================================
-- 104 — Unidad de medida propia por variante
-- ===========================================================================
--
-- Hasta ahora la unidad era del PRODUCTO y todas sus variantes la compartian.
-- Una variante puede venderse distinto (Coca Cola 600 ml por pieza, la de
-- 2.5 L por paquete; tela por metro y el rollo por pieza), asi que puede
-- tener la suya.
--
-- NULL = usa la del producto: las variantes existentes no cambian. La interfaz
-- resuelve siempre `variante.unidad_medida ?? producto.unidad_medida`
-- (`unidadDeVenta` en src/lib/unidades.ts), y el POS decide con ella si pide
-- cantidad (granel) o suma piezas.
--
-- La tabla ya tiene RLS con `authorize()`; una columna nueva no pide politica.

ALTER TABLE public.variantes_producto
  ADD COLUMN IF NOT EXISTS unidad_medida public.unidad_medida;

COMMENT ON COLUMN public.variantes_producto.unidad_medida IS
  'Unidad de venta de la variante. NULL = la del producto.';

-- El detalle de una venta (reimpresion e historial) muestra la unidad de la
-- variante si tiene, no la del producto. Misma firma (jsonb): CREATE OR REPLACE
-- conserva los permisos. Cuerpo igual a la migracion 101 salvo `unidad_medida`.
CREATE OR REPLACE FUNCTION public.detalle_venta(p_venta_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_venta RECORD;
  v_resultado jsonb;
BEGIN
  SELECT v.*, u.email::text AS cajero_email,
         public.nombre_de_usuario(u.raw_user_meta_data) AS cajero_nombre,
         c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
  INTO v_venta
  FROM public.ventas v
  LEFT JOIN auth.users u ON u.id = v.usuario_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE v.id = p_venta_id;

  IF v_venta.id IS NULL THEN
    RAISE EXCEPTION 'Venta no encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_venta.tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  IF NOT public.authorize('sales.view_all') AND v_venta.usuario_id <> v_uid THEN
    RAISE EXCEPTION 'Solo puedes consultar tus propias ventas';
  END IF;

  IF v_venta.sucursal_id IS NOT NULL
     AND v_venta.sucursal_id NOT IN (SELECT public.mis_sucursales()) THEN
    RAISE EXCEPTION 'Esa venta es de una sucursal que no tienes asignada';
  END IF;

  SELECT jsonb_build_object(
    'id', v_venta.id,
    'fecha_venta', v_venta.fecha_venta,
    'usuario_id', v_venta.usuario_id,
    'cajero_email', v_venta.cajero_email,
    'cajero_nombre', v_venta.cajero_nombre,
    'cliente_nombre', v_venta.cliente_nombre,
    'cliente_telefono', v_venta.cliente_telefono,
    'metodo_pago', v_venta.metodo_pago,
    'estado', v_venta.estado,
    'subtotal', v_venta.subtotal,
    'impuesto', v_venta.impuesto,
    'descuento', v_venta.descuento,
    'total', v_venta.total,
    'monto_recibido', v_venta.monto_recibido,
    'cambio', v_venta.cambio,
    'notas', v_venta.notas,
    'origen', v_venta.origen,
    'requiere_revision', v_venta.requiere_revision,
    'renglones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'producto_id', d.producto_id,
        'variante_id', d.variante_id,
        'nombre', COALESCE(p.nombre, 'Producto eliminado'),
        'unidad_medida', COALESCE(va.unidad_medida::text, p.unidad_medida::text, 'PIEZA'),
        'talla', va.talla,
        'color', va.color,
        'cantidad', d.cantidad,
        'precio_unitario', d.precio_unitario,
        'descuento', d.descuento,
        'subtotal', d.subtotal
      ) ORDER BY p.nombre NULLS LAST)
      FROM public.detalle_ventas d
      LEFT JOIN public.productos p ON p.id = d.producto_id
      LEFT JOIN public.variantes_producto va ON va.id = d.variante_id
      WHERE d.venta_id = v_venta.id
    ), '[]'::jsonb)
  ) INTO v_resultado;

  RETURN v_resultado;
END;
$function$;
