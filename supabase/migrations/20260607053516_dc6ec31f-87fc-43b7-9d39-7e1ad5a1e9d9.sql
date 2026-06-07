
-- 1. Announcement-images storage admin-only writes
DROP POLICY IF EXISTS "Authenticated users can upload announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update announcement images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete announcement images" ON storage.objects;

CREATE POLICY "Admins can upload announcement images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'announcement-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can update announcement images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'announcement-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Admins can delete announcement images"
ON storage.objects FOR DELETE
USING (bucket_id = 'announcement-images' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- 2. public-media uploads require authentication
DROP POLICY IF EXISTS "Anyone can upload to public-media reports" ON storage.objects;

CREATE POLICY "Authenticated users can upload to public-media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'public-media'
  AND auth.uid() IS NOT NULL
  AND (storage.foldername(name))[1] = ANY (ARRAY['reports','tourism','announcements'])
);

-- 3. report_likes: hide user_id from anonymous
DROP POLICY IF EXISTS "Anyone can view likes" ON public.report_likes;
CREATE POLICY "Authenticated users can view likes"
ON public.report_likes FOR SELECT
TO authenticated
USING (true);

-- 4. post_likes: same treatment
DROP POLICY IF EXISTS "Anyone can view post likes" ON public.post_likes;
CREATE POLICY "Authenticated users can view post likes"
ON public.post_likes FOR SELECT
TO authenticated
USING (true);

-- 5. service_requests: stop publicly exposing anonymous rows
DROP POLICY IF EXISTS "Users can view their own requests or public reports" ON public.service_requests;
CREATE POLICY "Users can view their own requests"
ON public.service_requests FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Tighten "Users can create their own requests" so authenticated users can't impersonate NULL
DROP POLICY IF EXISTS "Users can create their own requests" ON public.service_requests;
CREATE POLICY "Users can create their own requests"
ON public.service_requests FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Keep anonymous incident reporting capability (category like 'Report:%') for guests,
-- but ensure they always insert with user_id = NULL (admins read these).
DROP POLICY IF EXISTS "Anyone can submit reports" ON public.service_requests;
CREATE POLICY "Anyone can submit anonymous reports"
ON public.service_requests FOR INSERT
WITH CHECK (
  category LIKE 'Report:%'
  AND user_id IS NULL
);

-- 6. posts: prevent role spoofing on insert
DROP POLICY IF EXISTS "Users can create their own posts" ON public.posts;
CREATE POLICY "Users can create their own posts"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND (
    created_by_role IS NULL
    OR created_by_role = 'user'
    OR (created_by_role = 'admin' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  )
);

-- Also restrict anonymous report posts to default role
DROP POLICY IF EXISTS "Anyone can create anonymous reports" ON public.posts;
CREATE POLICY "Anyone can create anonymous reports"
ON public.posts FOR INSERT
WITH CHECK (
  post_type = 'report'::public.post_type
  AND is_anonymous = true
  AND created_by IS NULL
  AND (created_by_role IS NULL OR created_by_role = 'user')
);

-- 7. Lock down SECURITY DEFINER function executability
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
