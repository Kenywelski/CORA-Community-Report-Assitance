
-- Allow admins to delete service requests
CREATE POLICY "Admins can delete service requests"
ON public.service_requests
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete feedback
CREATE POLICY "Admins can delete feedback"
ON public.feedback
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update feedback (for marking handled, optional)
CREATE POLICY "Admins can update feedback"
ON public.feedback
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete profiles (cleanup)
CREATE POLICY "Admins can delete profiles"
ON public.profiles
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update any profile
CREATE POLICY "Admins can update any profile"
ON public.profiles
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'::app_role));
