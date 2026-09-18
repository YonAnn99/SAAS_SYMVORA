-- ============================================================
-- 071_uq_productos_tenant_sku.sql
-- Unicidad de SKU por negocio (índice único parcial)
-- Garantiza que dentro de un mismo tenant ningún producto repita SKU.
-- Permite valores nulos o vacíos sin conflicto.
-- ============================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_productos_tenant_sku
  ON public.productos (tenant_id, sku)
  WHERE sku IS NOT NULL AND btrim(sku) <> '';
