-- 045_product_images_storage_bucket.sql
-- Storage bucket + RLS policies for product photos (productos.imagen_url).
-- Mirrors the "logos" bucket pattern (migration 041), but scoped by
-- tenant_id instead of auth.uid() — a product photo belongs to the
-- tenant, and any member of that tenant may upload/replace it, not just
-- the user who originally created the product.

-- 1. Bucket: public (so getPublicUrl() works without signed URLs),
--    2MB limit matching FileUpload's client-side check.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  2097152, -- 2 MB
  ARRAY['image/webp', 'image/png', 'image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies on storage.objects, scoped to bucket_id = 'product-images'.
--    Path convention: {tenant_id}/{uuid}.webp — any member of that
--    tenant (any role) may write to their own tenant's folder.

DROP POLICY IF EXISTS "product_images_insert_own_tenant" ON storage.objects;
CREATE POLICY "product_images_insert_own_tenant" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "product_images_update_own_tenant" ON storage.objects;
CREATE POLICY "product_images_update_own_tenant" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
)
WITH CHECK (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "product_images_delete_own_tenant" ON storage.objects;
CREATE POLICY "product_images_delete_own_tenant" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);

-- 3. SELECT policy: included for safety even though the bucket is public
--    (the public URL path bypasses RLS entirely, same note as in 041).
DROP POLICY IF EXISTS "product_images_select_own_tenant" ON storage.objects;
CREATE POLICY "product_images_select_own_tenant" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'product-images'
  AND EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.user_id = auth.uid()
      AND tm.tenant_id::text = (storage.foldername(name))[1]
  )
);
