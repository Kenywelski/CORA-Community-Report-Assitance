import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { Navigate } from "react-router-dom";
import { ROUTES } from "@/app/routePaths";

const Index = lazy(() => import('@/features/residents/pages/Index'));
const Landing = lazy(() => import('@/features/landing/pages/Landing'));

/**
 * Gate for the app's home route: visitors (no session) see the landing page,
 * signed-in users go straight to the resident dashboard.
 */
export const HomeGate = () => {
  const { user, isAdmin, isStaff, isLoading, isAccessLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && isAccessLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user && isAdmin) return <Navigate to={ROUTES.admin} replace />;
  if (user && isStaff) return <Navigate to={ROUTES.staff} replace />;
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      {user ? <Index /> : <Landing />}
    </Suspense>
  );
};
