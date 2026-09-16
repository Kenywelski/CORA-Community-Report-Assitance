GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_requests TO authenticated;
GRANT SELECT, INSERT ON public.service_requests TO anon;
GRANT ALL ON public.service_requests TO service_role;