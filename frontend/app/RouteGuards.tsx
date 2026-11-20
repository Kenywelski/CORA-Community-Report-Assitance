import { Loader2 } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { ROUTES } from './routePaths';

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

export function AdminRoute() {
  const { user, isAdmin, isLoading, isAccessLoading } = useAuth();
  const location = useLocation();
  if (isLoading || (user && isAccessLoading)) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.auth} replace state={{ from: location }} />;
  if (!isAdmin) return <Navigate to={ROUTES.home} replace />;
  return <Outlet />;
}

export function StaffRoute() {
  const { user, isAdmin, isStaff, isLoading, isAccessLoading } = useAuth();
  const location = useLocation();
  if (isLoading || (user && isAccessLoading)) return <LoadingScreen />;
  if (!user) return <Navigate to={ROUTES.auth} replace state={{ from: location }} />;
  if (isAdmin) return <Navigate to={ROUTES.admin} replace />;
  if (!isStaff) return <Navigate to={ROUTES.home} replace />;
  return <Outlet />;
}
