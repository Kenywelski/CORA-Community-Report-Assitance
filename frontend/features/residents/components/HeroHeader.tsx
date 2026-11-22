import { useNavigate } from 'react-router-dom';
import { ArrowRight, User } from "lucide-react";
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { NotificationBell } from "@/features/residents/components/NotificationBell";
import { supabase } from '@/integrations/supabase/client';
import { useAppPreferences } from "@/lib/preferences";
import purisimaSunrise from "@/features/residents/assets/purisima-sunrise.jpg";

export const HeroHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, translate } = useAppPreferences();
  const { data: savedAvatarUrl } = useQuery({
    queryKey: ['profile-avatar', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.avatar_url ?? null;
    },
    staleTime: 1000 * 60 * 5,
  });
  const residentName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0];
  const googleAvatarUrl = [
    user?.user_metadata?.avatar_url,
    user?.user_metadata?.picture,
  ].find((value): value is string => typeof value === 'string' && value.length > 0);
  const profileAvatarUrl = savedAvatarUrl || googleAvatarUrl;

  return (
    <header className="pb-4 pt-5 lg:pb-6 lg:pt-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-stretch gap-3">
          <span aria-hidden="true" className="min-h-[52px] w-1.5 shrink-0 rounded-full bg-primary" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium leading-[1.35] text-muted-foreground">
              {t.welcome}{residentName ? `, ${residentName}` : ''}
            </p>
            <h1 className="mt-0.5 truncate text-[28px] font-extrabold leading-none tracking-[-0.035em] text-foreground sm:text-[30px]">
              {translate('Home')}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell
            iconClassName="text-foreground"
            buttonClassName="h-10 w-10 rounded-full border border-border bg-card text-foreground shadow-sm hover:bg-muted"
          />
          <Button
            variant="ghost"
            size="icon"
            aria-label={translate('User profile')}
            className="h-10 w-10 rounded-full border border-border bg-card p-0 text-foreground shadow-sm hover:bg-muted"
            onClick={() => navigate(user ? '/profile' : '/auth')}
          >
            {profileAvatarUrl ? (
              <img src={profileAvatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
            ) : (
              <User className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>

      <div
        className="relative mt-5 overflow-hidden rounded-2xl bg-cover bg-center p-5 text-primary-foreground shadow-md sm:p-6 lg:px-7 lg:py-6"
        style={{
          backgroundImage: `linear-gradient(90deg, rgba(6, 78, 69, 0.92) 0%, rgba(10, 91, 82, 0.78) 52%, rgba(6, 45, 42, 0.42) 100%), url(${purisimaSunrise})`,
          backgroundPosition: 'center 56%',
        }}
      >
        <div className="relative max-w-3xl">
          <h2 className="text-xl font-extrabold leading-tight sm:text-2xl">{t.heroTitle}</h2>
          <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-primary-foreground/90 sm:text-sm">
            {t.heroSubtitle}
          </p>
          <Button
            variant="accent"
            size="default"
            className="mt-4 h-10 rounded-full px-5 shadow-md"
            onClick={() => navigate('/report-issue')}
          >
            <span>{t.reportIssueBtn}</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};
