import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import { AnnouncementDetailDialog } from '@/features/residents/components/AnnouncementDetailDialog';
import { supabase } from '@/integrations/supabase/client';
import { Megaphone, AlertTriangle, Calendar, CalendarDays, ChevronRight, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { subscribeToPublicDataSync } from '@/features/realtime/publicDataSync';

interface Announcement {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  type: 'general' | 'urgent' | 'event';
  published_at: string;
  image_url: string | null;
}

const typeConfig = {
  general: { icon: Megaphone, color: "bg-secondary text-secondary-foreground", label: "General" },
  urgent: { icon: AlertTriangle, color: "bg-emergency/10 text-emergency", label: "Urgent" },
  event: { icon: Calendar, color: "bg-success/10 text-success", label: "Event" },
};

const Updates = () => {
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<'all' | 'general' | 'urgent' | 'event'>('all');
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const fetchAnnouncements = useCallback(async () => {
    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .eq('is_active', true)
      .order('published_at', { ascending: false });

    if (error) {
      console.error('Failed to load announcements:', error);
      toast.error('Failed to load announcements');
      setLoadError(true);
    } else {
      setAnnouncements(data ?? []);
      setLoadError(false);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    void fetchAnnouncements();
    return subscribeToPublicDataSync('announcements', () => void fetchAnnouncements());
  }, [fetchAnnouncements]);

  useEffect(() => {
    if (!selectedAnnouncement) return;
    const latestAnnouncement = announcements.find(
      (announcement) => announcement.id === selectedAnnouncement.id,
    );
    if (!latestAnnouncement) {
      setSelectedAnnouncement(null);
      setIsDetailOpen(false);
    } else if (latestAnnouncement !== selectedAnnouncement) {
      setSelectedAnnouncement(latestAnnouncement);
    }
  }, [announcements, selectedAnnouncement]);

  const filteredAnnouncements = filter === 'all' 
    ? announcements 
    : announcements.filter(a => a.type === filter);

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        {/* Header */}
        <div className="px-4 pt-4 lg:pt-8 pb-4">
          <ResidentPageHeader
            title="Announcements"
            subtitle="Latest news and announcements."
          />
        </div>

        {/* Filter Tabs */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {(['all', 'urgent', 'general', 'event'] as const).map((type) => (
              <Button
                key={type}
                variant={filter === type ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setFilter(type)}
                className="flex-shrink-0"
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Button>
            ))}
          </div>
        </div>

        {/* Announcement rows */}
        <div className="px-4 pb-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : loadError ? (
            <Card role="alert" variant="flat" className="p-8 text-center">
              <p className="text-muted-foreground">Announcements could not be loaded. Please try again later.</p>
            </Card>
          ) : filteredAnnouncements.length === 0 ? (
            <Card variant="flat" className="p-8 text-center">
              <Megaphone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No announcements yet</p>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border/60">
                {filteredAnnouncements.map((announcement) => {
                  const config = typeConfig[announcement.type];
                  const Icon = config.icon;

                  return (
                    <li key={announcement.id}>
                      <button
                        type="button"
                        className="group flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/50 sm:gap-3 sm:px-4"
                        onClick={() => {
                          setSelectedAnnouncement(announcement);
                          setIsDetailOpen(true);
                        }}
                      >
                        <span className={cn('flex h-12 w-[4.5rem] shrink-0 items-center justify-center overflow-hidden rounded-lg', config.color)}>
                          {announcement.image_url ? (
                            <img
                              src={announcement.image_url}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Icon className="h-5 w-5" aria-hidden="true" />
                          )}
                        </span>
                        <span aria-hidden="true" className="h-9 shrink-0 border-l border-border/70" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-bold text-foreground sm:text-sm">
                            {announcement.title}
                          </span>
                          <span className="mt-0.5 block line-clamp-1 text-[10px] leading-relaxed text-muted-foreground sm:text-xs">
                            {announcement.excerpt || announcement.content}
                          </span>
                          <span className="mt-1 flex items-center gap-2 xl:hidden">
                            <time
                              dateTime={announcement.published_at}
                              className="inline-flex items-center gap-1 text-[10px] text-muted-foreground"
                            >
                              <CalendarDays className="h-3 w-3" aria-hidden="true" />
                              {format(new Date(announcement.published_at), 'MMM d, yyyy')}
                            </time>
                            <span className={cn('rounded-full px-2 py-0.5 text-[9px] font-semibold', config.color)}>
                              {config.label}
                            </span>
                          </span>
                        </span>
                        <span className="hidden shrink-0 items-center gap-4 xl:flex">
                          <time
                            dateTime={announcement.published_at}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap text-[10px] text-muted-foreground sm:text-xs"
                          >
                            <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                            {format(new Date(announcement.published_at), 'MMM d, yyyy')}
                          </time>
                          <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-semibold', config.color)}>
                            {config.label}
                          </span>
                        </span>
                        <ChevronRight
                          aria-hidden="true"
                          className="h-4 w-4 shrink-0 text-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>

      <AnnouncementDetailDialog
        announcement={selectedAnnouncement}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      <BottomNav currentPath="/updates" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default Updates;
