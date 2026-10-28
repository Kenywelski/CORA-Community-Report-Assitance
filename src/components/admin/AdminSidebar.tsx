import { useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  MapPin,
  MessageSquare,
  Megaphone,
  Newspaper,
  CalendarDays,
  Siren,
  BookOpen,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const menuItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
  { icon: ClipboardList, label: 'Requests', path: '/admin/requests' },
  { icon: Newspaper, label: 'Community Posts', path: '/admin/posts' },
  { icon: MessageSquare, label: 'Staff Chat', path: '/admin/chat' },
  { icon: Users, label: 'Users', path: '/admin/users' },
  { icon: Megaphone, label: 'Announcements', path: '/admin/announcements' },
  { icon: Siren, label: 'Emergency Contacts', path: '/admin/emergency-contacts' },
  { icon: MessageSquare, label: 'Feedback', path: '/admin/feedback' },
  { icon: BookOpen, label: 'Knowledge Base', path: '/admin/knowledge' },
];

export const AdminSidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success('Logged out successfully');
    navigate('/');
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-14 bg-card border-b border-border z-50 flex items-center px-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="ml-3 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg overflow-hidden bg-white ring-1 ring-border shrink-0">
            <img
              src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
              alt="CORA Logo"
              className="h-full w-full scale-[1.18] object-cover"
            />
          </div>
          <span className="font-semibold text-primary">CORA Admin</span>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 h-full bg-card border-r border-border z-40 transition-all duration-300",
          isCollapsed ? "w-16" : "w-64",
          "lg:translate-x-0",
          isCollapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!isCollapsed && (
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-border shrink-0">
                <img
                  src="/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png"
                  alt="CORA Logo"
                  className="h-full w-full scale-[1.18] object-cover"
                />
              </div>
              <span className="font-bold text-lg text-primary">CORA Admin</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:flex"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-2 space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  if (window.innerWidth < 1024) setIsCollapsed(true);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="absolute bottom-0 left-0 right-0 p-2 border-t border-border">
          <button
            onClick={handleLogout}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
              "text-destructive hover:bg-destructive/10"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!isCollapsed && <span>Logout</span>}
          </button>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {!isCollapsed && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsCollapsed(true)}
        />
      )}
    </>
  );
};
