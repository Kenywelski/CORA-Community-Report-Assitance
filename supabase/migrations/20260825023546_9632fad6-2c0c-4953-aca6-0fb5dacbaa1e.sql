-- 1. Departments
CREATE TABLE public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  slug text,
  is_active boolean NOT NULL DEFAULT true,
  response_hours integer NOT NULL DEFAULT 72,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.departments TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active departments" ON public.departments FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage departments" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Complaint categories
CREATE TABLE public.complaint_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  keywords text[] NOT NULL DEFAULT '{}',
  default_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.complaint_categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.complaint_categories TO authenticated;
GRANT ALL ON public.complaint_categories TO service_role;
ALTER TABLE public.complaint_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active categories" ON public.complaint_categories FOR SELECT USING (is_active OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage categories" ON public.complaint_categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER update_complaint_categories_updated_at BEFORE UPDATE ON public.complaint_categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Staff role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';

-- 4. Staff members
CREATE TABLE public.staff_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  position text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_members TO authenticated;
GRANT ALL ON public.staff_members TO service_role;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER update_staff_members_updated_at BEFORE UPDATE ON public.staff_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. AI logs
CREATE TABLE public.ai_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES public.service_requests(id) ON DELETE CASCADE,
  action text NOT NULL,
  decision text,
  confidence numeric,
  reasoning text,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  actor text NOT NULL DEFAULT 'ai',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_logs TO authenticated;
GRANT ALL ON public.ai_logs TO service_role;
ALTER TABLE public.ai_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view ai logs" ON public.ai_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 6. System settings
CREATE TABLE public.system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.system_settings TO authenticated;
GRANT ALL ON public.system_settings TO service_role;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can read settings" ON public.system_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage settings" ON public.system_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 7. Extend service_requests
ALTER TABLE public.service_requests
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.complaint_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_priority text,
  ADD COLUMN IF NOT EXISTS ai_department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS ai_confidence numeric,
  ADD COLUMN IF NOT EXISTS ai_reason text,
  ADD COLUMN IF NOT EXISTS ai_processed_at timestamptz,
  ADD COLUMN IF NOT EXISTS requires_review boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_overridden boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS action_taken text,
  ADD COLUMN IF NOT EXISTS escalated_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_service_requests_department ON public.service_requests(department_id);
CREATE INDEX IF NOT EXISTS idx_ai_logs_report ON public.ai_logs(report_id);

-- 8. Seed departments
INSERT INTO public.departments (name, slug, description, response_hours) VALUES
  ('Maintenance', 'maintenance', 'Repairs and upkeep of public facilities, lighting, and structures', 48),
  ('Engineering', 'engineering', 'Roads, drainage, bridges and infrastructure projects', 72),
  ('IT', 'it', 'Computers, network, internet and digital systems', 24),
  ('Security', 'security', 'Peace and order, public safety incidents', 12),
  ('General Services', 'general-services', 'Garbage collection, sanitation and cleanliness', 48),
  ('Health Office', 'health', 'Health, sanitation hazards and medical concerns', 24),
  ('Social Welfare', 'social-welfare', 'Assistance, welfare and social services concerns', 72),
  ('Student Affairs', 'student-affairs', 'Documents, records and resident/student concerns', 72)
ON CONFLICT (name) DO NOTHING;

-- 9. Seed categories mapped to departments
INSERT INTO public.complaint_categories (name, description, keywords, default_department_id)
SELECT v.name, v.description, v.keywords, d.id
FROM (VALUES
  ('Road / Infrastructure', 'Potholes, damaged roads, bridges', ARRAY['road','pothole','bridge','pavement','kalsada'], 'Engineering'),
  ('Drainage / Flooding', 'Canals, drainage and flooding', ARRAY['drainage','canal','flood','baha'], 'Engineering'),
  ('Street Light / Electrical', 'Broken lights and electrical issues', ARRAY['light','bombilya','electric','post'], 'Maintenance'),
  ('Facility Damage', 'Damaged public facilities and buildings', ARRAY['broken','damage','facility','building','sira'], 'Maintenance'),
  ('IT / Network', 'Computers, internet and systems', ARRAY['computer','internet','wifi','network','system','printer'], 'IT'),
  ('Security Incident', 'Theft, violence, and safety incidents', ARRAY['theft','violence','security','crime','holdap'], 'Security'),
  ('Garbage / Sanitation', 'Waste collection and sanitation', ARRAY['garbage','waste','basura','sanitation','trash'], 'General Services'),
  ('Water Supply', 'Water service interruptions and leaks', ARRAY['water','tubig','leak','supply'], 'General Services'),
  ('Health Concern', 'Health hazards and medical concerns', ARRAY['health','dengue','medical','clinic','sakit'], 'Health Office'),
  ('Document / Records', 'Certificates, permits and records', ARRAY['certificate','document','permit','record','clearance'], 'Student Affairs'),
  ('Other', 'Uncategorized concerns', ARRAY[]::text[], NULL)
) AS v(name, description, keywords, dept)
LEFT JOIN public.departments d ON d.name = v.dept
ON CONFLICT (name) DO NOTHING;

-- 10. Settings defaults
INSERT INTO public.system_settings (key, value, description) VALUES
  ('ai_confidence_threshold', '70'::jsonb, 'Minimum AI confidence (%) required for automatic assignment'),
  ('default_response_hours', '72'::jsonb, 'Default hours before a complaint is considered overdue'),
  ('ai_routing_enabled', 'true'::jsonb, 'Enable automatic AI complaint routing')
ON CONFLICT (key) DO NOTHING;