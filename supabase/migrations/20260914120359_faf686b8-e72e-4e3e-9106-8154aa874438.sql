-- public-media: non-admin uploads must go into reports/<uid>/ or tourism/<uid>/
DROP POLICY IF EXISTS "Authenticated users can upload to public-media" ON storage.objects;

CREATE POLICY "Users upload to own public-media folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'public-media'
  AND (storage.foldername(name))[1] = ANY (ARRAY['reports','tourism'])
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- uploads bucket: only the owner, or admins/staff, can read service-request media
DROP POLICY IF EXISTS "Authenticated users can view service request uploads" ON storage.objects;

CREATE POLICY "Owner or staff can view service request uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'service-requests'
  AND (
    auth.uid() = owner
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_active_staff(auth.uid())
  )
);