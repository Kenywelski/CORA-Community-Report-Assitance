
-- 1. Multi-media on service_requests
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS media_urls TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS media_types TEXT[] DEFAULT '{}'::text[];

-- 2. Public storage bucket for tourism + report media
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-media',
  'public-media',
  true,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/quicktime','video/webm'];

-- Storage RLS policies
DROP POLICY IF EXISTS "Public can view public-media" ON storage.objects;
CREATE POLICY "Public can view public-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'public-media');

DROP POLICY IF EXISTS "Anyone can upload to public-media reports" ON storage.objects;
CREATE POLICY "Anyone can upload to public-media reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'public-media'
    AND (storage.foldername(name))[1] IN ('reports','tourism','announcements')
  );

DROP POLICY IF EXISTS "Admins can manage public-media" ON storage.objects;
CREATE POLICY "Admins can manage public-media"
  ON storage.objects FOR ALL
  USING (bucket_id = 'public-media' AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (bucket_id = 'public-media' AND public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Auth users can delete their public-media" ON storage.objects;
CREATE POLICY "Auth users can delete their public-media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'public-media' AND auth.uid() = owner);

-- 3. Realtime: full row replicas + add tables to publication
ALTER TABLE public.announcements REPLICA IDENTITY FULL;
ALTER TABLE public.events REPLICA IDENTITY FULL;
ALTER TABLE public.posts REPLICA IDENTITY FULL;
ALTER TABLE public.service_requests REPLICA IDENTITY FULL;
ALTER TABLE public.tourist_spots REPLICA IDENTITY FULL;
ALTER TABLE public.feedback REPLICA IDENTITY FULL;

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.events; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.posts; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.tourist_spots; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.feedback; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
