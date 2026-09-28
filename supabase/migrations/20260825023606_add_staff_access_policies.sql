CREATE OR REPLACE FUNCTION public.get_staff_department(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT department_id FROM public.staff_members WHERE user_id = _user_id AND is_active LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_staff_department(uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION public.is_active_staff(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.staff_members WHERE user_id = _user_id AND is_active)
$$;
REVOKE EXECUTE ON FUNCTION public.is_active_staff(uuid) FROM public, anon;

-- staff_members policies
CREATE POLICY "Admins manage staff members" ON public.staff_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Staff view own record" ON public.staff_members FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Staff view department colleagues" ON public.staff_members FOR SELECT TO authenticated
  USING (department_id IS NOT NULL AND department_id = public.get_staff_department(auth.uid()));

-- staff access to reports
CREATE POLICY "Staff view department reports" ON public.service_requests FOR SELECT TO authenticated
  USING (department_id IS NOT NULL AND department_id = public.get_staff_department(auth.uid()));
CREATE POLICY "Staff update department reports" ON public.service_requests FOR UPDATE TO authenticated
  USING (department_id IS NOT NULL AND department_id = public.get_staff_department(auth.uid()))
  WITH CHECK (department_id IS NOT NULL AND department_id = public.get_staff_department(auth.uid()));

-- staff access to ai logs
CREATE POLICY "Staff view department ai logs" ON public.ai_logs FOR SELECT TO authenticated
  USING (department_id IS NOT NULL AND department_id = public.get_staff_department(auth.uid()));