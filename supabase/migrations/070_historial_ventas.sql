-- =============================================
-- 070: Historial de ventas y reimpresion de tickets
-- ---------------------------------------------
-- Hasta ahora, cobrada una venta no habia forma de volver a verla: el ticket
-- existia solo el instante posterior al cobro. Los DATOS ya estaban todos
-- (`ventas` guarda el cajero, la fecha y los importes; `detalle_ventas` los
-- renglones con su variante); lo que faltaba era poder consultarlos.
--
-- LA REGLA DE VISIBILIDAD, decidida con el dueno: un CAJERO ve y reimprime
-- SOLO sus propias ventas; el dueno y el administrador ven las de todos.
--
-- POR QUE ESTA EN RPC Y NO EN LA PANTALLA. La politica de lectura de `ventas`
-- es solo `tenant_id IN (user_tenant_ids())`: cualquier miembro puede leer
-- TODAS las ventas del negocio, y lo unico que hoy lo impedia era que no
-- existiera pantalla. Filtrar al pintar seria un adorno: bastaria una peticion
-- a mano para sacar las ventas ajenas. La regla vive aqui, del lado del
-- servidor, donde no se puede esquivar.
--
-- POR QUE NO SE TOCA LA POLITICA DE `ventas`. Endurecerla afectaria tambien a
-- los agregados de Reportes, al Dashboard y al calculo de ganancia, que hoy
-- leen todas las ventas del negocio. El dueno decidio acotar SOLO el historial
-- nuevo. Queda anotado que un cajero sigue viendo la facturacion total del
-- negocio en las tarjetas de Reportes.
-- =============================================

