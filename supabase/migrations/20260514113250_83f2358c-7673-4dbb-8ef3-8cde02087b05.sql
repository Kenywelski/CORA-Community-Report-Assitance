ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS purpose TEXT,
  ADD COLUMN IF NOT EXISTS objective TEXT,
  ADD COLUMN IF NOT EXISTS target_participants TEXT,
  ADD COLUMN IF NOT EXISTS organizer_name TEXT,
  ADD COLUMN IF NOT EXISTS organizer_contact TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'upcoming',
  ADD COLUMN IF NOT EXISTS schedule_details TEXT;

ALTER TABLE public.events REPLICA IDENTITY FULL;

CREATE TABLE IF NOT EXISTS public.emergency_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  department_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  address TEXT,
  availability TEXT NOT NULL DEFAULT '24/7',
  service_type TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.emergency_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active emergency contacts"
  ON public.emergency_contacts FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage emergency contacts"
  ON public.emergency_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_emergency_contacts_updated_at
  BEFORE UPDATE ON public.emergency_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.emergency_contacts REPLICA IDENTITY FULL;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.emergency_contacts;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

INSERT INTO public.emergency_contacts (department_name, contact_number, address, availability, service_type, sort_order) VALUES
  ('Cortes Municipal Police Station', '117', 'Poblacion, Cortes, Surigao del Sur', '24/7', 'Police', 1),
  ('Cortes Bureau of Fire Protection', '160', 'Poblacion, Cortes, Surigao del Sur', '24/7', 'Fire', 2),
  ('MDRRMO Cortes / Rescue', '(086) 000-0000', 'Municipal Hall, Cortes, Surigao del Sur', '24/7', 'Disaster/Rescue', 3),
  ('Cortes Rural Health Unit', '(086) 000-0000', 'Poblacion, Cortes, Surigao del Sur', '24 Hours Emergency', 'Health/Hospital', 4),
  ('Barangay Emergency Hotline', '(086) 000-0000', 'All Barangays, Cortes', '24/7', 'Barangay', 5),
  ('Cortes Municipal Hall', '(086) 000-0000', 'Poblacion, Cortes, Surigao del Sur', 'Mon-Fri 8AM-5PM', 'Government', 6),
  ('Philippine Coast Guard - Surigao', '(086) 000-0000', 'Surigao del Sur', '24/7', 'Maritime', 7),
  ('National Disaster Hotline (NDRRMC)', '911', 'Nationwide', '24/7', 'Disaster/Rescue', 8);