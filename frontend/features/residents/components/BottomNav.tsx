import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  CalendarDays,
  ClipboardList,
  House,
  LogOut,
  MapPin,
  PanelLeft,
  Plus,
  Settings,
  Siren,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/useAuth';
import {
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  isPhoneUserAgent,
  isResidentNavItemActive,
  parseSidebarCollapsed,
  resolveActiveResidentPath,
} from '@/lib/residentNav';
import { useAppPreferences } from '@/lib/preferences';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';

interface BottomNavProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
  hideMobile?: boolean;
  hideDesktop?: boolean;
}

interface DesktopNavItem {
  id: string;
  label: string;
  path: string;
  icon: LucideIcon;
  badge?: number;
}

const SIDEBAR_SCROLL_STORAGE_KEY = 'cora:resident-sidebar-scroll-top';

export function BottomNav({ currentPath, onNavigate, hideMobile = false, hideDesktop = false }: BottomNavProps) {
  const sidebarScrollRef = useRef<HTMLDivElement>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return parseSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  const isPhone = typeof navigator !== 'undefined' && isPhoneUserAgent(navigator.userAgent);
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();
  const { t, translate } = useAppPreferences();
  const activePath = resolveActiveResidentPath(location.pathname, currentPath);

  const saveSidebarScrollPosition = useCallback(() => {
    const scrollContainer = sidebarScrollRef.current;
    if (!scrollContainer) return;

    try {
      window.sessionStorage.setItem(SIDEBAR_SCROLL_STORAGE_KEY, String(scrollContainer.scrollTop));
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, []);

  useLayoutEffect(() => {
    if (isPhone) return;

    const scrollContainer = sidebarScrollRef.current;
    if (!scrollContainer) return;

    try {
      const storedPosition = Number(window.sessionStorage.getItem(SIDEBAR_SCROLL_STORAGE_KEY));
      if (Number.isFinite(storedPosition) && storedPosition > 0) {
        scrollContainer.scrollTop = storedPosition;
      }
    } catch {
      // Ignore storage errors in restricted browsing modes.
    }
  }, [isPhone]);

  const { data: announcementCount, isError: announcementCountError } = useQuery({
    queryKey: ['announcement-count'],
    queryFn: async () => {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { count, error } = await supabase
        .from('announcements')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('published_at', sevenDaysAgo.toISOString());

      if (error) throw error;
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    if (announcementCountError) {
      toast.error(translate('Unable to update announcement count'));
    }
  }, [announcementCountError, translate]);

  const handleNavigate = useCallback(
    (path: string) => {
      saveSidebarScrollPosition();
      if (onNavigate) onNavigate(path);
      else navigate(path);
    },
    [navigate, onNavigate, saveSidebarScrollPosition],
  );

  const toggleCollapsed = () => {
    setCollapsed((previous) => {
      const next = !previous;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write errors in restricted browsing modes.
      }
      return next;
    });
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const recentAnnouncementCount = announcementCount && announcementCount > 0 ? announcementCount : undefined;
  const desktopSections: { id: string; label: string; items: DesktopNavItem[] }[] = [
    {
      id: 'menu',
      label: translate('MENU'),
      items: [
        { id: 'home', label: t.navHome, path: '/', icon: House },
        { id: 'report', label: t.reportAnIssue, path: '/report-issue', icon: Plus },
        { id: 'reports', label: t.navMyReports, path: '/my-requests', icon: ClipboardList },
      ],
    },
    {
      id: 'general',
      label: translate('GENERAL'),
      items: [
        { id: 'announcements', label: t.navAnnouncements, path: '/updates', icon: Bell, badge: recentAnnouncementCount },
        { id: 'emergency', label: t.navEmergencyAlerts, path: '/emergency', icon: Siren },
        { id: 'directory', label: t.navDirectory, path: '/directory', icon: MapPin },
        { id: 'programs', label: t.navPrograms, path: '/programs', icon: CalendarDays },
      ],
    },
    {
      id: 'account',
      label: translate('ACCOUNT'),
      items: [
        { id: 'profile', label: t.navProfile, path: '/profile', icon: UserRound },
        { id: 'settings', label: translate('Settings'), path: '/settings', icon: Settings },
      ],
    },
  ];

  const mobileNavItems = [
    { icon: House, label: t.navHome, path: '/' },
    { icon: ClipboardList, label: t.navMyReports, path: '/my-requests' },
    { icon: Plus, label: t.reportAnIssue, path: '/report-issue', isReportAction: true },
    { icon: Bell, label: t.navAnnouncements, path: '/updates', badge: recentAnnouncementCount },
    { icon: UserRound, label: t.navProfile, path: '/profile' },
  ];

  return (
    <>
      {!isPhone && !hideDesktop && (
        <nav
          aria-label={translate('Main navigation')}
          data-collapsed={collapsed}
          className={cn(
            'desktop-sidebar fixed bottom-3 left-3 top-3 z-40 hidden flex-col overflow-hidden rounded-[28px] border border-border bg-card shadow-lg transition-[width,padding] duration-200 ease-out lg:flex',
            collapsed ? 'w-[72px] px-2.5' : 'w-[248px] px-4',
          )}
        >
          <div className={cn('flex shrink-0 items-center', collapsed ? 'flex-col gap-2 py-4' : 'h-20 justify-between')}>
            <button
              type="button"
              onClick={() => handleNavigate('/')}
              aria-label={translate('CORA home')}
              className={cn(
                'flex items-center rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                collapsed ? 'h-10 w-10 justify-center' : 'min-w-0 gap-3',
              )}
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
                <img
                  src="/assets/branding/cora-logo.png"
                  alt="CORA logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full scale-[1.18] object-cover"
                />
              </div>
              {!collapsed && <span className="truncate text-xl font-extrabold tracking-tight text-foreground">CORA</span>}
            </button>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label={translate(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              title={translate(collapsed ? 'Expand sidebar' : 'Collapse sidebar')}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>

          <div
            ref={sidebarScrollRef}
            onScroll={saveSidebarScrollPosition}
            className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3"
          >
            {desktopSections.map((section, sectionIndex) => (
              <div key={section.id} className={cn('flex flex-col gap-1', sectionIndex > 0 && 'mt-5')}>
                {!collapsed ? (
                  <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                    {section.label}
                  </p>
                ) : sectionIndex > 0 ? (
                  <div aria-hidden="true" className="mx-auto mb-2 h-px w-8 bg-border" />
                ) : null}

                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = isResidentNavItemActive(item.path, activePath);
                  const navButton = (
                    <button
                      type="button"
                      onClick={() => handleNavigate(item.path)}
                      aria-label={item.label}
                      aria-current={isActive ? 'page' : undefined}
                      className={cn(
                        'group relative flex h-11 w-full items-center rounded-xl text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                        collapsed ? 'justify-center px-0' : 'gap-3 px-3',
                        isActive
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
                      )}
                    >
                      {isActive && (
                        <span
                          aria-hidden="true"
                          className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-primary"
                        />
                      )}
                      <span className="relative flex items-center justify-center">
                        <Icon className="h-[18px] w-[18px] shrink-0" />
                        {collapsed && item.badge && (
                          <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
                            {item.badge > 9 ? '9+' : item.badge}
                          </span>
                        )}
                      </span>
                      {!collapsed && (
                        <>
                          <span className="truncate">{item.label}</span>
                          {item.badge && (
                            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/15 px-1.5 text-[10px] font-bold text-accent">
                              {item.badge > 9 ? '9+' : item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </button>
                  );

                  if (!collapsed) return <div key={item.id}>{navButton}</div>;

                  return (
                    <Tooltip key={item.id} delayDuration={100}>
                      <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                      <TooltipContent side="right" className="text-xs font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>

          <div className="shrink-0 border-t border-border py-3">
            {collapsed ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleLogout}
                    aria-label={t.logout}
                    className="flex h-11 w-full items-center justify-center rounded-xl text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                  >
                    <LogOut className="h-[18px] w-[18px]" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs font-medium">{t.logout}</TooltipContent>
              </Tooltip>
            ) : (
              <button
                type="button"
                onClick={handleLogout}
                className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
              >
                <LogOut className="h-[18px] w-[18px]" />
                <span>{t.logout}</span>
              </button>
            )}
          </div>
        </nav>
      )}

      {!hideMobile && <nav
        aria-label={translate('Mobile navigation')}
        className={cn(
          'fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-lg safe-area-pb',
          !isPhone && 'lg:hidden',
        )}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {mobileNavItems.map((item) => {
            const isActive = isResidentNavItemActive(item.path, activePath);
            const isReportAction = !!item.isReportAction;
            const Icon = item.icon;

            return (
              <button
                key={item.path + item.label}
                type="button"
                onClick={() => handleNavigate(item.path)}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1 transition-all duration-200',
                  isReportAction
                    ? 'font-semibold text-primary'
                    : isActive
                      ? 'bg-secondary text-primary'
                      : 'text-muted-foreground hover:text-foreground',
                )}
              >
                <div
                  className={cn(
                    'relative flex h-9 w-9 items-center justify-center',
                    isReportAction && 'h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md',
                  )}
                >
                  <Icon className={cn(isReportAction ? 'h-6 w-6' : 'h-5 w-5', isActive && 'animate-scale-in')} />
                  {item.badge && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {!isReportAction && (
                  <span className="block max-w-full truncate text-center text-[9px] font-medium leading-tight">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>
      </nav>}
    </>
  );
}
