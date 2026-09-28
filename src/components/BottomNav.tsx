import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Home,
  ClipboardList,
  AlertTriangle,
  Bell,
  Siren,
  MapPin,
  CalendarDays,
  User,
  LogOut,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BottomNavProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const BottomNav = ({ currentPath }: BottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const activePath = currentPath || location.pathname;

  // Fetch unread announcements count (announcements from last 7 days)
  const { data: announcementCount } = useQuery({
    queryKey: ['announcement-count'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { count, error } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('published_at', sevenDaysAgo.toISOString());
      
      if (error) return 0;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  const desktopNavItems = [
    { icon: Home, label: "Home", path: "/" },
    { icon: ClipboardList, label: "My Reports", path: "/my-requests" },
    { icon: AlertTriangle, label: "Report an Issue", path: "/report-issue" },
    { icon: Bell, label: "Announcements", path: "/updates", badge: announcementCount && announcementCount > 0 ? announcementCount : undefined },
    { icon: Siren, label: "Emergency Contacts", path: "/emergency" },
    { icon: MapPin, label: "Barangay Directory", path: "/directory" },
    { icon: CalendarDays, label: "Community Programs", path: "/programs" },
    { icon: User, label: "Profile", path: "/profile" },
  ];
  const mobileNavItems = desktopNavItems.filter((item) =>
    ["Home", "My Reports", "Report an Issue", "Announcements", "Profile"].includes(item.label),
  );

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <>
      {/* Desktop Sidebar - hidden on mobile */}
      <nav aria-label="Main navigation" className="desktop-sidebar fixed inset-y-0 left-0 z-50 hidden w-64 flex-col border-r border-border bg-card px-4 py-6 lg:flex">
        <div className="mb-8 px-3">
          <span className="block text-2xl font-bold leading-none text-primary">CORA</span>
          <span className="mt-1 block text-xs text-muted-foreground">Community Report System</span>
          <span className="mt-3 block text-xs leading-relaxed text-muted-foreground">Barangay Purisima<br />Tago, Surigao del Sur</span>
        </div>
        <div className="flex flex-col gap-1">
          {desktopNavItems.map((item) => {
            const isActive = activePath === item.path;
            const Icon = item.icon;
            return (
              <button
                key={item.path + item.label}
                onClick={() => navigate(item.path)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium transition-colors",
                  isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-5 w-5", isActive && "animate-scale-in")} />
                  {item.badge && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="mt-auto flex items-center gap-3 rounded-lg px-3 py-3 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <LogOut className="h-5 w-5" />
          <span>Logout</span>
        </button>
      </nav>

      {/* Mobile Bottom Nav - hidden on desktop */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb z-50">
        <div className="flex items-center justify-around px-2 py-2">
          {mobileNavItems.map((item) => {
            const isActive = activePath === item.path;
            const isReportAction = item.path === "/report-issue";
            const Icon = isReportAction ? Plus : item.icon;
            return (
              <button
                key={item.path + item.label}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                className={cn(
                  "relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1 transition-all duration-200",
                  isReportAction
                    ? "font-semibold text-primary"
                    : isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <div className={cn(
                  "relative flex h-9 w-9 items-center justify-center",
                  isReportAction && "h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md",
                )}>
                  <Icon className={cn(isReportAction ? "h-6 w-6" : "h-5 w-5", isActive && "animate-scale-in")} />
                  {item.badge && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-bold rounded-full">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="max-w-full text-center text-[9px] font-medium leading-tight">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
