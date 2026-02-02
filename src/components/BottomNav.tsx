import { useNavigate } from 'react-router-dom';
import { Home, FileText, Bell, User, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: FileText, label: "Services", path: "/services" },
  { icon: Heart, label: "Feed", path: "/community" },
  { icon: Bell, label: "Updates", path: "/updates", badge: 3 },
  { icon: User, label: "Profile", path: "/profile" },
];

interface BottomNavProps {
  currentPath?: string;
  onNavigate?: (path: string) => void;
}

export const BottomNav = ({ currentPath = "/" }: BottomNavProps) => {
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-lg border-t border-border safe-area-pb z-50">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const isActive = currentPath === item.path;
          const Icon = item.icon;
          return (
            <button key={item.path + item.label} onClick={() => navigate(item.path)} className={cn("relative flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all duration-200", isActive ? "text-primary bg-secondary" : "text-muted-foreground hover:text-foreground")}>
              <div className="relative">
                <Icon className={cn("h-5 w-5", isActive && "animate-scale-in")} />
                {item.badge && <span className="absolute -top-1 -right-1 h-4 w-4 flex items-center justify-center bg-accent text-accent-foreground text-[10px] font-bold rounded-full">{item.badge}</span>}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
