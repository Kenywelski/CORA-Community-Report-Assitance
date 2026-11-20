import { useMemo } from 'react';
import { Activity, CheckCircle2, MessageSquare, Send, type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAppPreferences } from '@/lib/preferences';
import type { PublicReport } from './ReportDetailDialog';

interface ActivityItem {
  id: string;
  icon: LucideIcon;
  label: string;
  time: string;
  cls: string;
}

export const ActivityFeed = ({ reports }: { reports: PublicReport[] }) => {
  const { language, translate } = useAppPreferences();
  const items = useMemo<ActivityItem[]>(() => {
    const events: ActivityItem[] = [];
    reports.forEach((r) => {
      const title = r.title.replace(/^\[REPORT\]\s*/, '');
      events.push({
        id: `s-${r.id}`,
        icon: Send,
        label: translate('New report: {title}', { title }),
        time: r.created_at,
        cls: 'text-blue-600 dark:text-blue-400',
      });
      if (r.response_at) {
        events.push({
          id: `r-${r.id}`,
          icon: MessageSquare,
          label: translate('Municipality responded: {title}', { title }),
          time: r.response_at,
          cls: 'text-amber-600 dark:text-amber-400',
        });
      }
      if (r.resolved_at) {
        events.push({
          id: `c-${r.id}`,
          icon: CheckCircle2,
          label: translate('Resolved: {title}', { title }),
          time: r.resolved_at,
          cls: 'text-green-600 dark:text-green-400',
        });
      }
    });
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);
  }, [reports, translate]);

  const formatRelativeTime = (time: string) => {
    const differenceInSeconds = Math.round((new Date(time).getTime() - Date.now()) / 1000);
    const absoluteSeconds = Math.abs(differenceInSeconds);
    const units: [Intl.RelativeTimeFormatUnit, number][] = [
      ['year', 60 * 60 * 24 * 365],
      ['month', 60 * 60 * 24 * 30],
      ['week', 60 * 60 * 24 * 7],
      ['day', 60 * 60 * 24],
      ['hour', 60 * 60],
      ['minute', 60],
      ['second', 1],
    ];
    const [unit, secondsPerUnit] = units.find(([, size]) => absoluteSeconds >= size) ?? units[units.length - 1];
    const locale = language === 'tl' ? 'fil-PH' : language === 'ceb' ? 'ceb-PH' : 'en-PH';
    return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(
      Math.round(differenceInSeconds / secondsPerUnit),
      unit,
    );
  };

  return (
    <Card variant="elevated">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">{translate('Live Activity')}</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">{translate('realtime')}</span>
        </div>
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">{translate('No activity yet')}</p>
            ) : items.map((it) => (
              <div key={it.id} className="flex items-start gap-2 text-xs">
                <it.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${it.cls}`} />
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-2">{it.label}</p>
                  <p className="text-[10px] text-muted-foreground">{formatRelativeTime(it.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
