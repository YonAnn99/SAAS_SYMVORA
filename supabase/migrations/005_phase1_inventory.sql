-- SYMVORA SaaS - Phase 1: Inventory Deep Dive
-- Lotes, Variantes, Ajustes de Inventario, Órdenes de Compra

-- =============================================
-- NEW ENUMS
-- =============================================

CREATE TYPE public.estado_orden_compra AS ENUM ('BORRADOR', 'ENVIADA', 'RECIBIDA_PARCIAL', 'RECIBIDA_TOTAL', 'CANCELADA');
CREATE TYPE public.motivo_ajuste AS ENUM ('MERMA', 'CONTEO_FISICO', 'DEVOLUCION', 'DAÑO', 'OTRO');

-- =============================================
-- NEW TABLES
-- =============================================

-- Product batches (lotes) with expiration dates
CREATE TABLE public.lotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  numero_lote TEXT NOT NULL,
  cantidad DECIMAL(10,3) NOT NULL,
  fecha_caducidad DATE,
  fecha_fabricacion DATE,
  costo_unitario DECIMAL(10,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (estado IN ('ACTIVO', 'VENCIDO', 'AGOTADO')),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, producto_id, numero_lote)
);

-- Product variants (size, color, etc.)
CREATE TABLE public.variantes_producto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
  sku TEXT,
  codigo_barras TEXT,
  talla TEXT,
  color TEXT,
  precio_venta DECIMAL(10,2) NOT NULL,
  costo_compra DECIMAL(10,2) NOT NULL DEFAULT 0,
  stock_actual DECIMAL(10,3) NOT NULL DEFAULT 0,
  imagen_url TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, producto_id, talla, color)
);

-- Stock per variant (redundant but useful for fast POS queries)
CREATE TABLE public.stock_variantes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variante_id UUID NOT NULL REFERENCES public.variantes_producto(id) ON DELETE CASCADE,
  lote_id UUID REFERENCES public.lotes(id) ON DELETE SET NULL,
  cantidad DECIMAL(10,3) NOT NULL DEFAULT 0,
  UNIQUE(variante_id, lote_id)
);

-- Inventory adjustments
CREATE TABLE public.ajustes_inventario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.variantes_producto(id),
  lote_id UUID REFERENCES public.lotes(id),
  motivo motivo_ajuste NOT NULL,
  cantidad_anterior DECIMAL(10,3) NOT NULL,
  cantidad_ajuste DECIMAL(10,3) NOT NULL,
  cantidad_nueva DECIMAL(10,3) NOT NULL,
  notas TEXT,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchase orders (replaces simple purchase tracking)
CREATE TABLE public.ordenes_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  proveedor_id UUID NOT NULL REFERENCES public.proveedores(id),
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  numero_orden TEXT NOT NULL,
  estado estado_orden_compra NOT NULL DEFAULT 'BORRADOR',
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  impuesto DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  fecha_estimada_recepcion DATE,
  fecha_recepcion TIMESTAMPTZ,
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Purchase order details
CREATE TABLE public.detalle_orden_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_compra_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES public.productos(id),
  variante_id UUID REFERENCES public.variantes_producto(id),
  cantidad_solicitada DECIMAL(10,3) NOT NULL,
  cantidad_recibida DECIMAL(10,3) NOT NULL DEFAULT 0,
  costo_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  notas TEXT
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_lotes_tenant ON public.lotes(tenant_id);
CREATE INDEX idx_lotes_producto ON public.lotes(producto_id);
CREATE INDEX idx_lotes_caducidad ON public.lotes(fecha_caducidad);
CREATE INDEX idx_variantes_producto_tenant ON public.variantes_producto(tenant_id);
CREATE INDEX idx_variantes_producto_producto ON public.variantes_producto(producto_id);
CREATE INDEX idx_stock_variantes_variante ON public.stock_variantes(variante_id);
CREATE INDEX idx_ajustes_inventario_tenant ON public.ajustes_inventario(tenant_id);
CREATE INDEX idx_ajustes_inventario_producto ON public.ajustes_inventario(producto_id);
CREATE INDEX idx_ordenes_compra_tenant ON public.ordenes_compra(tenant_id);
CREATE INDEX idx_ordenes_compra_proveedor ON public.ordenes_compra(proveedor_id);
CREATE INDEX idx_ordenes_compra_estado ON public.ordenes_compra(estado);
CREATE INDEX idx_detalle_orden_compra_orden ON public.detalle_orden_compra(orden_compra_id);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE public.lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.variantes_producto ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stock_variantes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ajustes_inventario ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ordenes_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detalle_orden_compra ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lotes_isolation" ON public.lotes
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "variantes_producto_isolation" ON public.variantes_producto
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "stock_variantes_isolation" ON public.stock_variantes
FOR ALL TO authenticated
USING (
  variante_id IN (
    SELECT id FROM public.variantes_producto
    WHERE tenant_id IN (SELECT public.user_tenant_ids())
  )
);

