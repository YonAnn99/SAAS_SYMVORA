-- 041_logos_storage_bucket.sql
-- Ensures the "logos" Storage bucket and its RLS policies exist.
-- Fixes: signup logo upload silently failing because this bucket/policies
-- were only ever created ad-hoc in the Supabase Studio UI, never tracked
-- in a migration. Safe to re-run.

-- 1. Bucket: public (so getPublicUrl() works without signed URLs),
--    2MB limit matching the FileUpload component's client-side check,
--    restricted mime types.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'logos',
  'logos',
  true,
  2097152, -- 2 MB, matches MAX_SIZE_BYTES in src/components/ui/file-upload.tsx
  ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 2. RLS policies on storage.objects, scoped to bucket_id = 'logos'.
--    Path convention: {auth.uid()}/logo.webp — a user may only write
--    under a folder matching their own auth.uid().

DROP POLICY IF EXISTS "logos_insert_own_folder" ON storage.objects;
CREATE POLICY "logos_insert_own_folder" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "logos_update_own_folder" ON storage.objects;
CREATE POLICY "logos_update_own_folder" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. SELECT policy: included explicitly for safety even though the bucket
--    is public. Supabase serves public-bucket objects via the
--    `/storage/v1/object/public/...` endpoint, which checks bucket.public
--    directly and does NOT evaluate storage.objects RLS — so this policy
--    is technically redundant for the public URL path. It is added anyway
--    so that authenticated SDK reads (non-public endpoint) aren't blocked
--    by default-deny RLS.
DROP POLICY IF EXISTS "logos_select_own_folder" ON storage.objects;
CREATE POLICY "logos_select_own_folder" ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'logos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
