-- SYMVORA SaaS - Facturación Electrónica CFDI 4.0
-- Módulo de facturación con integración PAC

-- =============================================
-- ENUMS
-- =============================================

DO $$ BEGIN
  CREATE TYPE public.estado_factura AS ENUM ('BORRADOR', 'TIMBRADA', 'CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.metodo_pago_cfdi AS ENUM ('PUE', 'PPD');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.estado_cancelacion AS ENUM ('PENDIENTE', 'ACEPTADA', 'RECHAZADA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- =============================================
-- NEW FIELDS ON EXISTING TABLES
-- =============================================

-- Tenant fiscal data (emisor)
DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN rfc TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN razon_social TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN regimen_fiscal TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.tenants ADD COLUMN codigo_postal TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Client fiscal data (receptor)
DO $$ BEGIN
  ALTER TABLE public.clientes ADD COLUMN rfc TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.clientes ADD COLUMN razon_social TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.clientes ADD COLUMN regimen_fiscal_receptor TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.clientes ADD COLUMN uso_cfdi TEXT DEFAULT 'G03';
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.clientes ADD COLUMN codigo_postal TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Product SAT codes
DO $$ BEGIN
  ALTER TABLE public.productos ADD COLUMN clave_prod_serv TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.productos ADD COLUMN clave_unidad TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.productos ADD COLUMN no_identificacion TEXT;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Venta CFDI link (FK added after facturas table)
DO $$ BEGIN
  ALTER TABLE public.ventas ADD COLUMN factura_id UUID;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Main facturas table
CREATE TABLE IF NOT EXISTS public.facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,

  -- Identification
  serie TEXT NOT NULL DEFAULT 'A',
  folio INTEGER NOT NULL,

  -- Emisor snapshot
  emisor_rfc TEXT NOT NULL,
  emisor_razon_social TEXT NOT NULL,
  emisor_regimen_fiscal TEXT NOT NULL,
  emisor_codigo_postal TEXT NOT NULL,

  -- Receptor snapshot
  receptor_rfc TEXT NOT NULL,
  receptor_razon_social TEXT NOT NULL,
  receptor_regimen_fiscal TEXT NOT NULL,
  receptor_uso_cfdi TEXT NOT NULL,
  receptor_codigo_postal TEXT NOT NULL,

  -- Amounts
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  impuesto NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,

  -- SAT payment method
  metodo_pago metodo_pago_cfdi NOT NULL DEFAULT 'PUE',
  forma_pago TEXT NOT NULL DEFAULT '01',

  -- CFDI status
  estado estado_factura NOT NULL DEFAULT 'BORRADOR',
  uuid_cfdi TEXT,
  fecha_timbrado TIMESTAMPTZ,
  fecha_emision TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Storage
  xml_url TEXT,
  pdf_url TEXT,

  -- PAC info
  pac_nombre TEXT,
  pac_response JSONB,

  -- Cancellation
  fecha_cancelacion TIMESTAMPTZ,
  motivo_cancelacion TEXT,
  folio_sustitucion TEXT,

  -- Link to original sale
  venta_id UUID REFERENCES public.ventas(id),

  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique folio per tenant+serie
  UNIQUE(tenant_id, serie, folio)
);

-- FK from ventas to facturas (after facturas table exists)
DO $$ BEGIN
  ALTER TABLE public.ventas
    ADD CONSTRAINT fk_ventas_factura
    FOREIGN KEY (factura_id) REFERENCES public.facturas(id)
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Invoice detail lines
CREATE TABLE IF NOT EXISTS public.factura_detalle (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id) ON DELETE CASCADE,

  -- Product
  producto_id UUID REFERENCES public.productos(id),
  descripcion TEXT NOT NULL,
  clave_prod_serv TEXT NOT NULL,
  clave_unidad TEXT NOT NULL,
  no_identificacion TEXT,

  -- Quantities
  cantidad NUMERIC(12,4) NOT NULL,
  unidad TEXT NOT NULL,

  -- Prices
  precio_unitario NUMERIC(12,6) NOT NULL,
  descuento NUMERIC(12,6) NOT NULL DEFAULT 0,
  subtotal NUMERIC(12,6) NOT NULL,

  -- Taxes
  base_impuesto NUMERIC(12,6) NOT NULL,
  tasa_impuesto NUMERIC(8,6) NOT NULL DEFAULT 0.160000,
  importe_impuesto NUMERIC(12,6) NOT NULL,

  -- Order
  orden INTEGER NOT NULL DEFAULT 1,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Cancellation history
CREATE TABLE IF NOT EXISTS public.facturas_cancelaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factura_id UUID NOT NULL REFERENCES public.facturas(id),

  motivo TEXT NOT NULL,
  folio_sustitucion TEXT,
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_respuesta TIMESTAMPTZ,
  estado estado_cancelacion NOT NULL DEFAULT 'PENDIENTE',
  pac_response JSONB,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Folio sequence per tenant
CREATE TABLE IF NOT EXISTS public.facturas_folios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id),
  serie TEXT NOT NULL DEFAULT 'A',
  ultimo_folio INTEGER NOT NULL DEFAULT 0,

  UNIQUE(tenant_id, serie)
);

-- =============================================
-- FISCAL CONFIG IN TENANT_SETTINGS
-- =============================================

