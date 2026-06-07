import { useMemo } from 'react';
import { Activity, AlertCircle, CheckCircle2, MessageSquare, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { PublicReport } from './ReportDetailDialog';

interface ActivityItem {
  id: string;
  icon: any;
  label: string;
  time: string;
  cls: string;
}

export const ActivityFeed = ({ reports }: { reports: PublicReport[] }) => {
  const items = useMemo<ActivityItem[]>(() => {
    const events: ActivityItem[] = [];
    reports.forEach((r) => {
      const title = r.title.replace(/^\[REPORT\]\s*/, '');
      events.push({
        id: `s-${r.id}`,
        icon: Send,
        label: `New report: ${title}`,
        time: r.created_at,
        cls: 'text-blue-600 dark:text-blue-400',
      });
      if (r.response_at) {
        events.push({
          id: `r-${r.id}`,
          icon: MessageSquare,
          label: `Municipality responded: ${title}`,
          time: r.response_at,
          cls: 'text-amber-600 dark:text-amber-400',
        });
      }
      if (r.resolved_at) {
        events.push({
          id: `c-${r.id}`,
          icon: CheckCircle2,
          label: `Resolved: ${title}`,
          time: r.resolved_at,
          cls: 'text-green-600 dark:text-green-400',
        });
      }
    });
    return events.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime()).slice(0, 12);
  }, [reports]);

  return (
    <Card variant="elevated">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Live Activity</h3>
          <span className="ml-auto text-[10px] text-muted-foreground">realtime</span>
        </div>
        <ScrollArea className="max-h-72">
          <div className="space-y-2">
            {items.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">No activity yet</p>
            ) : items.map((it) => (
              <div key={it.id} className="flex items-start gap-2 text-xs">
                <it.icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${it.cls}`} />
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-2">{it.label}</p>
                  <p className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(it.time), { addSuffix: true })}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
