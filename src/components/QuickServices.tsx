import { useNavigate } from 'react-router-dom';
import { 
  AlertCircle, ClipboardList, Bell, MapPin, Siren, CalendarDays,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useAppPreferences } from "@/lib/preferences";
import { toast } from 'sonner';

export const QuickServices = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useAppPreferences();

  const actions = [
    { icon: AlertCircle, label: t.reportIssueBtn, path: "/report-issue", requiresAuth: false, primary: true },
    { icon: ClipboardList, label: t.myReports, path: "/my-requests", requiresAuth: true },
    { icon: Siren, label: t.emergencyContacts, path: "/emergency", requiresAuth: false },
    { icon: MapPin, label: t.barangayDirectory, path: "/directory", requiresAuth: false },
    { icon: CalendarDays, label: t.barangayPrograms, path: "/programs", requiresAuth: false },
    { icon: Bell, label: t.announcements, path: "/updates", requiresAuth: false },
  ];

  const handleActionClick = (action: typeof actions[number]) => {
    if (action.requiresAuth && !user) {
      toast.error('You must be logged in to perform this action.', {
        action: {
          label: t.signIn,
          onClick: () => navigate('/auth'),
        },
      });
      return;
    }
    navigate(action.path);
  };

  return (
    <section className="px-4">
      <h2 className="text-lg font-semibold mb-4">{t.quickActionsTitle}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {actions.map((action, index) => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              type="button"
              onClick={() => handleActionClick(action)}
              className={cn(
                "group flex min-h-20 items-center gap-4 rounded-xl border px-4 py-4 text-left transition-colors animate-slide-up",
                action.primary && "hidden lg:flex",
                action.primary
                  ? "border-primary bg-primary text-primary-foreground shadow-soft hover:bg-primary/90"
                  : "border-border bg-card text-foreground hover:bg-muted/60",
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <Icon className={cn("h-5 w-5 shrink-0", !action.primary && "text-primary")} />
              <span className="flex-1 text-sm font-semibold">{action.label}</span>
              <ArrowRight className="h-4 w-4 shrink-0 opacity-70 transition-transform group-hover:translate-x-1" />
            </button>
          );
        })}
      </div>
    </section>
  );
};
