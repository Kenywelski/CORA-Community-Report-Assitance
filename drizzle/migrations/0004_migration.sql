GRANT EXECUTE ON FUNCTION public.is_active_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_staff_department(uuid) TO authenticated;
ALTER POLICY "Admins can delete service requests" ON public.service_requests TO authenticated;
ALTER POLICY "Admins can update all requests" ON public.service_requests TO authenticated;
ALTER POLICY "Admins can view all requests" ON public.service_requests TO authenticated;
ALTER POLICY "Users can update their own pending requests" ON public.service_requests TO authenticated;