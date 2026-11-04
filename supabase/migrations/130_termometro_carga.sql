-- 130: «termometro de carga» en el resumen interno diario (correo a hola@).
--
-- Agrega la clave `carga` al jsonb de `resumen_interno_diario()` (migracion
-- 123) para ver venir el primer techo del plan de Supabase antes de llegar:
--   ventas_24h, negocios_con_venta, ventas_pico_minuto y cajeros_pico_hora
--   (usuarios distintos vendiendo en la misma hora). Ultimas 24 h, sin demos.
-- Aditiva: el cron ya desplegado ignora la clave nueva. El resto del cuerpo es
-- identico al de la 123.

CREATE OR REPLACE FUNCTION public.resumen_interno_diario()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
WITH reales AS (
  SELECT t.id, t.nombre_comercial, t.giro_comercial, t.creado_en
  FROM public.tenants t
  WHERE t.demo_expira_en IS NULL
    -- El demo compartido viejo ("Abarrotes Don Pedro", demo@symvora.com) no
    -- tiene `demo_expira_en`: se reconoce por su usuario marcado `is_demo`.
    AND NOT EXISTS (
      SELECT 1
      FROM public.tenant_memberships m
      JOIN auth.users u ON u.id = m.user_id
      WHERE m.tenant_id = t.id
        AND COALESCE(u.raw_app_meta_data ->> 'is_demo', 'false') = 'true'
    )
),
duenos AS (
  SELECT DISTINCT ON (m.tenant_id)
    m.tenant_id,
    u.email,
    public.nombre_de_usuario(u.raw_user_meta_data) AS nombre,
    c.telefono,
    u.raw_app_meta_data ->> 'provider' AS proveedor
  FROM public.tenant_memberships m
  JOIN auth.users u ON u.id = m.user_id
  LEFT JOIN public.contacto_usuarios c ON c.user_id = u.id
  WHERE m.role = 'SUPER_ADMIN'
  ORDER BY m.tenant_id, m.creado_en
),
sus AS (
  SELECT DISTINCT ON (s.tenant_id) s.*
  FROM public.subscriptions s
  ORDER BY s.tenant_id, s.created_at DESC
),
prod AS (
  SELECT p.tenant_id, count(*) AS n
  FROM public.productos p
  WHERE p.archivado_en IS NULL
  GROUP BY p.tenant_id
),
ven AS (
  SELECT v.tenant_id, max(v.fecha_venta) AS ultima, count(*) AS n
  FROM public.ventas v
  WHERE v.estado = 'COMPLETADA'
  GROUP BY v.tenant_id
),
negocios AS (
  SELECT
    r.id, r.nombre_comercial, r.giro_comercial, r.creado_en,
    d.email, d.nombre, d.telefono, d.proveedor,
    s.status, s.trial_end,
    COALESCE(p.n, 0) AS productos,
    COALESCE(v.n, 0) AS ventas,
    v.ultima
  FROM reales r
  LEFT JOIN duenos d ON d.tenant_id = r.id
  LEFT JOIN sus s ON s.tenant_id = r.id
  LEFT JOIN prod p ON p.tenant_id = r.id
  LEFT JOIN ven v ON v.tenant_id = r.id
),
vigentes AS (
  SELECT * FROM negocios WHERE status IN ('trial', 'active', 'past_due')
),
carga_ventas AS (
  -- Toda venta registrada cuenta como carga, sin importar su estado.
  SELECT v.tenant_id, v.usuario_id, v.fecha_venta
  FROM public.ventas v
  JOIN reales r ON r.id = v.tenant_id
  WHERE v.fecha_venta >= now() - interval '24 hours'
),
incompletos AS (
  -- Registro con correo que no termino: el borrador del formulario.
  SELECT
    rp.nombre, rp.negocio, rp.telefono AS celular, rp.email AS correo,
    rp.creado_en, 'correo'::text AS origen
  FROM public.registros_pendientes rp
  WHERE rp.estado = 'borrador'
    AND rp.creado_en >= now() - interval '3 days'
  UNION ALL
  -- Entraron (p. ej. con Google) y nunca crearon su negocio. Sin demos y sin
  -- los que ya aparecen arriba por su borrador.
  SELECT
    public.nombre_de_usuario(u.raw_user_meta_data), NULL, NULL, u.email,
    u.created_at, COALESCE(u.raw_app_meta_data ->> 'provider', 'correo')
  FROM auth.users u
  WHERE u.created_at >= now() - interval '3 days'
    AND COALESCE(u.raw_app_meta_data ->> 'is_demo', 'false') <> 'true'
    AND NOT EXISTS (SELECT 1 FROM public.tenant_memberships m WHERE m.user_id = u.id)
    AND NOT EXISTS (
      SELECT 1 FROM public.registros_pendientes rp
      WHERE rp.estado = 'borrador' AND lower(rp.email) = lower(u.email)
    )
)
SELECT jsonb_build_object(
  'generado_en', now(),

  'carga', jsonb_build_object(
    'ventas_24h', (SELECT count(*) FROM carga_ventas),
    'negocios_con_venta', (SELECT count(DISTINCT c.tenant_id) FROM carga_ventas c),
    'ventas_pico_minuto', COALESCE((
      SELECT max(x.n) FROM (
        SELECT count(*) AS n FROM carga_ventas c GROUP BY date_trunc('minute', c.fecha_venta)
      ) x
    ), 0),
    'cajeros_pico_hora', COALESCE((
      SELECT max(x.n) FROM (
        SELECT count(DISTINCT c.usuario_id) AS n FROM carga_ventas c GROUP BY date_trunc('hour', c.fecha_venta)
      ) x
    ), 0)
  ),

  'nuevos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', n.nombre_comercial, 'giro', n.giro_comercial,
      'dueno', n.nombre, 'correo', n.email, 'celular', n.telefono,
      'origen', n.proveedor, 'creado_en', n.creado_en
    ) ORDER BY n.creado_en DESC)
    FROM negocios n
    WHERE n.creado_en >= now() - interval '24 hours'
  ), '[]'::jsonb),

  'incompletos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'nombre', i.nombre, 'negocio', i.negocio, 'celular', i.celular,
      'correo', i.correo, 'origen', i.origen, 'creado_en', i.creado_en
    ) ORDER BY i.creado_en DESC)
    FROM incompletos i
  ), '[]'::jsonb),

  'sin_productos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', n.nombre_comercial, 'giro', n.giro_comercial,
      'dueno', n.nombre, 'correo', n.email, 'celular', n.telefono,
      'estatus', n.status, 'creado_en', n.creado_en
    ) ORDER BY n.creado_en DESC)
    FROM vigentes n
    WHERE n.productos = 0
      AND n.creado_en < now() - interval '2 days'
  ), '[]'::jsonb),

  -- Con productos (los sin productos van en su lista) y: nunca vendio tras 3
  -- dias, o su ultima venta fue hace mas de 7.
  'inactivos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', n.nombre_comercial, 'giro', n.giro_comercial,
      'dueno', n.nombre, 'correo', n.email, 'celular', n.telefono,
      'estatus', n.status, 'productos', n.productos, 'ventas', n.ventas,
      'ultima_venta', n.ultima, 'creado_en', n.creado_en
    ) ORDER BY COALESCE(n.ultima, n.creado_en))
    FROM vigentes n
    WHERE n.productos > 0
      AND (
        (n.ventas = 0 AND n.creado_en < now() - interval '3 days')
        OR n.ultima < now() - interval '7 days'
      )
  ), '[]'::jsonb),

  'por_vencer', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', n.nombre_comercial, 'dueno', n.nombre, 'correo', n.email,
      'celular', n.telefono, 'productos', n.productos, 'ventas', n.ventas,
      'trial_end', n.trial_end
    ) ORDER BY n.trial_end)
    FROM negocios n
    WHERE n.status = 'trial'
      AND n.trial_end BETWEEN now() AND now() + interval '3 days'
  ), '[]'::jsonb),

  'pagos', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', r.nombre_comercial, 'monto', ph.amount,
      'metodo', ph.payment_method, 'pagado_en', ph.paid_at
    ) ORDER BY ph.paid_at DESC)
    FROM public.payment_history ph
    JOIN public.subscriptions s ON s.id = ph.subscription_id
    JOIN reales r ON r.id = s.tenant_id
    WHERE ph.status = 'completed'
      AND ph.amount > 0
      AND ph.paid_at >= now() - interval '24 hours'
  ), '[]'::jsonb),

  'vencidos_cancelados', COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'negocio', n.nombre_comercial, 'dueno', n.nombre, 'correo', n.email,
      'celular', n.telefono,
      'motivo', CASE WHEN s.status = 'canceled' THEN 'cancelada' ELSE 'pago_vencido' END,
      'fecha', CASE WHEN s.status = 'canceled' THEN s.updated_at ELSE s.past_due_desde END
    ))
    FROM sus s
    JOIN negocios n ON n.id = s.tenant_id
    WHERE (s.status = 'canceled' AND s.updated_at >= now() - interval '24 hours')
       OR (s.status = 'past_due' AND s.past_due_desde >= now() - interval '24 hours')
  ), '[]'::jsonb)
);
$$;

REVOKE ALL ON FUNCTION public.resumen_interno_diario() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resumen_interno_diario() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resumen_interno_diario() TO service_role;

COMMENT ON FUNCTION public.resumen_interno_diario() IS
  'Resumen diario interno (correo a hola@): carga de 24 h, nuevos, incompletos, sin productos, inactivos, por vencer, pagos y vencidos/cancelados. Sin demos. Solo service_role.';
