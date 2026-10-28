import { useNavigate, useLocation } from 'react-router-dom';
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  House,
  ClipboardList,
  Bell,
  Siren,
  MapPin,
  CalendarDays,
  UserRound,
  LogOut,
  Plus,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  RESIDENT_NAV_SECTIONS,
  SIDEBAR_COLLAPSED_STORAGE_KEY,
  resolveActiveResidentPath,
  isResidentNavItemActive,
  parseSidebarCollapsed,
  isPhoneUserAgent,
  type ResidentNavIconKey,
} from '@/lib/residentNav';

interface BottomNavProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

const ICON_MAP: Record<ResidentNavIconKey, LucideIcon> = {
  house: House,
  'clipboard-list': ClipboardList,
  bell: Bell,
  siren: Siren,
  'map-pin': MapPin,
  'calendar-days': CalendarDays,
  'user-round': UserRound,
};

export function BottomNav({ currentPath, onNavigate }: BottomNavProps) {
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return parseSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY));
    } catch {
      return false;
    }
  });

  const isPhone =
    typeof navigator !== 'undefined' && isPhoneUserAgent(navigator.userAgent);

  const navigate = useNavigate();
  const location = useLocation();
  const { signOut } = useAuth();

  const activePath = resolveActiveResidentPath(location.pathname, currentPath);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage write errors in restricted browsing modes
      }
      return next;
    });
  };

  const handleNavigate = useCallback(
    (path: string) => {
      if (onNavigate) {
        onNavigate(path);
      } else {
        navigate(path);
      }
    },
    [navigate, onNavigate],
  );

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
    staleTime: 1000 * 60 * 5,
  });

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const mobileNavItems = [
    { icon: House, label: 'Home', path: '/' },
    { icon: ClipboardList, label: 'My Reports', path: '/my-requests' },
    { icon: Plus, label: 'Report an Issue', path: '/report-issue', isReportAction: true },
    {
      icon: Bell,
      label: 'Announcements',
      path: '/updates',
      badge: announcementCount && announcementCount > 0 ? announcementCount : undefined,
    },
    { icon: UserRound, label: 'Profile', path: '/profile' },
  ];

  return (
    <>
      {/* Desktop Collapsible Sidebar - strictly hidden on phones and viewports < 1024px */}
      {!isPhone && (
        <nav
          aria-label="Main navigation"
          data-collapsed={collapsed}
          className={cn(
            'desktop-sidebar fixed inset-y-0 left-0 z-40 hidden h-screen flex-col border-r border-[#E2E8F0] bg-white transition-[width,padding] duration-200 ease-out lg:flex',
            collapsed ? 'w-[76px] px-2.5' : 'w-[272px] px-4',
          )}
        >
        {/* 1. Sidebar Header */}
        {!collapsed ? (
          <div className="flex h-[72px] shrink-0 items-center justify-between gap-2 border-b border-[#E2E8F0]">
            <button
              type="button"
              onClick={() => handleNavigate('/')}
              aria-label="CORA Community Portal Home"
              className="flex min-w-0 items-center gap-3 rounded-lg text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-[#E2E8F0]">
                <img
                  src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
                  alt="CORA Logo"
                  referrerPolicy="no-referrer"
                  className="h-full w-full scale-[1.18] object-cover"
                />
              </div>
              <div className="min-w-0">
                <span className="block text-[18px] font-extrabold leading-none tracking-tight text-[#177A73]">
                  CORA
                </span>
                <span className="mt-1 block truncate text-[11px] font-medium leading-none text-[#64748B]">
                  Community Portal
                </span>
              </div>
            </button>

            <button
              type="button"
              onClick={toggleCollapsed}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition-colors hover:border-[#177A73]/20 hover:bg-[#EAF6F4] hover:text-[#177A73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
            >
              <PanelLeftClose className="h-[18px] w-[18px]" />
            </button>
          </div>
        ) : (
          <div className="flex shrink-0 flex-col items-center gap-2 border-b border-[#E2E8F0] py-3">
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => handleNavigate('/')}
                  aria-label="CORA Community Portal Home"
                  title="CORA — Community Portal"
                  className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-xs ring-1 ring-[#E2E8F0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
                >
                  <img
                    src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
                    alt="CORA Logo"
                    referrerPolicy="no-referrer"
                    className="h-full w-full scale-[1.18] object-cover"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white">
                CORA — Community Portal
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={toggleCollapsed}
                  aria-label="Expand sidebar"
                  title="Expand sidebar"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-transparent text-[#64748B] transition-colors hover:border-[#177A73]/20 hover:bg-[#EAF6F4] hover:text-[#177A73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
                >
                  <PanelLeftOpen className="h-[18px] w-[18px]" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white">
                Expand sidebar
              </TooltipContent>
            </Tooltip>
          </div>
        )}

        {/* 2. Barangay Location Section */}
        {!collapsed ? (
          <div className="mt-3.5 shrink-0 rounded-xl border border-[#177A73]/15 bg-[#EAF6F4] px-3 py-2.5">
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#177A73]/12 text-[#177A73]">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12.5px] font-semibold leading-snug text-[#142B38]">
                  Barangay Purisima
                </p>
                <p className="mt-0.5 truncate text-[11px] font-normal leading-tight text-[#64748B]">
                  Tago, Surigao del Sur
                </p>
              </div>
            </div>
          </div>
        ) : (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                aria-label="Barangay Purisima, Tago, Surigao del Sur"
                title="Barangay Purisima, Tago, Surigao del Sur"
                className="mx-auto mt-3 flex h-9 w-10 shrink-0 items-center justify-center rounded-xl border border-[#177A73]/15 bg-[#EAF6F4] text-[#177A73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
              >
                <MapPin className="h-4 w-4" />
              </div>
            </TooltipTrigger>
            <TooltipContent side="right" className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white">
              Barangay Purisima · Tago, Surigao del Sur
            </TooltipContent>
          </Tooltip>
        )}

        {/* 3. Primary Report an Issue Button */}
        {!collapsed ? (
          <button
            type="button"
            onClick={() => handleNavigate('/report-issue')}
            aria-label="Report an Issue"
            className="mt-3 mb-2 flex h-10 w-full shrink-0 items-center justify-center gap-2 rounded-xl bg-[#F36B3F] px-4 text-[13.5px] font-semibold text-white shadow-xs transition-all duration-150 hover:bg-[#e05d32] hover:shadow-sm active:scale-[0.99] active:bg-[#cc5129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B3F] focus-visible:ring-offset-2"
          >
            <Plus className="h-[18px] w-[18px] shrink-0 stroke-[2.25]" />
            <span className="whitespace-nowrap">Report an Issue</span>
          </button>
        ) : (
          <Tooltip delayDuration={100}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleNavigate('/report-issue')}
                aria-label="Report an Issue"
                title="Report an Issue"
                className="mx-auto mt-3 mb-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F36B3F] text-white shadow-xs transition-all duration-150 hover:bg-[#e05d32] hover:shadow-sm active:scale-[0.98] active:bg-[#cc5129] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F36B3F] focus-visible:ring-offset-2"
              >
                <Plus className="h-[19px] w-[19px] shrink-0 stroke-[2.25]" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white">
              Report an Issue
            </TooltipContent>
          </Tooltip>
        )}

        {/* 4. Scrollable Navigation Sections */}
        <div className="sidebar-scroll flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain py-2 pr-0.5">
          {RESIDENT_NAV_SECTIONS.map((section, sectionIdx) => (
            <div key={section.id} className="flex flex-col gap-1">
              {!collapsed ? (
                <p className="px-3 pb-1 pt-1.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#64748B] select-none">
                  {section.label}
                </p>
              ) : (
                sectionIdx > 0 && (
                  <div aria-hidden="true" className="mx-auto my-1 h-px w-7 bg-[#E2E8F0]" />
                )
              )}

              {section.items.map((item) => {
                const Icon = ICON_MAP[item.iconKey];
                const isActive = isResidentNavItemActive(item.path, activePath);
                const badge =
                  item.supportsUnreadBadge && announcementCount && announcementCount > 0
                    ? announcementCount
                    : undefined;

                const navButton = (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigate(item.path)}
                    aria-label={item.label}
                    title={collapsed ? item.label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'group relative flex h-10 w-full items-center rounded-xl text-left text-[13.5px] transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-1',
                      collapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3',
                      isActive
                        ? 'bg-[#EAF6F4] font-semibold text-[#177A73] hover:bg-[#dff1ee]'
                        : 'bg-transparent font-medium text-[#64748B] hover:bg-slate-100/80 hover:text-[#142B38]',
                    )}
                  >
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-[#177A73]"
                      />
                    )}
                    <div className="relative flex items-center justify-center">
                      <Icon
                        className={cn(
                          'h-[18px] w-[18px] shrink-0 transition-colors',
                          isActive
                            ? 'text-[#177A73]'
                            : 'text-[#64748B] group-hover:text-[#142B38]',
                        )}
                      />
                      {collapsed && badge && (
                        <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#F36B3F] px-1 text-[9px] font-bold text-white tabular-nums">
                          {badge > 9 ? '9+' : badge}
                        </span>
                      )}
                    </div>

                    {!collapsed && (
                      <>
                        <span className="truncate leading-snug">{item.label}</span>
                        {badge && (
                          <span
                            className={cn(
                              'ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums',
                              isActive
                                ? 'bg-[#177A73] text-white'
                                : 'bg-[#F36B3F]/15 text-[#F36B3F]',
                            )}
                          >
                            {badge > 9 ? '9+' : badge}
                          </span>
                        )}
                      </>
                    )}
                  </button>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.id} delayDuration={100}>
                      <TooltipTrigger asChild>{navButton}</TooltipTrigger>
                      <TooltipContent
                        side="right"
                        className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white"
                      >
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return navButton;
              })}
            </div>
          ))}
        </div>

        {/* 5. Bottom Logout Action */}
        <div className="shrink-0 border-t border-[#E2E8F0] pt-2.5 pb-3">
          {!collapsed ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Logout"
              className="group flex h-10 w-full items-center justify-start gap-3 rounded-xl px-3 text-[13.5px] font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
            >
              <LogOut className="h-[18px] w-[18px] shrink-0 text-red-600 transition-colors group-hover:text-red-700" />
              <span className="whitespace-nowrap">Logout</span>
            </button>
          ) : (
            <Tooltip delayDuration={100}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={handleLogout}
                  aria-label="Logout"
                  title="Logout"
                  className="group flex h-10 w-full items-center justify-center rounded-xl px-0 text-[13.5px] font-medium text-red-600 transition-colors duration-150 hover:bg-red-50 hover:text-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-1"
                >
                  <LogOut className="h-[18px] w-[18px] shrink-0 text-red-600 transition-colors group-hover:text-red-700" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="border-[#E2E8F0] bg-[#142B38] text-xs font-medium text-white">
                Logout
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </nav>
      )}

      {/* Mobile Bottom Nav - shown on phones and viewports < 1024px (no sidebar on mobile) */}
      <nav
        aria-label="Mobile navigation"
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
                    isReportAction &&
                      'h-11 w-11 rounded-full bg-primary text-primary-foreground shadow-md',
                  )}
                >
                  <Icon
                    className={cn(
                      isReportAction ? 'h-6 w-6' : 'h-5 w-5',
                      isActive && 'animate-scale-in',
                    )}
                  />
                  {item.badge && (
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-accent-foreground">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                <span className="max-w-full text-center text-[9px] font-medium leading-tight">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