-- Add fiscal config column if not exists
DO $$ BEGIN
  ALTER TABLE public.tenant_settings ADD COLUMN configuracion_fiscal JSONB DEFAULT '{
    "cfdi_serie": "A",
    "cfdi_metodo_pago": "PUE",
    "cfdi_forma_pago_default": "01",
    "pac_proveedor": "finkok",
    "pac_usuario": "",
    "pac_password": "",
    "certificado_cer": "",
    "certificado_key": "",
    "certificado_password": "",
    "email_envio_facturas": ""
  }'::jsonb;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_facturas_tenant ON public.facturas(tenant_id);
CREATE INDEX IF NOT EXISTS idx_facturas_estado ON public.facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_venta ON public.facturas(venta_id);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha ON public.facturas(fecha_emision);
CREATE INDEX IF NOT EXISTS idx_facturas_uuid ON public.facturas(uuid_cfdi);
CREATE INDEX IF NOT EXISTS idx_factura_detalle_factura ON public.factura_detalle(factura_id);
CREATE INDEX IF NOT EXISTS idx_factura_detalle_producto ON public.factura_detalle(producto_id);
CREATE INDEX IF NOT EXISTS idx_facturas_cancelaciones_factura ON public.facturas_cancelaciones(factura_id);
CREATE INDEX IF NOT EXISTS idx_facturas_folios_tenant ON public.facturas_folios(tenant_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.factura_detalle ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_cancelaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.facturas_folios ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas;
  DROP POLICY IF EXISTS "tenant_isolation" ON public.factura_detalle;
  DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas_cancelaciones;
  DROP POLICY IF EXISTS "tenant_isolation" ON public.facturas_folios;
  DROP POLICY IF EXISTS "service_role_facturas" ON public.facturas;
  DROP POLICY IF EXISTS "service_role_factura_detalle" ON public.factura_detalle;
  DROP POLICY IF EXISTS "service_role_facturas_cancelaciones" ON public.facturas_cancelaciones;
  DROP POLICY IF EXISTS "service_role_facturas_folios" ON public.facturas_folios;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Tenant isolation for facturas
CREATE POLICY "tenant_isolation" ON public.facturas
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Tenant isolation for factura_detalle (via factura)
CREATE POLICY "tenant_isolation" ON public.factura_detalle
FOR ALL TO authenticated
USING (
  factura_id IN (
    SELECT id FROM public.facturas
    WHERE tenant_id IN (SELECT public.user_tenant_ids())
  )
);

-- Tenant isolation for cancelaciones (via factura)
CREATE POLICY "tenant_isolation" ON public.facturas_cancelaciones
FOR ALL TO authenticated
USING (
  factura_id IN (
    SELECT id FROM public.facturas
    WHERE tenant_id IN (SELECT public.user_tenant_ids())
  )
);

-- Tenant isolation for folios
CREATE POLICY "tenant_isolation" ON public.facturas_folios
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

-- Service role policies for API operations
CREATE POLICY "service_role_facturas" ON public.facturas
FOR ALL TO service_role
USING (true);

CREATE POLICY "service_role_factura_detalle" ON public.factura_detalle
FOR ALL TO service_role
USING (true);

CREATE POLICY "service_role_facturas_cancelaciones" ON public.facturas_cancelaciones
FOR ALL TO service_role
USING (true);

CREATE POLICY "service_role_facturas_folios" ON public.facturas_folios
FOR ALL TO service_role
USING (true);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Get next folio for a tenant+serie
CREATE OR REPLACE FUNCTION public.get_next_folio(
  p_tenant_id UUID,
  p_serie TEXT DEFAULT 'A'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next INTEGER;
BEGIN
  -- Insert folio record if not exists
  INSERT INTO public.facturas_folios (tenant_id, serie, ultimo_folio)
  VALUES (p_tenant_id, p_serie, 0)
  ON CONFLICT (tenant_id, serie) DO NOTHING;

  -- Increment and return
  UPDATE public.facturas_folios
  SET ultimo_folio = ultimo_folio + 1
  WHERE tenant_id = p_tenant_id AND serie = p_serie
  RETURNING ultimo_folio INTO v_next;

  RETURN v_next;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_next_folio(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_next_folio(UUID, TEXT) TO service_role;

-- Update factura link on ventas after insert
CREATE OR REPLACE FUNCTION public.update_venta_factura_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.venta_id IS NOT NULL AND NEW.estado = 'TIMBRADA' THEN
    UPDATE public.ventas
    SET factura_id = NEW.id
    WHERE id = NEW.venta_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_update_venta_factura_link
  AFTER INSERT OR UPDATE ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_venta_factura_link();

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_factura_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_facturas_updated_at
  BEFORE UPDATE ON public.facturas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_factura_timestamp();

-- =============================================
-- RBAC PERMISSIONS
-- =============================================

-- SUPER_ADMIN permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('SUPER_ADMIN', 'billing.view'),
  ('SUPER_ADMIN', 'billing.create'),
  ('SUPER_ADMIN', 'billing.stamp'),
  ('SUPER_ADMIN', 'billing.cancel'),
  ('SUPER_ADMIN', 'billing.config')
ON CONFLICT (role, permission) DO NOTHING;

-- ORG_ADMIN permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('ORG_ADMIN', 'billing.view'),
  ('ORG_ADMIN', 'billing.create'),
  ('ORG_ADMIN', 'billing.stamp'),
  ('ORG_ADMIN', 'billing.cancel'),
  ('ORG_ADMIN', 'billing.config')
ON CONFLICT (role, permission) DO NOTHING;

-- CAJERO permissions (view only)
INSERT INTO public.role_permissions (role, permission) VALUES
  ('CAJERO', 'billing.view')
ON CONFLICT (role, permission) DO NOTHING;
