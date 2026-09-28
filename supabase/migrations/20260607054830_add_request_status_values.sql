-- ============ ENUM EXTENSION ============
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'assigned';
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'closed';
