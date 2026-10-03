CREATE TABLE public.ai_feedback_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.service_requests(id) ON DELETE CASCADE,
  admin_id uuid NOT NULL,
  ai_verdict text NOT NULL,
  admin_verdict text NOT NULL,
  is_agreed boolean NOT NULL,
  ai_confidence numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_feedback_logs TO authenticated;
GRANT ALL ON public.ai_feedback_logs TO service_role;
ALTER TABLE public.ai_feedback_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read feedback logs" ON public.ai_feedback_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins insert feedback logs" ON public.ai_feedback_logs FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin') AND admin_id = auth.uid());
CREATE INDEX ON public.ai_feedback_logs(report_id);