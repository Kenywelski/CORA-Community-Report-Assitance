import { ListChecks, Activity, CheckCircle2, Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { PublicReport } from './ReportDetailDialog';

function fmtDuration(ms: number): string {
  if (!isFinite(ms) || ms <= 0) return '—';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const PerformanceDashboard = ({ reports }: { reports: PublicReport[] }) => {
  const total = reports.length;
  const resolved = reports.filter(r => r.status === 'completed' || r.status === 'closed').length;
  const active = total - resolved;

  const responseTimes = reports
    .filter(r => r.response_at)
    .map(r => new Date(r.response_at!).getTime() - new Date(r.created_at).getTime());
  const avgResponse = responseTimes.length
    ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
    : 0;

  const resolutionTimes = reports
    .filter(r => r.resolved_at)
    .map(r => new Date(r.resolved_at!).getTime() - new Date(r.created_at).getTime());
  const avgResolution = resolutionTimes.length
    ? resolutionTimes.reduce((a, b) => a + b, 0) / resolutionTimes.length
    : 0;

  const items = [
    { label: 'Total', value: total, Icon: ListChecks, color: 'text-foreground', bg: 'bg-muted' },
    { label: 'Active', value: active, Icon: Activity, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10' },
    { label: 'Resolved', value: resolved, Icon: CheckCircle2, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
    { label: 'Avg Response', value: fmtDuration(avgResponse), Icon: Clock, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Avg Resolution', value: fmtDuration(avgResolution), Icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <Card variant="elevated" className="mb-3">
      <CardContent className="p-3">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {items.map((it) => (
            <div key={it.label} className="flex items-center gap-2 p-2 rounded-lg">
              <div className={`h-8 w-8 rounded-md ${it.bg} flex items-center justify-center shrink-0`}>
                <it.Icon className={`h-4 w-4 ${it.color}`} />
              </div>
              <div className="min-w-0">
                <div className={`text-sm font-bold ${it.color} truncate`}>{it.value}</div>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{it.label}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
