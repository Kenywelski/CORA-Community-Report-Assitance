import { useNavigate } from 'react-router-dom';
import { 
  FileText, AlertCircle, Calendar, MessageSquare, 
  MapPin, Building2, Heart, Wallet
} from "lucide-react";
import { cn } from "@/lib/utils";

const services = [
  { icon: FileText, label: "Request Service", color: "text-primary", bgColor: "bg-secondary", path: "/request-service" },
  { icon: AlertCircle, label: "Report Issue", color: "text-accent", bgColor: "bg-accent/10", path: "/request-service" },
  { icon: Calendar, label: "Events", color: "text-success", bgColor: "bg-success/10", path: "/updates" },
  { icon: MessageSquare, label: "Feedback", color: "text-warning", bgColor: "bg-warning/10", path: "/feedback" },
  { icon: MapPin, label: "Directory", color: "text-primary", bgColor: "bg-primary/10", path: "/services" },
  { icon: Building2, label: "Offices", color: "text-muted-foreground", bgColor: "bg-muted", path: "/services" },
  { icon: Heart, label: "Programs", color: "text-emergency", bgColor: "bg-emergency/10", path: "/services" },
  { icon: Wallet, label: "Payments", color: "text-success", bgColor: "bg-success/10", path: "/services" },
];

export const QuickServices = () => {
  const navigate = useNavigate();

  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Quick Services</h2>
        <button className="text-sm text-primary font-medium" onClick={() => navigate('/services')}>See All</button>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {services.map((service, index) => {
          const Icon = service.icon;
          return (
            <button key={service.label} onClick={() => navigate(service.path)} className="flex flex-col items-center gap-2 group animate-slide-up" style={{ animationDelay: `${index * 50}ms` }}>
              <div className={cn("w-full aspect-square max-w-[72px] rounded-2xl flex items-center justify-center transition-all duration-200", service.bgColor, "group-hover:scale-105 group-active:scale-95 shadow-soft")}>
                <Icon className={cn("h-6 w-6", service.color)} />
              </div>
              <span className="text-[11px] font-medium text-foreground text-center leading-tight">{service.label}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
};
