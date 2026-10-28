import { useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface BottomNavProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export function BottomNav({ currentPath }: BottomNavProps) {
  const [collapsed, setCollapsed] = useState(false);
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
      <nav aria-label="Main navigation" data-collapsed={collapsed} className={cn("desktop-sidebar fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-border bg-card lg:flex", collapsed ? "w-20 px-3" : "w-64 px-4")}>
        <div className={cn("flex min-h-20 items-center border-b border-border", collapsed ? "justify-center" : "justify-between gap-2")}>
          {!collapsed && <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-border">
              <img
                src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
                alt="CORA Logo"
                className="h-full w-full scale-[1.18] object-cover"
              />
            </div>
            <div><span className="block text-xl font-extrabold text-primary">CORA</span><span className="block text-[10px] font-medium text-muted-foreground">Community Portal</span></div>
          </div>}
          <Button variant="ghost" size="icon-sm" className="shrink-0 rounded-lg text-muted-foreground" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
            {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          </Button>
        </div>
        {!collapsed && <div className="flex gap-2 py-4 text-xs leading-relaxed text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Barangay Purisima<br />Tago, Surigao del Sur</span></div>}
        <Button
          type="button"
          onClick={() => navigate('/report-issue')}
          variant="accent"
          aria-label="Report an Issue"
          title={collapsed ? "Report an Issue" : undefined}
          className={cn("my-3 shrink-0 rounded-lg", collapsed ? "w-full px-0" : "w-full")}
        >
          <Plus className="h-4 w-4" /> {!collapsed && "Report an Issue"}
        </Button>
        <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto pb-3">
          {desktopNavItems.filter((i) => i.path !== '/report-issue').map((item) => {
            const isActive = activePath === item.path;
            const Icon = item.icon;
            return (
              <div key={item.path}>
              {!collapsed && (item.path === '/' || item.path === '/updates' || item.path === '/profile') && <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.path === '/' ? 'Your reports' : item.path === '/updates' ? 'Community' : 'Account'}</p>}
              <Button
                variant="ghost"
                key={item.path + item.label}
                onClick={() => navigate(item.path)}
                aria-label={item.label}
                title={collapsed ? item.label : undefined}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "relative h-11 w-full gap-3 rounded-lg text-left text-[13px] font-medium",
                  collapsed ? "justify-center px-0" : "justify-start px-3",
                  isActive ? "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {item.badge && (
                    <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {!collapsed && <span className="whitespace-normal leading-tight">{item.label}</span>}
              </Button>
              </div>
            );
          })}
        </div>
        <div className="shrink-0 border-t border-border py-3">
        <Button
          variant="ghost"
          type="button"
          onClick={handleLogout}
          aria-label="Logout"
          title={collapsed ? "Logout" : undefined}
          className={cn("w-full gap-3 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 hover:text-destructive", collapsed ? "justify-center px-0" : "justify-start px-3")}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span>Logout</span>}
        </Button>
        </div>
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
}
