-- 1. Municipal knowledge base for the AI agent (RAG source)
CREATE TABLE IF NOT EXISTS public.municipal_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text NOT NULL,
  content text NOT NULL,
  tags text[] NOT NULL DEFAULT '{}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.municipal_knowledge TO anon;
GRANT SELECT ON public.municipal_knowledge TO authenticated;
GRANT ALL ON public.municipal_knowledge TO service_role;

ALTER TABLE public.municipal_knowledge ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active knowledge" ON public.municipal_knowledge;
CREATE POLICY "Anyone can read active knowledge" ON public.municipal_knowledge
  FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage knowledge" ON public.municipal_knowledge;
CREATE POLICY "Admins manage knowledge" ON public.municipal_knowledge
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.municipal_knowledge (title, category, content, tags) VALUES
('Filing a complaint or report', 'process', 'Residents of Cortes, Surigao del Sur may file a complaint or report anytime through myCortes. A valid report needs: the type of issue, the barangay, a clear description of what happened and when, and ideally a photo. Contact details are optional but allow the office to send updates. Reports are reviewed by the municipal office and routed to the responsible department automatically.', ARRAY['file','report','complaint','how','submit']),
('Response time commitments', 'process', 'Critical hazards (danger to life, active fire, flooding, crime in progress) are acted on within 24 hours. High priority issues such as safety risks or outages affecting many residents are addressed within 48 hours. Standard repairs and service concerns are handled within 72 hours. Minor or cosmetic issues may take up to 7 working days.', ARRAY['response','time','how long','deadline','sla']),
('Emergencies are not complaints', 'safety', 'Life-threatening emergencies must never be reported through the app alone. Residents must call the MDRRMO/Rescue, Police, Fire, or the Municipal Disaster Hotline immediately. The complaint system is for non-immediate municipal concerns and follow-up documentation.', ARRAY['emergency','fire','accident','rescue','urgent','911']),
('Road damage and potholes', 'category', 'Road damage, potholes, collapsed shoulders and damaged municipal roads are handled by the Engineering Department. Required details: exact barangay, nearest landmark, approximate size of the damage, and whether it is already causing accidents. Photos speed up validation and scheduling of repairs.', ARRAY['road','pothole','asphalt','street','engineering']),
('Street lighting problems', 'category', 'Busted, flickering or missing street lights are handled by the Maintenance Department. Required details: barangay, the nearest house number or landmark, the pole number if visible, and whether the whole area is dark or only one lamp.', ARRAY['street light','lamp','dark','electric','maintenance']),
('Garbage collection and waste', 'category', 'Uncollected garbage, illegal dumping and waste concerns are handled by General Services. Required details: barangay, specific spot, how long the waste has been there, and whether it is household, market, or hazardous waste.', ARRAY['garbage','trash','waste','dumping','collection']),
('Drainage, canals and flooding', 'category', 'Clogged canals, broken drainage and localized flooding are handled by Engineering together with the MDRRMO when there is a flood risk. Required details: barangay, the affected street, water depth if flooded, and whether houses are already affected.', ARRAY['drainage','canal','flood','clog','water']),
('Water supply concerns', 'category', 'Interrupted supply, leaking pipes and unsafe drinking water are handled by General Services and the Health Office for water quality. Required details: barangay, how many households are affected, when the interruption started, and the water condition (murky, smelly, none).', ARRAY['water','supply','pipe','leak','no water']),
('Public safety and peace concerns', 'category', 'Public safety concerns, disturbances and suspicious activity are handled by the Security office in coordination with the PNP. Required details: barangay, date and time it happened, what exactly was observed. Do not confront anyone; never include accusations you cannot support.', ARRAY['safety','peace','security','crime','disturbance']),
('Stray animals', 'category', 'Stray dogs and other animals roaming public areas are handled by the Health Office (rabies control). Required details: barangay, the location, how many animals, and whether anyone has already been bitten. A bite case is high priority and must also be reported to the health center immediately.', ARRAY['stray','dog','animal','rabies','bite']),
('Anonymous and private reports', 'privacy', 'Residents may submit reports anonymously. A report can also be kept private to the municipality instead of being shown on the Community Wall. Personal details such as contact numbers are never published publicly.', ARRAY['anonymous','private','privacy','confidential']),
('Tracking a report', 'process', 'Every submitted report can be tracked in Track My Reports. Status moves from Pending to Acknowledged/Processing and finally Completed or Rejected, with the office remarks shown on the report card. Residents with contact details also receive notifications.', ARRAY['track','status','follow up','update','progress']),
('Official barangays of Cortes', 'reference', 'Cortes, Surigao del Sur has 11 barangays: Burgos, Capandan, Mabahin, Madreliño, Manlico, Matho, Poblacion, Tag-Anongan, Tigao, Tuboran, and Uba. A complaint must name one of these barangays.', ARRAY['barangay','location','where','place'])
ON CONFLICT DO NOTHING;

-- 2. Make sure admins actually receive every new report as a notification
CREATE OR REPLACE FUNCTION public.notify_admins_new_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, link)
  SELECT ur.user_id,
         'new_report',
         NEW.title,
         COALESCE(NEW.location, 'Cortes') || ' — new report submitted',
         '/admin/requests'
  FROM public.user_roles ur
  WHERE ur.role = 'admin'::app_role;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_new_report ON public.service_requests;
CREATE TRIGGER trg_notify_admins_new_report
AFTER INSERT ON public.service_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_report();

-- 3. Give the project owner admin access (currently staff only)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM auth.users WHERE email = 'gwenapuli2005@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;