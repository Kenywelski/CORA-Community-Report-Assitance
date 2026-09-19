DROP POLICY IF EXISTS "Admins can manage public-media" ON storage.objects;
CREATE POLICY "Admins can manage public-media"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'public-media' AND has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (bucket_id = 'public-media' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can upload announcement images" ON storage.objects;
CREATE POLICY "Admins can upload announcement images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'announcement-images' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can update announcement images" ON storage.objects;
CREATE POLICY "Admins can update announcement images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'announcement-images' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete announcement images" ON storage.objects;
CREATE POLICY "Admins can delete announcement images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'announcement-images' AND has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Auth users can delete their public-media" ON storage.objects;
CREATE POLICY "Auth users can delete their public-media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'public-media' AND auth.uid() = owner);