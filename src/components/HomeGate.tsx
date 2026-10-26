import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import Index from "@/pages/Index";
import Landing from "@/pages/Landing";

/**
 * Gate for the app's home route: visitors (no session) see the landing page,
 * signed-in users go straight to the resident dashboard.
 */
export const HomeGate = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <Index /> : <Landing />;
};
