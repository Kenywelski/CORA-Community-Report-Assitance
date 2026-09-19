-- Keep admin access only for admin@municipal.gov
DELETE FROM public.user_roles
WHERE role = 'admin'
  AND user_id <> 'a5379534-42ba-497e-8bca-f2d04f878ff3'::uuid;

-- Allow guests (not logged in) to upload report evidence into reports/guest/
CREATE POLICY "Guests upload report media"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
  bucket_id = 'public-media'
  AND (storage.foldername(name))[1] = 'reports'
  AND (storage.foldername(name))[2] = 'guest'
);