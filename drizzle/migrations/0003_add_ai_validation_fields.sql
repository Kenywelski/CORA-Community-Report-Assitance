ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS ai_validation_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS ai_validation_reason text,
  ADD COLUMN IF NOT EXISTS ai_validation_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_validation_elements jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS admin_review_status text NOT NULL DEFAULT 'unreviewed',
  ADD COLUMN IF NOT EXISTS admin_review_notes text;

CREATE INDEX IF NOT EXISTS idx_service_requests_ai_validation_status
  ON public.service_requests (ai_validation_status);