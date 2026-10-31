import { useNavigate } from 'react-router-dom';
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageThemeControls, useAppPreferences } from "@/lib/preferences";
import heroImage from "@/assets/hero-coastal.jpg";

export const HeroHeader = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useAppPreferences();
  const residentName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split('@')[0];

  return (
    <header className="relative overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img src={heroImage} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 hero-gradient opacity-85" />
      </div>

      <div className="relative z-10 px-4 pt-10 pb-8 lg:pt-6 lg:pb-12 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-8">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white overflow-hidden flex items-center justify-center shadow-sm ring-1 ring-white/30 shrink-0">
              <img
                src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
                alt="CORA Logo"
                className="w-full h-full scale-[1.18] object-cover"
              />
            </div>
            <div>
              <p className="text-white/90 text-sm font-semibold">{t.systemTitle}</p>
              <p className="text-white/70 text-xs">{t.barangaySubtitle}</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <LanguageThemeControls variant="hero" />
            <NotificationBell iconClassName="text-white" buttonClassName="text-white hover:bg-white/20" />
            <Button variant="ghost" size="icon" aria-label="User profile" className="text-white hover:bg-white/20" onClick={() => navigate(user ? '/profile' : '/auth')}>
              <User className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="mb-6 lg:max-w-lg">
          <p className="text-white/80 text-sm mb-1">{t.welcome}{residentName ? `, ${residentName}` : ''}</p>
          <h2 className="text-white text-2xl lg:text-3xl font-bold mb-2">{t.heroTitle}</h2>
          <p className="text-white/80 text-sm lg:text-base leading-relaxed">{t.heroSubtitle}</p>
        </div>

        <Button variant="accent" size="lg" className="w-full lg:w-auto lg:px-8" onClick={() => navigate('/report-issue')}>
          <span>{t.reportIssueBtn}</span>
        </Button>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-6 bg-background rounded-t-3xl" />
    </header>
  );
};
