-- =============================================
-- 129: estado de cuenta del cliente y filtro por cliente en el Historial
-- =============================================
-- Sugerencia de un cliente real (2026-10-31): «si mi cliente me debe $2,000,
-- ¿como reviso el ticket o el historial de lo que me debe?». Habia saldo y
-- boton de abonar, pero ni las ventas fiadas ni los abonos se listaban.
--
-- Solo lectura, sin tablas nuevas:
-- 1. `listar_ventas` suma `p_cliente_id` (al final, DEFAULT NULL). Agregar un
--    parametro cambia la firma: con CREATE OR REPLACE quedarian dos versiones y
--    PostgREST no sabria cual usar con 7 argumentos. Por eso DROP de la firma
--    vieja + CREATE, con sus permisos reaplicados. Las pestañas abiertas siguen
--    llamando con 7 argumentos y caen en el DEFAULT.
-- 2. `estado_cuenta_cliente`: saldo, ventas a credito y abonos de un cliente,
--    con la MISMA regla de visibilidad que el Historial (`sales.view_all` o
--    solo las propias; solo sucursales asignadas).

DROP FUNCTION IF EXISTS public.listar_ventas(uuid, timestamp with time zone, timestamp with time zone, uuid, integer, integer, uuid);

CREATE FUNCTION public.listar_ventas(
  p_tenant_id uuid,
  p_desde timestamp with time zone,
  p_hasta timestamp with time zone,
  p_cajero_id uuid DEFAULT NULL::uuid,
  p_limite integer DEFAULT 50,
  p_desplazamiento integer DEFAULT 0,
  p_sucursal_id uuid DEFAULT NULL::uuid,
  p_cliente_id uuid DEFAULT NULL::uuid
)
 RETURNS TABLE(id uuid, fecha_venta timestamp with time zone, usuario_id uuid, cajero_email text, cliente_nombre text, metodo_pago metodo_pago, estado estado_venta, total numeric, origen text, requiere_revision boolean, sucursal_nombre text, cajero_nombre text, total_filas bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ve_todas BOOLEAN;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = p_tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  v_ve_todas := public.authorize('sales.view_all');

  RETURN QUERY
  SELECT v.id,
         v.fecha_venta,
         v.usuario_id,
         u.email::text,
         c.nombre,
         v.metodo_pago,
         v.estado,
         v.total,
         v.origen,
         v.requiere_revision,
         s.nombre,
         public.nombre_de_usuario(u.raw_user_meta_data),
         COUNT(*) OVER () AS total_filas
  FROM public.ventas v
  LEFT JOIN auth.users u ON u.id = v.usuario_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  LEFT JOIN public.sucursales s ON s.id = v.sucursal_id
  WHERE v.tenant_id = p_tenant_id
    AND v.fecha_venta >= p_desde
    AND v.fecha_venta <= p_hasta
    AND (v_ve_todas OR v.usuario_id = v_uid)
    AND (p_cajero_id IS NULL OR NOT v_ve_todas OR v.usuario_id = p_cajero_id)
    -- NULL = todas. Acota la consulta, no concede nada.
    AND (p_sucursal_id IS NULL OR v.sucursal_id = p_sucursal_id)
    -- Las compras de un cliente (129). Tambien solo acota.
    AND (p_cliente_id IS NULL OR v.cliente_id = p_cliente_id)
    -- Solo las sucursales asignadas al usuario (migracion 085).
    AND (v.sucursal_id IS NULL OR v.sucursal_id IN (SELECT public.mis_sucursales()))
  ORDER BY v.fecha_venta DESC
  LIMIT GREATEST(p_limite, 1)
  OFFSET GREATEST(p_desplazamiento, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_ventas(uuid, timestamp with time zone, timestamp with time zone, uuid, integer, integer, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_ventas(uuid, timestamp with time zone, timestamp with time zone, uuid, integer, integer, uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.estado_cuenta_cliente(p_cliente_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_cliente public.clientes;
  v_ve_todas BOOLEAN;
  v_ventas jsonb;
  v_abonos jsonb;
BEGIN
  SELECT * INTO v_cliente FROM public.clientes WHERE id = p_cliente_id;
  IF v_cliente.id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = v_cliente.tenant_id AND tm.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  v_ve_todas := public.authorize('sales.view_all');

  SELECT COALESCE(jsonb_agg(f ORDER BY (f->>'fecha')::timestamptz DESC), '[]'::jsonb)
  INTO v_ventas
  FROM (
    SELECT jsonb_build_object(
             'id', v.id,
             'fecha', v.fecha_venta,
             'total', v.total,
             'estado', v.estado,
             'cajero', NULLIF(public.nombre_de_usuario(u.raw_user_meta_data), ''),
             'sucursal', s.nombre
           ) AS f
    FROM public.ventas v
    LEFT JOIN auth.users u ON u.id = v.usuario_id
    LEFT JOIN public.sucursales s ON s.id = v.sucursal_id
    WHERE v.tenant_id = v_cliente.tenant_id
      AND v.cliente_id = p_cliente_id
      AND v.metodo_pago = 'CREDITO'
      AND (v_ve_todas OR v.usuario_id = v_uid)
      AND (v.sucursal_id IS NULL OR v.sucursal_id IN (SELECT public.mis_sucursales()))
    ORDER BY v.fecha_venta DESC
    LIMIT 200
  ) x;

  SELECT COALESCE(jsonb_agg(f ORDER BY (f->>'fecha')::timestamptz DESC), '[]'::jsonb)
  INTO v_abonos
  FROM (
    SELECT jsonb_build_object(
             'id', p.id,
             'fecha', p.creado_en,
             'monto', p.monto,
             'metodo_pago', p.metodo_pago,
             'notas', p.notas,
             'registro', NULLIF(public.nombre_de_usuario(u.raw_user_meta_data), '')
           ) AS f
    FROM public.pagos_credito p
    LEFT JOIN auth.users u ON u.id = p.usuario_id
    WHERE p.tenant_id = v_cliente.tenant_id
      AND p.cliente_id = p_cliente_id
    ORDER BY p.creado_en DESC
    LIMIT 200
  ) x;

  RETURN jsonb_build_object(
    'cliente', jsonb_build_object(
      'id', v_cliente.id,
      'nombre', v_cliente.nombre,
      'saldo_pendiente', v_cliente.saldo_pendiente,
      'limite_credito', v_cliente.limite_credito
    ),
    'ventas', v_ventas,
    'abonos', v_abonos,
    'ventas_parciales', NOT v_ve_todas
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.estado_cuenta_cliente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estado_cuenta_cliente(uuid) TO authenticated, service_role;
