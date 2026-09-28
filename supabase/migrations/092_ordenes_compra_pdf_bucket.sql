-- 092_ordenes_compra_pdf_bucket.sql
-- Bucket para el PDF de las ordenes de compra que se mandan por WhatsApp.
--
-- WhatsApp no deja adjuntar archivos desde un enlace wa.me (solo texto), asi
-- que el PDF se sube aqui y el mensaje lleva el enlace. Mismo patron que
-- "product-images" (migracion 045): carpeta por tenant.
--
-- 1. Bucket PUBLICO: el proveedor abre el enlace sin cuenta en SYMVORA. La
--    ruta es {tenant_id}/{orden_id}/{uuid}.pdf; el uuid aleatorio hace que el
--    enlace no se pueda adivinar, y sin politica de SELECT para anon no se
--    puede listar el bucket.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ordenes-compra',
  'ordenes-compra',
  true,
  2097152, -- 2 MB; una orden con cientos de renglones ronda los 100 KB
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. Politicas en storage.objects: cualquier miembro del tenant escribe y
--    borra solo en la carpeta de su tenant.

DROP POLICY IF EXISTS "ordenes_compra_insert_own_tenant" ON storage.objects;
CREATE POLICY "ordenes_compra_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ordenes-compra'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "ordenes_compra_delete_own_tenant" ON storage.objects;
CREATE POLICY "ordenes_compra_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'ordenes-compra'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- 3. SELECT para los miembros del tenant (el enlace publico no pasa por RLS,
--    igual que en 041 y 045).
DROP POLICY IF EXISTS "ordenes_compra_select_own_tenant" ON storage.objects;
CREATE POLICY "ordenes_compra_select_own_tenant" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'ordenes-compra'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);
