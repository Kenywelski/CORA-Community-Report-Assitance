DROP POLICY IF EXISTS "Owner or staff can view service request uploads" ON storage.objects;

CREATE POLICY "Owner or staff can view service request uploads"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'uploads'
  AND (storage.foldername(name))[1] = 'service-requests'
  AND (
    auth.uid() = owner
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'staff')
  )
);