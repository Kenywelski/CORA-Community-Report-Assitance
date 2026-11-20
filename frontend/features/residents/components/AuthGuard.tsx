import { ReactNode } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { LogIn, Lock } from 'lucide-react';
import { useAppPreferences } from '@/lib/preferences';

interface AuthGuardProps {
  children: ReactNode;
  fallback?: 'redirect' | 'message' | 'inline';
  message?: string;
}

export const AuthGuard = ({ 
  children, 
  fallback = 'message',
  message = 'You must be logged in to perform this action.'
}: AuthGuardProps) => {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const { translate } = useAppPreferences();

  if (isLoading) {
    return null;
  }

  if (!user) {
    if (fallback === 'redirect') {
      return <Navigate to="/auth" replace />;
    }

    if (fallback === 'inline') {
      return (
        <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl text-sm">
          <Lock className="h-4 w-4 text-warning shrink-0" />
          <span className="text-warning">{translate(message)}</span>
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => navigate('/auth')}
            className="ml-auto shrink-0"
          >
            {translate('Sign In')}
          </Button>
        </div>
      );
    }

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-4">
        <Card variant="elevated" className="max-w-sm w-full">
          <CardContent className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-4">
              <Lock className="h-8 w-8 text-warning" />
            </div>
            <h2 className="text-lg font-semibold mb-2">{translate('Login Required')}</h2>
            <p className="text-muted-foreground text-sm mb-6">{translate(message)}</p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => navigate('/auth')} className="w-full">
                <LogIn className="h-4 w-4 mr-2" />
                {translate('Sign In')}
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')} className="w-full">
                {translate('Go Home')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};

// Hook for checking auth in action handlers
export const useAuthAction = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { translate } = useAppPreferences();

  const requireAuth = (callback: () => void) => {
    if (!user) {
      // Using sonner toast
      import('sonner').then(({ toast }) => {
        toast.error(translate('You must be logged in to perform this action.'), {
          action: {
            label: translate('Sign In'),
            onClick: () => navigate('/auth'),
          },
        });
      });
      return;
    }
    callback();
  };

  return { requireAuth, isAuthenticated: !!user };
};
