-- =============================================
-- 098: Variantes favoritas, por usuario
-- ---------------------------------------------
-- QUE HABILITA: el corazon en cada variante del catalogo (escritorio) y que
-- el filtro "Favoritos" del POS incluya un producto si alguna de sus
-- variantes es favorita (y, en vista Desglosado, solo esas variantes).
--
-- Tabla APARTE de `productos_favoritos` (064) en lugar de agregarle una
-- columna: aquella tiene PRIMARY KEY (user_id, producto_id) y funciona;
-- cambiarle la llave para admitir variantes arriesgaba lo que ya sirve.
--
-- Mismas reglas que la 064: privados de cada usuario (user_id lo pone
-- `DEFAULT auth.uid()`, el cliente nunca lo manda), doble barrera RLS por
-- usuario Y negocio, y sin politica de UPDATE (un favorito existe o no).
-- =============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.variantes_favoritas (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  variante_id UUID NOT NULL REFERENCES public.variantes_producto(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, variante_id)
);

CREATE INDEX IF NOT EXISTS idx_variantes_favoritas_variante
  ON public.variantes_favoritas(variante_id);

ALTER TABLE public.variantes_favoritas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "variantes_favoritas_select" ON public.variantes_favoritas
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "variantes_favoritas_insert" ON public.variantes_favoritas
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

CREATE POLICY "variantes_favoritas_delete" ON public.variantes_favoritas
  FOR DELETE TO authenticated
  USING (user_id = (select auth.uid()) AND tenant_id IN (SELECT public.user_tenant_ids()));

COMMIT;
