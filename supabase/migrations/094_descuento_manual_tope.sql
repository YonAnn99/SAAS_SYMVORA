-- 094_descuento_manual_tope.sql
-- Descuento manual a toda la compra desde el carrito del POS, con tope para
-- cajeros.
--
-- El descuento viaja como ya viajaba: repartido entre los renglones
-- (`p_items[].descuento`), que `_crear_venta_desde_items` ya topa por renglon
-- y descuenta ANTES de calcular el IVA. Lo nuevo es el tope:
--
-- 1. Permiso `sales.discount_unlimited` para SUPER_ADMIN y ORG_ADMIN. Un
--    cajero puede recibirlo con una excepcion por usuario (`authorize()` las
--    respeta).
-- 2. `_crear_venta_desde_items` acepta `p_tope_descuento_pct`: si viene y el
--    descuento total pasa de ese porcentaje del subtotal, la venta se rechaza.
-- 3. `complete_sale` (la que llama el POS, con la sesion del cajero) pasa
--    tope 10 a quien no tenga el permiso.
--
-- `confirm_terminal_payment` NO pasa tope: corre sin sesion al confirmar el
-- pago y rechazar ahi dejaria cobrado en la terminal algo sin venta. El tope
-- del cobro con terminal se valida antes, al crear la orden
-- (api/mercadopago/create-order).

-- ---------------------------------------------------------------------------
-- 0. Bitacora: acciones DESCUENTO y AUTO_CLOSE
--
-- DESCUENTO la registra el POS al cobrar con descuento manual. AUTO_CLOSE ya
-- la mandaba el cierre automatico de cajas (api/cron/auto-close-registers),
-- pero este CHECK la rechazaba y el registro se perdia en silencio.
-- ---------------------------------------------------------------------------
ALTER TABLE public.activity_logs DROP CONSTRAINT IF EXISTS activity_logs_action_check;
ALTER TABLE public.activity_logs ADD CONSTRAINT activity_logs_action_check
  CHECK (action = ANY (ARRAY['CREATE', 'UPDATE', 'DELETE', 'REIMPRIMIR', 'DESCUENTO', 'AUTO_CLOSE']));

-- ---------------------------------------------------------------------------
-- 1. Permiso
-- ---------------------------------------------------------------------------
INSERT INTO public.role_permissions (role, permission)
SELECT r.role, 'sales.discount_unlimited'
FROM (VALUES ('SUPER_ADMIN'::public.app_role), ('ORG_ADMIN'::public.app_role)) AS r(role)
WHERE NOT EXISTS (
  SELECT 1 FROM public.role_permissions rp
  WHERE rp.role = r.role AND rp.permission = 'sales.discount_unlimited'
);

-- ---------------------------------------------------------------------------
-- 2. _crear_venta_desde_items + p_tope_descuento_pct
--
-- Se parte de la definicion VIGENTE y solo se le insertan el parametro y la
-- comprobacion: copiar a mano las ~200 lineas de la funcion arriesgaba cambiar
-- algo sin querer. Si alguna de las dos marcas no aparece, la migracion falla
-- en vez de aplicar una version a medias.
-- ---------------------------------------------------------------------------
DO $migracion$
DECLARE
  v_def TEXT;
  v_nueva TEXT;
  v_firma_vieja CONSTANT TEXT := 'p_lista_precio_id uuid DEFAULT NULL::uuid)';
  v_marca_iva CONSTANT TEXT := '  v_impuesto := CASE WHEN p_include_iva';
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO v_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = '_crear_venta_desde_items'
    AND pg_get_function_identity_arguments(p.oid) NOT LIKE '%p_tope_descuento_pct%';

  IF v_def IS NULL THEN
    RAISE NOTICE '_crear_venta_desde_items ya tiene p_tope_descuento_pct';
    RETURN;
  END IF;

  IF strpos(v_def, v_firma_vieja) = 0 OR strpos(v_def, v_marca_iva) = 0 THEN
    RAISE EXCEPTION 'La definicion de _crear_venta_desde_items no es la esperada: revisar la 094';
  END IF;

  v_nueva := replace(
    v_def,
    v_firma_vieja,
    'p_lista_precio_id uuid DEFAULT NULL::uuid, p_tope_descuento_pct numeric DEFAULT NULL::numeric)'
  );

  v_nueva := replace(
    v_nueva,
    v_marca_iva,
    $check$  -- Tope del descuento manual (094): el cajero sin `sales.discount_unlimited`
  -- no puede descontar mas del porcentaje que le pase `complete_sale`.
  IF p_tope_descuento_pct IS NOT NULL
     AND v_descuento > ROUND((v_subtotal * p_tope_descuento_pct / 100)::NUMERIC, 2) THEN
    RAISE EXCEPTION 'El descuento supera el máximo permitido (% %% del ticket)', p_tope_descuento_pct;
  END IF;

$check$ || v_marca_iva
  );

  EXECUTE 'DROP FUNCTION public._crear_venta_desde_items(uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid, timestamptz, uuid, numeric, boolean, text, uuid)';
  EXECUTE v_nueva;
END
$migracion$;

-- Igual que antes: solo la llaman complete_sale y confirm_terminal_payment.
REVOKE EXECUTE ON FUNCTION public._crear_venta_desde_items(uuid, uuid, uuid, public.metodo_pago, jsonb, boolean, text, numeric, uuid, timestamptz, uuid, numeric, boolean, text, uuid, numeric)
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. complete_sale pasa el tope segun el permiso de quien cobra
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.complete_sale(
  p_tenant_id uuid,
  p_usuario_id uuid,
  p_cliente_id uuid DEFAULT NULL::uuid,
  p_metodo_pago metodo_pago DEFAULT 'EFECTIVO'::metodo_pago,
  p_items jsonb DEFAULT NULL::jsonb,
  p_include_iva boolean DEFAULT true,
  p_notas text DEFAULT NULL::text,
  p_monto_recibido numeric DEFAULT NULL::numeric,
  p_idempotency_key uuid DEFAULT NULL::uuid,
  p_fecha_venta timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_caja_id uuid DEFAULT NULL::uuid,
  p_total_cobrado numeric DEFAULT NULL::numeric,
  p_origen text DEFAULT 'online'::text,
  p_lista_precio_id uuid DEFAULT NULL::uuid
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'La venta debe incluir al menos un producto';
  END IF;

  SELECT role INTO v_role
  FROM public.tenant_memberships
  WHERE user_id = v_caller_id AND tenant_id = p_tenant_id
  LIMIT 1;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'No perteneces a este negocio';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions
    WHERE role = v_role AND permission = 'sales.create'
  ) INTO v_has_permission;

  IF NOT v_has_permission THEN
    RAISE EXCEPTION 'No tienes permiso para registrar ventas';
  END IF;

  RETURN public._crear_venta_desde_items(
    p_tenant_id, v_caller_id, p_cliente_id, p_metodo_pago, p_items,
    p_include_iva, p_notas, p_monto_recibido,
    p_idempotency_key, p_fecha_venta, p_caja_id, p_total_cobrado,
    (p_origen = 'offline'),
    p_origen,
    p_lista_precio_id,
    -- Sin el permiso, el descuento manual se topa al 10 % del ticket.
    CASE WHEN public.authorize('sales.discount_unlimited') THEN NULL ELSE 10 END
  );
END;
$function$;
