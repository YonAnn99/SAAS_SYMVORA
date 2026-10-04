-- ===========================================================================
-- 101 — Nombre de los usuarios del negocio
-- ===========================================================================
--
-- El dueño invita a cajeros y administradores con nombre y apellido (opcional),
-- y los ve por nombre en Usuarios y en el historial de ventas, no solo por
-- correo.
--
-- 1. `user_invite_keys` guarda el nombre capturado al invitar: la cuenta se crea
--    despues, en `/api/auth/key-login`, que lo copia a `user_metadata.nombre`.
-- 2. `nombre_de_usuario(meta)`: la misma lectura que `nombreCompleto()` en
--    `src/lib/nombre-usuario.ts` (Mi perfil → registro → Google).
-- 3. `get_tenant_members`, `listar_ventas` y `detalle_venta` devuelven ese
--    nombre junto al correo. Las dos primeras cambian su RETURNS TABLE, asi que
--    van con DROP + CREATE y se reaplican sus permisos. La regla de quien ve que
--    no cambia: el cuerpo es el mismo, solo con la columna nueva.

-- ---------------------------------------------------------------------------
-- 1. Nombre en la invitacion
-- ---------------------------------------------------------------------------
-- La tabla ya tiene RLS y sus politicas de escritura con `authorize()`
-- (migracion 054a); columnas nuevas no necesitan otra.
ALTER TABLE public.user_invite_keys
  ADD COLUMN IF NOT EXISTS nombre TEXT
    CHECK (nombre IS NULL OR char_length(nombre) BETWEEN 1 AND 60),
  ADD COLUMN IF NOT EXISTS apellido TEXT
    CHECK (apellido IS NULL OR char_length(apellido) BETWEEN 1 AND 60);

-- ---------------------------------------------------------------------------
-- 2. Lectura unica del nombre
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.nombre_de_usuario(p_meta JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    NULLIF(btrim(p_meta ->> 'nombre_completo'), ''),
    NULLIF(btrim(p_meta ->> 'nombre'), ''),
    NULLIF(btrim(p_meta ->> 'full_name'), '')
  );
$function$;

-- Solo la usan las funciones SECURITY DEFINER de abajo (corren como su dueño).
REVOKE ALL ON FUNCTION public.nombre_de_usuario(JSONB) FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3a. Miembros del negocio con su nombre
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.get_tenant_members(UUID);

CREATE FUNCTION public.get_tenant_members(p_tenant_id UUID)
 RETURNS TABLE(id uuid, tenant_id uuid, user_id uuid, role app_role, creado_en timestamp with time zone, user_email text, user_nombre text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tm.id, tm.tenant_id, tm.user_id, tm.role, tm.creado_en,
         u.email AS user_email,
         public.nombre_de_usuario(u.raw_user_meta_data) AS user_nombre
  FROM public.tenant_memberships tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tenant_id = p_tenant_id
    -- Sin esto, cualquiera lee el personal de cualquier negocio (migracion 070).
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships propio
      WHERE propio.tenant_id = p_tenant_id
        AND propio.user_id = (SELECT auth.uid())
    )
  ORDER BY tm.creado_en DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_tenant_members(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_members(UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3b. Historial de ventas con el nombre de quien cobro
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER, UUID);

CREATE FUNCTION public.listar_ventas(
  p_tenant_id uuid,
  p_desde timestamp with time zone,
  p_hasta timestamp with time zone,
  p_cajero_id uuid DEFAULT NULL::uuid,
  p_limite integer DEFAULT 50,
  p_desplazamiento integer DEFAULT 0,
  p_sucursal_id uuid DEFAULT NULL::uuid
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
    -- Solo las sucursales asignadas al usuario (migracion 085).
    AND (v.sucursal_id IS NULL OR v.sucursal_id IN (SELECT public.mis_sucursales()))
  ORDER BY v.fecha_venta DESC
  LIMIT GREATEST(p_limite, 1)
  OFFSET GREATEST(p_desplazamiento, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_ventas(UUID, TIMESTAMPTZ, TIMESTAMPTZ, UUID, INTEGER, INTEGER, UUID) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3c. Detalle de una venta: misma firma (jsonb), solo una clave nueva
-- ---------------------------------------------------------------------------
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
        'unidad_medida', COALESCE(p.unidad_medida::text, 'PIEZA'),
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
