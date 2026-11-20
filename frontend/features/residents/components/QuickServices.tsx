import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Bell, MapPin, Siren, CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { useAppPreferences } from "@/lib/preferences";
import { toast } from 'sonner';

export const QuickServices = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, translate } = useAppPreferences();

  const actions = [
    { icon: ClipboardList, label: t.myReports, path: "/my-requests", requiresAuth: true, iconClass: "bg-primary/10 text-primary" },
    { icon: Bell, label: t.announcements, path: "/updates", requiresAuth: false, iconClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
    { icon: Siren, label: t.emergencyContacts, path: "/emergency", requiresAuth: false, iconClass: "bg-emergency/10 text-emergency" },
    { icon: MapPin, label: t.barangayDirectory, path: "/directory", requiresAuth: false, iconClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { icon: CalendarDays, label: t.barangayPrograms, path: "/programs", requiresAuth: false, iconClass: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  ];

  const handleActionClick = (action: typeof actions[number]) => {
    if (action.requiresAuth && !user) {
      toast.error(translate('You must be logged in to perform this action.'), {
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
      <h2 className="mb-3 text-base font-semibold text-foreground sm:text-lg">{t.quickActionsTitle}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {actions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.path}
              type="button"
              onClick={() => handleActionClick(action)}
              className="group flex min-h-28 flex-col items-start justify-between rounded-2xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/30 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", action.iconClass)}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="mt-4 text-sm font-semibold leading-snug text-foreground">
                {action.label}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
