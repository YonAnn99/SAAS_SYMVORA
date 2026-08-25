-- 028: Auditoría de seguridad + estandarización
--
-- 1. CRÍTICO — Cerrar bypass de pago en `subscriptions`:
--    La política INSERT permitía a cualquier miembro insertar status='active'
--    y la UPDATE permitía a un ORG_ADMIN activarse sin pagar (verificado con
--    PoC). La creación de la suscripción trial se mueve a `complete_onboarding`
--    (server-side) y se eliminan ambas políticas; el estado lo gestionan el
--    webhook de Conekta y las APIs (service_role tiene BYPASSRLS).
-- 2. FK faltante: productos.proveedor_id → proveedores(id) ON DELETE SET NULL.
-- 3. FK inconsistente: facturas_folios.tenant_id pasa de NO ACTION a CASCADE
--    (las demás 21 FKs a tenants son CASCADE).
-- 4. Unicidad de negocio: productos(tenant_id, codigo_barras) y
--    clientes(tenant_id, rfc) con índices únicos parciales.
-- 5. Higiene de privilegios: REVOKE TRUNCATE (RLS no cubre TRUNCATE) y
--    REVOKE EXECUTE de funciones trigger; search_path fijo en funciones
--    marcadas por el linter.

-- ============================================================
-- 1. Bypass de pago
-- ============================================================

DROP POLICY IF EXISTS "Users can create subscription for own tenant" ON public.subscriptions;
DROP POLICY IF EXISTS "ORG_ADMIN can update subscription" ON public.subscriptions;

-- complete_onboarding ahora crea la suscripción trial (antes la creaba el
-- cliente browser). Cuerpo idéntico a la migración 024 + paso 3.5.
DROP FUNCTION IF EXISTS public.complete_onboarding(uuid, text, text, text, text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.complete_onboarding(
  p_user_id UUID,
  p_nombre_comercial TEXT,
  p_subdominio TEXT,
  p_giro_comercial TEXT,
  p_color_primario TEXT DEFAULT NULL,
  p_configuracion_json JSONB DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL,
  p_referral_code TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_tenant JSONB;
  v_referrer_tenant_id UUID;
  v_is_self INT;
BEGIN
  -- Security: only the authenticated user may bootstrap their own tenant
  IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'No autorizado: no puedes crear un negocio a nombre de otro usuario';
  END IF;

  -- 1. Create tenant
  INSERT INTO public.tenants (
    nombre_comercial,
    subdominio,
    giro_comercial,
    color_primario,
    logo_url
  ) VALUES (
    p_nombre_comercial,
    p_subdominio,
    p_giro_comercial,
    p_color_primario,
    p_logo_url
  )
  RETURNING id INTO v_tenant_id;

  -- 2. Create tenant settings
  INSERT INTO public.tenant_settings (
    tenant_id,
    configuracion_json
  ) VALUES (
    v_tenant_id,
    COALESCE(p_configuracion_json, '{}'::jsonb)
  );

  -- 3. Create membership (ORG_ADMIN for the founder)
  INSERT INTO public.tenant_memberships (
    tenant_id,
    user_id,
    role
  ) VALUES (
    v_tenant_id,
    p_user_id,
    'ORG_ADMIN'
  );

  -- 4. Create user role (ON CONFLICT must match UNIQUE(user_id, role))
  INSERT INTO public.user_roles (
    user_id,
    role
  ) VALUES (
    p_user_id,
    'ORG_ADMIN'
  )
  ON CONFLICT (user_id, role) DO NOTHING;

  -- 3.5. Create trial subscription server-side (7 días). Antes la creaba el
  -- cliente browser; moverla aquí permite eliminar las políticas
  -- INSERT/UPDATE de authenticated sobre subscriptions (bypass de pago).
  INSERT INTO public.subscriptions (
    tenant_id,
    status,
    payment_method,
    trial_start,
    trial_end
  ) VALUES (
    v_tenant_id,
    'trial',
    'card',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (tenant_id) DO NOTHING;

  -- 5. Generate own referral code (deterministic, unique by tenant id).
  --    El trigger trg_tenants_assign_codigo_referido ya lo asigna en el
  --    INSERT; este UPDATE es redundante pero inofensivo (mismo valor).
  UPDATE public.tenants
  SET codigo_referido = 'SYM' || upper(substr(replace(v_tenant_id::text, '-', ''), 1, 8))
  WHERE id = v_tenant_id;

  -- 6. Apply referral (if provided) — silently ignore self-referrals and
  --    tenants that were already referred.
  IF p_referral_code IS NOT NULL AND btrim(p_referral_code) <> '' THEN
    BEGIN
      SELECT t.id INTO v_referrer_tenant_id
      FROM public.tenants t
      WHERE t.codigo_referido = UPPER(btrim(p_referral_code));

      IF v_referrer_tenant_id IS NOT NULL THEN
        SELECT 1 INTO v_is_self
        FROM public.tenant_memberships
        WHERE tenant_id = v_referrer_tenant_id
          AND user_id = p_user_id
        LIMIT 1;

        IF v_is_self IS NULL THEN
          INSERT INTO public.referidos (
            tenant_referidor_id,
            tenant_referido_id,
            estado,
            registrado_en
          ) VALUES (
            v_referrer_tenant_id,
            v_tenant_id,
            'REGISTRADO',
            NOW()
          );
        END IF;
      END IF;
    EXCEPTION WHEN unique_violation THEN
      -- El tenant nuevo ya fue referido con otro codigo: se ignora.
      NULL;
    END;
  END IF;

  -- Return the created tenant
  SELECT to_jsonb(t.*) INTO v_tenant
  FROM public.tenants t
  WHERE t.id = v_tenant_id;

  RETURN v_tenant;

  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'El subdominio "%" ya esta en uso. Prueba otro.', p_subdominio
      USING ERRCODE = '23505';
END;
$$;

REVOKE ALL ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_onboarding(UUID, TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT) TO authenticated;

-- ============================================================
-- 2. FK productos.proveedor_id
-- ============================================================

ALTER TABLE public.productos
  DROP CONSTRAINT IF EXISTS productos_proveedor_id_fkey;

ALTER TABLE public.productos
  ADD CONSTRAINT productos_proveedor_id_fkey
  FOREIGN KEY (proveedor_id) REFERENCES public.proveedores(id)
  ON DELETE SET NULL;

-- ============================================================
-- 3. facturas_folios.tenant_id → CASCADE (estandarización)
-- ============================================================

ALTER TABLE public.facturas_folios
  DROP CONSTRAINT IF EXISTS facturas_folios_tenant_id_fkey;

ALTER TABLE public.facturas_folios
  ADD CONSTRAINT facturas_folios_tenant_id_fkey
  FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
  ON DELETE CASCADE;

-- ============================================================
-- 4. Unicidad de negocio (índices únicos parciales)
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_tenant_codigo_barras
  ON public.productos (tenant_id, codigo_barras)
  WHERE codigo_barras IS NOT NULL AND btrim(codigo_barras) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS uq_clientes_tenant_rfc
  ON public.clientes (tenant_id, rfc)
  WHERE rfc IS NOT NULL AND btrim(rfc) <> '' AND rfc <> 'XAXX010101000';

-- ============================================================
-- 5. Higiene de privilegios
-- ============================================================

REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.tenants_assign_codigo_referido() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_factura_timestamp() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.current_user_is_demo() SET search_path = public;
ALTER FUNCTION public.tenants_assign_codigo_referido() SET search_path = public;
