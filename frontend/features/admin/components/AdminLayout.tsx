import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/features/auth/useAuth';
import { LanguageThemeControls, useAppPreferences } from '@/lib/preferences';
import { toast } from 'sonner';
import { AdminSidebar } from './AdminSidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const AdminLayout = ({ children, title, subtitle }: AdminLayoutProps) => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading } = useAuth();
  const { translate } = useAppPreferences();

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error(translate('Access denied'));
    }
  }, [user, isAdmin, isLoading, navigate, translate]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="admin-layout min-h-screen bg-[#f7fbfc] text-foreground dark:bg-background dark:[--border:199_31%_22%] dark:[--input:199_31%_22%]">
      <AdminSidebar />

      <main className="min-h-screen pt-14 transition-[margin] duration-300 lg:ml-[282px] lg:pt-0 lg:pr-6 peer-data-[collapsed=true]:lg:ml-[104px]">
        <header className="px-4 pt-6 sm:px-6 lg:px-3 lg:pt-8">
          <div className="mx-auto flex w-full max-w-[960px] flex-wrap items-center justify-between gap-4">
            <div className="relative min-w-0 pl-5">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-[5px] rounded-full bg-primary"
              />
              <h1 className="text-2xl font-extrabold tracking-[-0.035em] text-foreground lg:text-[1.9rem]">{translate(title)}</h1>
              {subtitle && (
                <p className="mt-0.5 text-sm font-medium text-muted-foreground lg:text-base">{translate(subtitle)}</p>
              )}
            </div>
            <LanguageThemeControls variant="admin" className="hidden lg:inline-flex" />
          </div>
        </header>

        <div className="mx-auto w-full max-w-[960px] p-4 sm:p-6 lg:px-0 lg:pb-12 lg:pt-[30px]">
          {children}
        </div>
      </main>
    </div>
  );
};
