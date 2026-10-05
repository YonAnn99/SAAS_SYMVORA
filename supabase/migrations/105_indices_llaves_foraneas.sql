-- =============================================================================
-- 105 · Índices para las llaves foráneas sin índice
--
-- Plan de rendimiento, fase 3.1 (docs/plan-rendimiento-escalabilidad.md).
-- El linter de Supabase marcó 19 llaves foráneas sin índice que las cubra.
-- Sin índice, dos cosas escanean la tabla entera:
--   * filtrar por esa columna (ej. ventas o cajas de una sucursal);
--   * borrar la fila padre: Postgres busca las hijas para validar la llave o
--     ejecutar el ON DELETE (ej. borrar una variante revisa stock_sucursal,
--     precios_lista y detalle_traspaso).
--
-- SOLO AGREGA ÍNDICES: no cambia datos, columnas, políticas ni funciones.
-- `IF NOT EXISTS` la hace re-ejecutable. Las tablas son chicas hoy, así que
-- el bloqueo breve de CREATE INDEX (dentro de la transacción de la migración)
-- no se nota; con volumen grande se usaría CREATE INDEX CONCURRENTLY fuera de
-- una transacción.
--
-- Donde la columna admite NULL y casi siempre va vacía (variante, lista de
-- precios), el índice es parcial: mas chico y cubre igual la llave foránea.
-- =============================================================================

-- Sucursal: reportes, cortes y existencias filtran por local.
CREATE INDEX IF NOT EXISTS idx_ventas_sucursal
  ON public.ventas (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_cajas_sucursal
  ON public.cajas (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_compras_sucursal
  ON public.compras (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ajustes_inventario_sucursal
  ON public.ajustes_inventario (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_compra_sucursal
  ON public.ordenes_compra (sucursal_id);
CREATE INDEX IF NOT EXISTS idx_usuario_sucursales_sucursal
  ON public.usuario_sucursales (sucursal_id);

-- Existencias por variante (la llave unica empieza por sucursal; el indice
-- existente por producto_id, variante_id no sirve para buscar solo variante).
CREATE INDEX IF NOT EXISTS idx_stock_sucursal_variante
  ON public.stock_sucursal (variante_id)
  WHERE variante_id IS NOT NULL;

-- Favoritos: se leen por negocio + usuario; producto_id para el borrado.
CREATE INDEX IF NOT EXISTS idx_productos_favoritos_tenant_user
  ON public.productos_favoritos (tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_productos_favoritos_producto
  ON public.productos_favoritos (producto_id);
CREATE INDEX IF NOT EXISTS idx_variantes_favoritas_tenant_user
  ON public.variantes_favoritas (tenant_id, user_id);

-- Listas de precios.
CREATE INDEX IF NOT EXISTS idx_precios_lista_variante
  ON public.precios_lista (variante_id)
  WHERE variante_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pagos_terminal_lista_precio
  ON public.pagos_terminal (lista_precio_id)
  WHERE lista_precio_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_listas_precios_creado_por
  ON public.listas_precios (creado_por);

-- Traspasos entre sucursales.
CREATE INDEX IF NOT EXISTS idx_traspasos_sucursal_origen
  ON public.traspasos (sucursal_origen_id);
CREATE INDEX IF NOT EXISTS idx_traspasos_sucursal_destino
  ON public.traspasos (sucursal_destino_id);
CREATE INDEX IF NOT EXISTS idx_traspasos_usuario
  ON public.traspasos (usuario_id);
CREATE INDEX IF NOT EXISTS idx_detalle_traspaso_producto
  ON public.detalle_traspaso (producto_id);
CREATE INDEX IF NOT EXISTS idx_detalle_traspaso_variante
  ON public.detalle_traspaso (variante_id)
  WHERE variante_id IS NOT NULL;

-- Enlaces cortos de PDF (borrado en cascada del negocio).
CREATE INDEX IF NOT EXISTS idx_pdf_enlaces_tenant
  ON public.pdf_enlaces (tenant_id);
