import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, Megaphone, AlertTriangle, Calendar } from "lucide-react";

interface Announcement {
  id: string;
  title: string;
  excerpt: string;
  type: "general" | "urgent" | "event";
  date: string;
}

const mockAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "Water Service Interruption Notice",
    excerpt: "Scheduled maintenance on January 15, 2026. Please store water in advance.",
    type: "urgent",
    date: "Jan 9",
  },
  {
    id: "2",
    title: "Barangay Assembly Meeting",
    excerpt: "All residents are invited to attend the quarterly assembly this Saturday.",
    type: "event",
    date: "Jan 8",
  },
  {
    id: "3",
    title: "Cash-for-Work Program Registration",
    excerpt: "Registration is now open for qualified residents. Visit the Municipal Hall.",
    type: "general",
    date: "Jan 7",
  },
];

const typeConfig = {
  general: { icon: Megaphone, color: "bg-secondary text-secondary-foreground" },
  urgent: { icon: AlertTriangle, color: "bg-emergency/10 text-emergency" },
  event: { icon: Calendar, color: "bg-success/10 text-success" },
};

export const AnnouncementsFeed = () => {
  return (
    <section className="px-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">Announcements</h2>
        <button className="text-sm text-primary font-medium flex items-center gap-1">
          View All <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-3">
        {mockAnnouncements.map((announcement, index) => {
          const config = typeConfig[announcement.type];
          const Icon = config.icon;

          return (
            <Card 
              key={announcement.id} 
              variant="elevated"
              className="animate-slide-up cursor-pointer"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-xl ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <h3 className="font-semibold text-sm line-clamp-1">{announcement.title}</h3>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{announcement.date}</span>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{announcement.excerpt}</p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>
    </section>
  );
};
