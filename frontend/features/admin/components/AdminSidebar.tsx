import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  Building2,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  PanelLeft,
  Siren,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { LanguageThemeControls, useAppPreferences } from '@/lib/preferences';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: ClipboardList, label: 'Reports', path: '/admin/requests' },
  { icon: Building2, label: 'Barangay Offices', path: '/admin/offices' },
  { icon: CalendarDays, label: 'Barangay Programs', path: '/admin/programs' },
  { icon: MessageSquare, label: 'Staff Chat', path: '/admin/chat' },
  { icon: Users, label: 'Users', path: '/admin/users' },
];

const generalItems = [
  { icon: Bell, label: 'Announcements', path: '/admin/announcements' },
  { icon: Siren, label: 'Emergency Contacts', path: '/admin/emergency-contacts' },
  { icon: MessageSquare, label: 'Feedback', path: '/admin/feedback' },
  { icon: BookOpen, label: 'Knowledge Base', path: '/admin/knowledge' },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { translate } = useAppPreferences();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );
  const isDesktopCollapsed = !isMobileViewport && isCollapsed;

  useEffect(() => {
    const mobileViewport = window.matchMedia('(max-width: 1023px)');
    const updateViewport = () => {
      setIsMobileViewport(mobileViewport.matches);
      setIsMobileMenuOpen(false);
    };

    updateViewport();
    mobileViewport.addEventListener('change', updateViewport);
    return () => mobileViewport.removeEventListener('change', updateViewport);
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(translate('Logged out successfully'));
    navigate('/');
  };

  const navigateTo = (path: string) => {
    navigate(path);
    setIsMobileMenuOpen(false);
  };

  const renderItems = (items: typeof menuItems) => items.map((item) => {
    const isActive = location.pathname === item.path;
    const itemLabel = translate(item.label);
    const navButton = (
      <button
        type="button"
        onClick={() => navigateTo(item.path)}
        aria-label={itemLabel}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'relative flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          isActive
            ? 'bg-primary/10 font-semibold text-primary'
            : 'font-medium text-muted-foreground hover:bg-muted hover:text-foreground',
          isDesktopCollapsed && 'justify-center px-0',
        )}
      >
        {isActive && <span className="absolute left-0 h-7 w-1 rounded-full bg-primary" />}
        <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} />
        {!isDesktopCollapsed && <span className="truncate">{itemLabel}</span>}
      </button>
    );

    if (!isDesktopCollapsed) return <div key={item.path}>{navButton}</div>;

    return (
      <Tooltip key={item.path} delayDuration={100}>
        <TooltipTrigger asChild>{navButton}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="center"
          sideOffset={10}
          collisionPadding={12}
          className="pointer-events-none z-[1000] whitespace-nowrap rounded-lg border-border bg-popover px-3 py-1.5 text-xs font-medium text-popover-foreground shadow-lg"
        >
          {itemLabel}
        </TooltipContent>
      </Tooltip>
    );
  });

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4 lg:hidden">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label={translate(isMobileMenuOpen ? 'Close admin menu' : 'Open admin menu')}
            aria-expanded={isMobileMenuOpen}
            aria-controls="admin-sidebar"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-white">
            <img src="/assets/branding/cora-logo.png" alt="CORA logo" className="h-full w-full scale-[1.16] object-cover" />
          </div>
          <span className="hidden truncate text-sm font-extrabold text-foreground min-[380px]:inline min-[380px]:text-base">{translate('CORA Admin')}</span>
        </div>
        <LanguageThemeControls variant="surface" />
      </div>

      <aside
        id="admin-sidebar"
        data-collapsed={isDesktopCollapsed}
        className={cn(
          'peer fixed bottom-3 left-3 top-[68px] z-40 flex w-[248px] flex-col overflow-hidden rounded-[28px] border border-border bg-card px-4 shadow-lg transition-[width,padding,transform] duration-200 ease-out lg:top-3',
          isDesktopCollapsed ? 'lg:w-[72px] lg:px-2.5' : 'lg:w-[248px] lg:px-4',
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-[120%] lg:translate-x-0',
        )}
      >
        <div className={cn('flex h-20 shrink-0 items-center', isDesktopCollapsed ? 'justify-center' : 'justify-between')}>
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white shadow-sm">
              <img src="/assets/branding/cora-logo.png" alt="CORA logo" className="h-full w-full scale-[1.18] object-cover" />
            </div>
            {!isDesktopCollapsed && <span className="whitespace-nowrap text-xl font-extrabold tracking-tight text-foreground">{translate('CORA Admin')}</span>}
          </div>
          {!isDesktopCollapsed && (
            <button type="button" onClick={() => setIsCollapsed(true)} className="hidden h-9 w-9 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:grid" aria-label={translate('Collapse sidebar')}>
              <PanelLeft className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}
        </div>

        {isDesktopCollapsed && (
          <button type="button" onClick={() => setIsCollapsed(false)} className="mx-auto mb-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-primary transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary" aria-label={translate('Expand sidebar')}>
            <PanelLeft className="h-4 w-4" strokeWidth={1.8} />
          </button>
        )}

        <nav className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain py-3">
          <div className="flex flex-col gap-1">
            {!isDesktopCollapsed && <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{translate('Menu')}</p>}
            {renderItems(menuItems)}
          </div>

          <div className="mt-5 flex flex-col gap-1">
            {!isDesktopCollapsed && <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{translate('General')}</p>}
            {isDesktopCollapsed && <div className="mx-auto mb-2 h-px w-8 bg-border" />}
            {renderItems(generalItems)}
          </div>
        </nav>

        <div className="border-t border-border py-3">
          <button
            type="button"
            onClick={handleLogout}
            title={isDesktopCollapsed ? translate('Logout') : undefined}
            className={cn('flex h-11 w-full items-center gap-3 rounded-xl px-3 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive', isDesktopCollapsed && 'justify-center px-0')}
          >
            <LogOut className="h-[18px] w-[18px] shrink-0" />
            {!isDesktopCollapsed && <span>{translate('Logout')}</span>}
          </button>
        </div>
      </aside>

      {isMobileMenuOpen && (
        <button
          type="button"
          aria-label={translate('Close admin menu')}
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </>
  );
};
