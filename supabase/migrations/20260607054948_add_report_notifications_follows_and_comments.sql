-- SERVICE REQUESTS new columns
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS response_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assigned_department text,
  ADD COLUMN IF NOT EXISTS reporter_name text;

DROP POLICY IF EXISTS "Anyone can view public reports" ON public.service_requests;
CREATE POLICY "Anyone can view public reports"
  ON public.service_requests FOR SELECT
  TO anon, authenticated
  USING (is_public = true AND category LIKE 'Report:%');

GRANT SELECT ON public.service_requests TO anon;

CREATE OR REPLACE FUNCTION public.service_requests_track_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.response_at IS NULL AND NEW.status <> 'pending' THEN NEW.response_at = now(); END IF;
    IF NEW.status = 'completed' AND NEW.resolved_at IS NULL THEN NEW.resolved_at = now(); END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_service_requests_track_status ON public.service_requests;
CREATE TRIGGER trg_service_requests_track_status
  BEFORE UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.service_requests_track_status();

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own notifications" ON public.notifications;
CREATE POLICY "Users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
CREATE POLICY "Users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON public.notifications(user_id, created_at DESC);

-- REPORT FOLLOWS
CREATE TABLE IF NOT EXISTS public.report_follows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.report_follows TO authenticated;
GRANT ALL ON public.report_follows TO service_role;
ALTER TABLE public.report_follows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Auth view follows" ON public.report_follows;
CREATE POLICY "Auth view follows" ON public.report_follows FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Users follow reports" ON public.report_follows;
CREATE POLICY "Users follow reports" ON public.report_follows FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users unfollow own" ON public.report_follows;
CREATE POLICY "Users unfollow own" ON public.report_follows FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- REPORT COMMENTS
CREATE TABLE IF NOT EXISTS public.report_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid NOT NULL,
  user_id uuid,
  author_name text,
  content text NOT NULL,
  is_official boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.report_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.report_comments TO authenticated;
GRANT ALL ON public.report_comments TO service_role;
ALTER TABLE public.report_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone view comments" ON public.report_comments;
CREATE POLICY "Anyone view comments" ON public.report_comments FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "Auth users comment" ON public.report_comments;
CREATE POLICY "Auth users comment" ON public.report_comments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND (is_official = false OR has_role(auth.uid(), 'admin'::app_role)));
DROP POLICY IF EXISTS "Users delete own comments" ON public.report_comments;
CREATE POLICY "Users delete own comments" ON public.report_comments
  FOR DELETE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_report_comments_report ON public.report_comments(report_id, created_at);

-- NOTIFY TRIGGERS
CREATE OR REPLACE FUNCTION public.notify_report_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rec record; msg text;
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    msg := 'Status changed to ' || NEW.status;
    IF NEW.user_id IS NOT NULL THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (NEW.user_id, 'report_status', NEW.title, msg, '/community-wall');
    END IF;
    FOR rec IN SELECT user_id FROM public.report_follows WHERE report_id = NEW.id LOOP
      IF NEW.user_id IS NULL OR rec.user_id <> NEW.user_id THEN
        INSERT INTO public.notifications(user_id, type, title, body, link)
        VALUES (rec.user_id, 'report_status', NEW.title, msg, '/community-wall');
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION public.notify_report_status_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_status ON public.service_requests;
CREATE TRIGGER trg_notify_status
  AFTER UPDATE ON public.service_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_status_change();

CREATE OR REPLACE FUNCTION public.notify_report_comment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE owner uuid; rep_title text; rec record;
BEGIN
  SELECT user_id, title INTO owner, rep_title FROM public.service_requests WHERE id = NEW.report_id;
  IF owner IS NOT NULL AND owner <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    INSERT INTO public.notifications(user_id, type, title, body, link)
    VALUES (owner, 'report_comment', rep_title, 'New comment on your report', '/community-wall');
  END IF;
  FOR rec IN SELECT user_id FROM public.report_follows WHERE report_id = NEW.report_id LOOP
    IF rec.user_id <> COALESCE(NEW.user_id, '00000000-0000-0000-0000-000000000000'::uuid)
       AND (owner IS NULL OR rec.user_id <> owner) THEN
      INSERT INTO public.notifications(user_id, type, title, body, link)
      VALUES (rec.user_id, 'report_comment', rep_title, 'New comment on a report you follow', '/community-wall');
    END IF;
  END LOOP;
  RETURN NEW;
END;$$;
REVOKE EXECUTE ON FUNCTION public.notify_report_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_notify_comment ON public.report_comments;
CREATE TRIGGER trg_notify_comment
  AFTER INSERT ON public.report_comments
  FOR EACH ROW EXECUTE FUNCTION public.notify_report_comment();

-- CHAT
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  mode text NOT NULL CHECK (mode IN ('ai','staff')),
  title text,
  status text NOT NULL DEFAULT 'open',
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users view own threads" ON public.chat_threads;
CREATE POLICY "Users view own threads" ON public.chat_threads
  FOR SELECT TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Users create own threads" ON public.chat_threads;
CREATE POLICY "Users create own threads" ON public.chat_threads
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users update own threads" ON public.chat_threads;
CREATE POLICY "Users update own threads" ON public.chat_threads
  FOR UPDATE TO authenticated USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS idx_chat_threads_user ON public.chat_threads(user_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user','assistant','admin','system')),
  content text NOT NULL,
  sender_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View messages on accessible threads" ON public.chat_messages;
CREATE POLICY "View messages on accessible threads" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));
DROP POLICY IF EXISTS "Insert messages on accessible threads" ON public.chat_messages;
CREATE POLICY "Insert messages on accessible threads" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.chat_threads t WHERE t.id = thread_id
    AND (t.user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))));
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread ON public.chat_messages(thread_id, created_at);

-- REALTIME (idempotent)
DO $$
DECLARE tname text;
BEGIN
  FOREACH tname IN ARRAY ARRAY['report_comments','report_follows','notifications','chat_threads','chat_messages']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = tname
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tname);
    END IF;
  END LOOP;
END$$;
