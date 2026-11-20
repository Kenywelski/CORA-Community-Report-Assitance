import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowRight, CalendarDays, ChevronRight, Loader2, Megaphone } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { useAppPreferences } from '@/lib/preferences';
import { AnnouncementDetailDialog } from '@/features/residents/components/AnnouncementDetailDialog';

interface Announcement {
  id: string;
  title: string;
  excerpt: string | null;
  content: string;
  type: 'general' | 'urgent' | 'event';
  published_at: string;
  image_url: string | null;
}

const typeConfig = {
  general: {
    icon: Megaphone,
    color: 'bg-primary/10 text-primary',
    label: 'General',
  },
  urgent: {
    icon: AlertTriangle,
    color: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    label: 'Urgent',
  },
  event: {
    icon: CalendarDays,
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Event',
  },
};

export const AnnouncementsFeed = () => {
  const navigate = useNavigate();
  const { t, translate } = useAppPreferences();
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const { data: announcements, isLoading, isError } = useQuery({
    queryKey: ['announcements-feed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false })
        .limit(3);
      if (error) throw error;
      return data as Announcement[];
    },
  });

  useEffect(() => {
    if (!selectedAnnouncement) return;
    const latestAnnouncement = announcements?.find(
      (announcement) => announcement.id === selectedAnnouncement.id,
    );
    if (!latestAnnouncement) {
      setSelectedAnnouncement(null);
      setIsDetailOpen(false);
    } else if (latestAnnouncement !== selectedAnnouncement) {
      setSelectedAnnouncement(latestAnnouncement);
    }
  }, [announcements, selectedAnnouncement]);

  return (
    <section className="min-w-0">
      <Card className="min-h-[9rem] overflow-hidden rounded-[20px] border-border p-0 shadow-sm dark:border-[#29414b] dark:bg-[#0d1d25]">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 dark:border-[#243c46] sm:px-5">
          <h2 className="flex items-center gap-2 text-base font-bold text-foreground dark:text-slate-50 lg:text-lg">
            <Megaphone className="h-[18px] w-[18px] shrink-0 text-teal-500" />
            {t.latestAnnouncements}
          </h2>
          <button
            type="button"
            onClick={() => navigate('/updates')}
            className="flex shrink-0 items-center gap-1 text-sm font-semibold text-primary hover:text-primary/80 dark:text-teal-400 dark:hover:text-teal-300"
          >
            {t.viewAll} <ArrowRight className="h-4 w-4" />
          </button>
        </div>

        {isLoading ? (
          <div className="flex min-h-[9rem] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div role="alert" className="flex min-h-[9rem] items-center justify-center px-5 text-center text-sm text-muted-foreground">
            {translate('Announcements could not be loaded. Please try again later.')}
          </div>
        ) : !announcements || announcements.length === 0 ? (
          <div className="flex min-h-[9rem] flex-col items-center justify-center text-center">
            <Megaphone className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">{translate('No announcements yet')}</p>
          </div>
        ) : (
            <div className="divide-y divide-border/60 px-3 py-1 dark:divide-[#243c46] sm:px-4">
            {announcements.map((announcement) => {
              const config = typeConfig[announcement.type] || typeConfig.general;
              const Icon = config.icon;

              return (
                <div
                  key={announcement.id}
                  className="group -mx-1 grid w-[calc(100%+0.5rem)] grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-2 rounded-xl border border-transparent px-2 py-2.5 transition-colors hover:border-[#b8d8d5] hover:bg-[#f3f8f8] dark:hover:border-[#2d4a54] dark:hover:bg-[#122630] sm:grid-cols-[4.5rem_minmax(0,1fr)_auto]"
                >
                  <button
                    type="button"
                    className="col-span-2 flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setIsDetailOpen(true);
                    }}
                    aria-label={translate('View details for {title}', { title: announcement.title })}
                  >
                    <span className={cn('flex h-12 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl sm:w-[4.5rem]', config.color)}>
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
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">
                        {announcement.title}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                        {announcement.excerpt || announcement.content}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-secondary px-3 text-xs font-bold text-secondary-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-secondary-foreground dark:border-[#2d4a54] dark:bg-[#142630] dark:text-slate-100 dark:hover:bg-[#1b323c] sm:px-4"
                    onClick={() => {
                      setSelectedAnnouncement(announcement);
                      setIsDetailOpen(true);
                    }}
                    aria-label={translate('View details for {title}', { title: announcement.title })}
                  >
                    <span>{translate('View Details')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            </div>
        )}
      </Card>

      <AnnouncementDetailDialog
        announcement={selectedAnnouncement}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />
    </section>
  );
};
