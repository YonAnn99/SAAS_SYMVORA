-- Migration 046: Liquidar credito/fiado
-- Agrega una tabla de historial de abonos (pagos_credito) y un RPC
-- SECURITY DEFINER para pagar (parcial o totalmente) el saldo_pendiente
-- de un cliente, ya que hoy ese saldo solo se incrementa (via complete_sale)
-- y no existe ninguna forma de saldarlo.

BEGIN;

-- =============================================
-- Tabla pagos_credito
-- =============================================

CREATE TABLE public.pagos_credito (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id),
  monto DECIMAL(10,2) NOT NULL,
  metodo_pago public.metodo_pago NOT NULL DEFAULT 'EFECTIVO',
  notas TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.pagos_credito ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_pagos_credito_cliente ON public.pagos_credito(cliente_id);
CREATE INDEX idx_pagos_credito_tenant ON public.pagos_credito(tenant_id);

CREATE POLICY "pagos_credito_select" ON public.pagos_credito
FOR SELECT TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "pagos_credito_insert" ON public.pagos_credito
FOR INSERT TO authenticated
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create'));

CREATE POLICY "pagos_credito_update" ON public.pagos_credito
FOR UPDATE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create'))
WITH CHECK (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create'));

CREATE POLICY "pagos_credito_delete" ON public.pagos_credito
FOR DELETE TO authenticated
USING (tenant_id IN (SELECT public.user_tenant_ids()) AND public.authorize('sales.create'));

-- =============================================
-- registrar_pago_credito()
-- =============================================

CREATE OR REPLACE FUNCTION public.registrar_pago_credito(
  p_tenant_id UUID,
  p_usuario_id UUID,
  p_cliente_id UUID,
  p_monto DECIMAL(10,2),
  p_metodo_pago public.metodo_pago DEFAULT 'EFECTIVO',
  p_notas TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id UUID;
  v_role public.app_role;
  v_has_permission BOOLEAN;
  v_cliente RECORD;
  v_caja_id UUID;
  v_pago_id UUID;
  v_pago JSONB;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL OR v_caller_id <> p_usuario_id THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- RBAC desde la DB (no desde JWT): membresia real + permiso sales.create
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
    RAISE EXCEPTION 'No tienes permiso para registrar pagos de credito';
  END IF;

  IF p_monto IS NULL OR p_monto <= 0 THEN
    RAISE EXCEPTION 'El monto del pago debe ser mayor a 0';
  END IF;

  IF p_metodo_pago = 'CREDITO' THEN
    RAISE EXCEPTION 'Metodo de pago invalido para liquidar credito';
  END IF;

  -- Bloquea la fila para evitar condiciones de carrera con pagos concurrentes
  SELECT id, tenant_id, nombre, saldo_pendiente
  INTO v_cliente
  FROM public.clientes
  WHERE id = p_cliente_id
  FOR UPDATE;

  IF v_cliente.id IS NULL OR v_cliente.tenant_id <> p_tenant_id THEN
    RAISE EXCEPTION 'Cliente invalido para este negocio';
  END IF;

  IF p_monto > v_cliente.saldo_pendiente THEN
    RAISE EXCEPTION 'El monto ($%) excede el saldo pendiente del cliente ($%)', p_monto, v_cliente.saldo_pendiente;
  END IF;

  UPDATE public.clientes
  SET saldo_pendiente = saldo_pendiente - p_monto
  WHERE id = p_cliente_id;

  INSERT INTO public.pagos_credito (
    tenant_id, cliente_id, usuario_id, monto, metodo_pago, notas
  ) VALUES (
    p_tenant_id, p_cliente_id, p_usuario_id, p_monto, p_metodo_pago, p_notas
  )
  RETURNING id INTO v_pago_id;

  -- Solo en efectivo: registrar entrada en la caja abierta del cajero
  IF p_metodo_pago = 'EFECTIVO' THEN
    SELECT id INTO v_caja_id
    FROM public.cajas
    WHERE tenant_id = p_tenant_id
      AND usuario_id = p_usuario_id
      AND estado = 'ABIERTA'
    ORDER BY fecha_apertura DESC
    LIMIT 1;

    IF v_caja_id IS NOT NULL THEN
      INSERT INTO public.movimientos_caja (caja_id, tipo, monto, descripcion)
      VALUES (v_caja_id, 'ENTRADA', p_monto, 'Pago de credito - ' || v_cliente.nombre);
    END IF;
  END IF;

  SELECT to_jsonb(p.*) INTO v_pago
  FROM public.pagos_credito p
  WHERE p.id = v_pago_id;

  RETURN v_pago;
END;
$$;

GRANT EXECUTE ON FUNCTION public.registrar_pago_credito(UUID, UUID, UUID, DECIMAL, public.metodo_pago, TEXT) TO authenticated;

COMMIT;