-- ---------------------------------------------------------------------------
-- 1. FUGA DE DATOS ENTRE NEGOCIOS (anterior a este trabajo)
-- ---------------------------------------------------------------------------
--
-- `get_tenant_members` es SECURITY DEFINER, la puede llamar cualquier usuario
-- autenticado, y filtraba SOLO por el tenant que le pasan por parametro, sin
-- comprobar que quien llama pertenezca a el. Es decir: cualquier usuario de
-- cualquier negocio podia pedir los miembros de otro y obtener sus correos y
-- sus roles.
--
-- Comprobado antes de corregirlo: un CAJERO del negocio "jona prueba" pidio los
-- miembros de "Pruebas SYMVORA" y obtuvo 3 filas con correos reales.
--
-- La correccion es el EXISTS de abajo. Va con CREATE OR REPLACE y la misma
-- firma para conservar sus permisos (authenticated, service_role).
CREATE OR REPLACE FUNCTION public.get_tenant_members(p_tenant_id uuid)
 RETURNS TABLE(id uuid, tenant_id uuid, user_id uuid, role app_role, creado_en timestamp with time zone, user_email text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT tm.id, tm.tenant_id, tm.user_id, tm.role, tm.creado_en,
         u.email AS user_email
  FROM public.tenant_memberships tm
  JOIN auth.users u ON u.id = tm.user_id
  WHERE tm.tenant_id = p_tenant_id
    -- Sin esto, cualquiera lee el personal de cualquier negocio.
    AND EXISTS (
      SELECT 1 FROM public.tenant_memberships propio
      WHERE propio.tenant_id = p_tenant_id
        AND propio.user_id = (SELECT auth.uid())
    )
  ORDER BY tm.creado_en DESC;
$function$;

-- ---------------------------------------------------------------------------
-- 2. EL PERMISO `sales.view_all`
-- ---------------------------------------------------------------------------
--
-- Distingue "ver todas las ventas del negocio" de "ver las mias". El CAJERO ya
-- tenia `sales.view_reports`, asi que ese permiso no servia para separarlos.
--
-- `role_permissions.permission` es `text` sin restriccion, por eso basta el
-- INSERT. El CHECK de `user_permission_overrides` si es una lista cerrada y hay
-- que ampliarla, para que el dueno pueda concederselo a un encargado de
-- confianza igual que puede con el resto de permisos.
INSERT INTO public.role_permissions (role, permission)
VALUES ('SUPER_ADMIN', 'sales.view_all'),
       ('ORG_ADMIN',   'sales.view_all')
ON CONFLICT DO NOTHING;

ALTER TABLE public.user_permission_overrides
  DROP CONSTRAINT IF EXISTS user_permission_overrides_permission_check;

ALTER TABLE public.user_permission_overrides
  ADD CONSTRAINT user_permission_overrides_permission_check
  CHECK (permission = ANY (ARRAY[
    'sales.create', 'sales.view_reports', 'sales.void', 'sales.view_all',
    'inventory.view', 'inventory.manage', 'purchases.manage',
    'finances.manage', 'org.manage_settings',
    'billing.view', 'billing.create', 'billing.stamp', 'billing.cancel', 'billing.config'
  ]));

-- ---------------------------------------------------------------------------
-- 3. EL LISTADO
-- ---------------------------------------------------------------------------
--
-- Pagina en SERVIDOR (`p_limite` / `p_desplazamiento`). El reporte de agregados
-- ya se trunca a 5000 filas y avisa; traerse el historial entero al navegador
-- de un comercio con meses de ventas seria peor.
--
-- Devuelve `total_filas` en cada renglon (ventana sobre el conjunto completo)
-- para poder pintar el paginador sin una segunda consulta.
CREATE OR REPLACE FUNCTION public.listar_ventas(
  p_tenant_id uuid,
  p_desde timestamptz,
  p_hasta timestamptz,
  p_cajero_id uuid DEFAULT NULL,
  p_limite int DEFAULT 50,
  p_desplazamiento int DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  fecha_venta timestamptz,
  usuario_id uuid,
  cajero_email text,
  cliente_nombre text,
  metodo_pago metodo_pago,
  estado estado_venta,
  total numeric,
  origen text,
  requiere_revision boolean,
  total_filas bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_ve_todas BOOLEAN;
BEGIN
  -- Pertenencia al negocio. Sin esto, SECURITY DEFINER dejaria leer las ventas
  -- de cualquier tenant pasando su id, que es justo el fallo que tenia
  -- `get_tenant_members`.
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
         COUNT(*) OVER () AS total_filas
  FROM public.ventas v
  LEFT JOIN auth.users u ON u.id = v.usuario_id
  LEFT JOIN public.clientes c ON c.id = v.cliente_id
  WHERE v.tenant_id = p_tenant_id
    AND v.fecha_venta >= p_desde
    AND v.fecha_venta <= p_hasta
    -- La regla: sin `sales.view_all`, solo las propias.
    AND (v_ve_todas OR v.usuario_id = v_uid)
    -- El filtro por cajero solo tiene sentido para quien ve todas; a los demas
    -- se les ignora, no se les deja usarlo para sondear a otro.
    AND (p_cajero_id IS NULL OR NOT v_ve_todas OR v.usuario_id = p_cajero_id)
  ORDER BY v.fecha_venta DESC
  LIMIT GREATEST(p_limite, 1)
  OFFSET GREATEST(p_desplazamiento, 0);
END;
$function$;

REVOKE ALL ON FUNCTION public.listar_ventas(uuid, timestamptz, timestamptz, uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_ventas(uuid, timestamptz, timestamptz, uuid, int, int) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. EL DESGLOSE DE UNA VENTA
-- ---------------------------------------------------------------------------
--
-- Alimenta el detalle y la reimpresion del ticket. Aplica LA MISMA regla: un
-- cajero no puede abrir por id una venta ajena, aunque adivine el id.
--
-- El nombre del producto sale del catalogo ACTUAL: `detalle_ventas` no guarda
-- una copia del nombre al momento de vender. Si un producto se renombro, el
-- ticket reimpreso llevara el nombre nuevo; si se borro, sale "Producto
-- eliminado" en vez de una fila vacia. Decidido asi con el dueno.
CREATE OR REPLACE FUNCTION public.detalle_venta(p_venta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := (SELECT auth.uid());
  v_venta RECORD;
  v_resultado jsonb;
BEGIN
  SELECT v.*, u.email::text AS cajero_email, c.nombre AS cliente_nombre, c.telefono AS cliente_telefono
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

  SELECT jsonb_build_object(
    'id', v_venta.id,
    'fecha_venta', v_venta.fecha_venta,
    'usuario_id', v_venta.usuario_id,
    'cajero_email', v_venta.cajero_email,
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
        -- El producto pudo borrarse despues de venderse.
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

REVOKE ALL ON FUNCTION public.detalle_venta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.detalle_venta(uuid) TO authenticated, service_role;

-- Verificacion (ejecutar a mano tras aplicar):
--   Un usuario de OTRO negocio llamando a get_tenant_members -> 0 filas.
--   listar_ventas como CAJERO -> solo las suyas; como dueno -> todas.
--   detalle_venta de una venta ajena pedida por un cajero -> excepcion.