CREATE POLICY "ajustes_inventario_isolation" ON public.ajustes_inventario
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "ordenes_compra_isolation" ON public.ordenes_compra
FOR ALL TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "detalle_orden_compra_isolation" ON public.detalle_orden_compra
FOR ALL TO authenticated
USING (
  orden_compra_id IN (
    SELECT id FROM public.ordenes_compra
    WHERE tenant_id IN (SELECT public.user_tenant_ids())
  )
);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to adjust inventory with audit trail
CREATE OR REPLACE FUNCTION public.ajustar_inventario(
  p_producto_id UUID,
  p_cantidad_ajuste DECIMAL,
  p_motivo motivo_ajuste,
  p_notas TEXT DEFAULT NULL,
  p_variante_id UUID DEFAULT NULL,
  p_lote_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_stock_anterior DECIMAL;
  v_stock_nuevo DECIMAL;
  v_ajuste_id UUID;
BEGIN
  -- Get tenant from JWT
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::UUID;
  
  IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No tenant context found';
  END IF;

  -- Get current stock
  IF p_variante_id IS NOT NULL THEN
    SELECT stock_actual INTO v_stock_anterior
    FROM public.variantes_producto
    WHERE id = p_variante_id AND tenant_id = v_tenant_id;
  ELSE
    SELECT stock_actual INTO v_stock_anterior
    FROM public.productos
    WHERE id = p_producto_id AND tenant_id = v_tenant_id;
  END IF;

  IF v_stock_anterior IS NULL THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Calculate new stock
  v_stock_nuevo := v_stock_anterior + p_cantidad_ajuste;

  IF v_stock_nuevo < 0 THEN
    RAISE EXCEPTION 'Stock cannot be negative: %', v_stock_nuevo;
  END IF;

  -- Update stock
  IF p_variante_id IS NOT NULL THEN
    UPDATE public.variantes_producto
    SET stock_actual = v_stock_nuevo,
        actualizado_en = NOW()
    WHERE id = p_variante_id;
  ELSE
    UPDATE public.productos
    SET stock_actual = v_stock_nuevo,
        actualizado_en = NOW()
    WHERE id = p_producto_id;
  END IF;

  -- Create adjustment record
  INSERT INTO public.ajustes_inventario (
    tenant_id, producto_id, variante_id, lote_id,
    motivo, cantidad_anterior, cantidad_ajuste, cantidad_nueva,
    notas, usuario_id
  ) VALUES (
    v_tenant_id, p_producto_id, p_variante_id, p_lote_id,
    p_motivo, v_stock_anterior, p_cantidad_ajuste, v_stock_nuevo,
    p_notas, auth.uid()
  ) RETURNING id INTO v_ajuste_id;

  -- Update batch if provided
  IF p_lote_id IS NOT NULL THEN
    UPDATE public.lotes
    SET cantidad = cantidad + p_cantidad_ajuste,
        actualizado_en = NOW()
    WHERE id = p_lote_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'ajuste_id', v_ajuste_id,
    'stock_anterior', v_stock_anterior,
    'stock_nuevo', v_stock_nuevo
  );
END;
$$;

-- Function to receive purchase order
CREATE OR REPLACE FUNCTION public.recibir_orden_compra(
  p_orden_id UUID,
  p_items JSONB -- [{producto_id, variante_id, cantidad_recibida}]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id UUID;
  v_orden RECORD;
  v_item JSONB;
  v_todos_recibidos BOOLEAN := TRUE;
  v_item_recibido RECORD;
BEGIN
  v_tenant_id := (auth.jwt() ->> 'tenant_id')::UUID;
  
  -- Get order
  SELECT * INTO v_orden
  FROM public.ordenes_compra
  WHERE id = p_orden_id AND tenant_id = v_tenant_id;

  IF v_orden IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_orden.estado NOT IN ('ENVIADA', 'RECIBIDA_PARCIAL') THEN
    RAISE EXCEPTION 'Order cannot be received in current state: %', v_orden.estado;
  END IF;

  -- Process each item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Update received quantity
    UPDATE public.detalle_orden_compra
    SET cantidad_recibida = cantidad_recibida + (v_item->>'cantidad_recibida')::DECIMAL
    WHERE id = (v_item->>'detalle_id')::UUID
    AND orden_compra_id = p_orden_id
    RETURNING * INTO v_item_recibido;

    -- Update product stock
    UPDATE public.productos
    SET stock_actual = stock_actual + (v_item->>'cantidad_recibida')::DECIMAL,
        actualizado_en = NOW()
    WHERE id = v_item_recibido.producto_id;

    -- Check if all items fully received
    IF v_item_recibido.cantidad_recibida < v_item_recibido.cantidad_solicitada THEN
      v_todos_recibidos := FALSE;
    END IF;
  END LOOP;

  -- Update order status
  IF v_todos_recibidos THEN
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_TOTAL',
        fecha_recepcion = NOW(),
        actualizado_en = NOW()
    WHERE id = p_orden_id;
  ELSE
    UPDATE public.ordenes_compra
    SET estado = 'RECIBIDA_PARCIAL',
        fecha_recepcion = NOW(),
        actualizado_en = NOW()
    WHERE id = p_orden_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'orden_id', p_orden_id,
    'nuevo_estado', CASE WHEN v_todos_recibidos THEN 'RECIBIDA_TOTAL' ELSE 'RECIBIDA_PARCIAL' END
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.ajustar_inventario TO authenticated;
GRANT EXECUTE ON FUNCTION public.recibir_orden_compra TO authenticated;
