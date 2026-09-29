-- 095_enlaces_pdf_orden.sql
-- Enlace corto y con el dominio de SYMVORA para el PDF de las ordenes de compra.
--
-- Antes el mensaje de WhatsApp llevaba la URL publica de Supabase Storage
-- (https://<proyecto>.supabase.co/storage/v1/object/public/ordenes-compra/...),
-- larguisima y con un dominio ajeno que al proveedor le podia parecer
-- sospechoso. Ahora el mensaje lleva https://www.symvora.com.mx/pedido/<codigo>.pdf
-- y la ruta `src/app/pedido/[archivo]/route.ts` entrega el PDF.
--
-- 1. `pdf_enlaces`: codigo corto -> archivo del bucket. La inserta el panel al
--    subir el PDF; la lee solo la ruta publica, con la service role.
-- 2. El bucket `ordenes-compra` pasa a PRIVADO: el PDF solo se sirve por la
--    ruta de SYMVORA. Los enlaces viejos de supabase.co dejan de abrir.

CREATE TABLE IF NOT EXISTS public.pdf_enlaces (
  codigo TEXT PRIMARY KEY CHECK (codigo ~ '^[A-Za-z0-9]{10}$'),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  orden_id UUID NOT NULL REFERENCES public.ordenes_compra(id) ON DELETE CASCADE,
  ruta_storage TEXT NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_enlaces_orden ON public.pdf_enlaces(orden_id);

ALTER TABLE public.pdf_enlaces ENABLE ROW LEVEL SECURITY;

-- Solo alta, y solo de su negocio y de una orden de su negocio. Sin politica de
-- SELECT: desde el navegador nadie lista los enlaces (la ruta usa service role).
DROP POLICY IF EXISTS "pdf_enlaces_insert_own_tenant" ON public.pdf_enlaces;
CREATE POLICY "pdf_enlaces_insert_own_tenant" ON public.pdf_enlaces
FOR INSERT TO authenticated
WITH CHECK (
  tenant_id IN (SELECT public.user_tenant_ids())
  AND EXISTS (
    SELECT 1 FROM public.ordenes_compra o
    WHERE o.id = orden_id AND o.tenant_id = pdf_enlaces.tenant_id
  )
  AND ruta_storage LIKE tenant_id::text || '/%'
);

UPDATE storage.buckets SET public = false WHERE id = 'ordenes-compra';
