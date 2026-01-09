import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/components/BottomNav';
import { 
  FileText, 
  AlertCircle, 
  Calendar, 
  MessageSquare, 
  MapPin, 
  Building2,
  Heart,
  Wallet,
  ArrowLeft,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const services = [
  { 
    icon: FileText, 
    label: "Request Service", 
    description: "Submit requests for municipal services",
    color: "text-primary", 
    bgColor: "bg-secondary",
    path: "/request-service"
  },
  { 
    icon: AlertCircle, 
    label: "Report Issue", 
    description: "Report community issues or incidents",
    color: "text-accent", 
    bgColor: "bg-accent/10",
    path: "/report-issue"
  },
  { 
    icon: Calendar, 
    label: "Events", 
    description: "View upcoming municipal events",
    color: "text-success", 
    bgColor: "bg-success/10",
    path: "/events"
  },
  { 
    icon: MessageSquare, 
    label: "Feedback", 
    description: "Share your feedback and suggestions",
    color: "text-warning", 
    bgColor: "bg-warning/10",
    path: "/feedback"
  },
  { 
    icon: MapPin, 
    label: "Directory", 
    description: "Find locations and contact info",
    color: "text-primary", 
    bgColor: "bg-primary/10",
    path: "/directory"
  },
  { 
    icon: Building2, 
    label: "Offices", 
    description: "Municipal office information",
    color: "text-muted-foreground", 
    bgColor: "bg-muted",
    path: "/offices"
  },
  { 
    icon: Heart, 
    label: "Programs", 
    description: "Social welfare programs",
    color: "text-emergency", 
    bgColor: "bg-emergency/10",
    path: "/programs"
  },
  { 
    icon: Wallet, 
    label: "Payments", 
    description: "Pay fees and view transactions",
    color: "text-success", 
    bgColor: "bg-success/10",
    path: "/payments"
  },
];

const Services = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-container">
        {/* Header */}
        <div className="px-4 pt-12 pb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h1 className="text-2xl font-bold">Services</h1>
          <p className="text-muted-foreground text-sm mt-1">Access all municipal services</p>
        </div>

        {/* Services List */}
        <div className="px-4 space-y-3">
          {services.map((service, index) => {
            const Icon = service.icon;
            return (
              <Card 
                key={service.label} 
                variant="elevated"
                className="cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 50}ms` }}
                onClick={() => navigate(service.path)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-3 rounded-xl", service.bgColor)}>
                      <Icon className={cn("h-6 w-6", service.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold">{service.label}</h3>
                      <p className="text-sm text-muted-foreground">{service.description}</p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      <BottomNav currentPath="/services" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default Services;
