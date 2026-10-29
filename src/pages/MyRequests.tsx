import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomNav } from '@/components/BottomNav';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft, ClipboardList, Clock, CheckCircle2, XCircle, Loader2,
  ListChecks, AlertCircle, Search, MapPin, Radio, Eye, FileSearch, UserCheck, Archive,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

type Status = 'pending' | 'under_review' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed';

interface TrackedReport {
  id: string;
  title: string;
  category: string;
  status: Status;
  created_at: string;
  updated_at: string | null;
  response_at: string | null;
  resolved_at: string | null;
  location: string | null;
  admin_notes: string | null;
  action_taken: string | null;
  ai_validation_status?: string | null;
  ai_validation_reason?: string | null;
  ai_validation_confidence?: number | null;
  admin_review_status?: string | null;
}

const statusConfig: Record<Status, { icon: any; color: string; dot: string; label: string }> = {
  pending: { icon: ClipboardList, color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400', dot: 'bg-orange-500', label: 'AI Processing' },
  under_review: { icon: FileSearch, color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400', dot: 'bg-teal-500', label: 'AI Verified' },
  assigned: { icon: UserCheck, color: 'bg-sky-500/15 text-sky-600 dark:text-sky-400', dot: 'bg-sky-500', label: 'Assigned' },
  in_progress: { icon: Clock, color: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500', label: 'AI Approved · Active' },
  completed: { icon: CheckCircle2, color: 'bg-green-500/15 text-green-600 dark:text-green-400', dot: 'bg-green-500', label: 'Resolved' },
  rejected: { icon: XCircle, color: 'bg-destructive/10 text-destructive', dot: 'bg-destructive', label: 'AI Rejected' },
  closed: { icon: Archive, color: 'bg-muted text-muted-foreground', dot: 'bg-muted-foreground', label: 'Closed' },
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'AI Approved / Open' },
  { key: 'completed', label: 'Resolved' },
  { key: 'rejected', label: 'AI Rejected' },
] as const;

const TrackTimeline = ({ r }: { r: TrackedReport }) => {
  const isRejected = r.status === 'rejected' || r.ai_validation_status === 'rejected';
  const isApproved =
    !isRejected &&
    (r.ai_validation_status === 'valid' ||
      r.admin_review_status === 'approved' ||
      ['in_progress', 'assigned', 'completed'].includes(r.status));

  const steps = isRejected
    ? [
        { label: 'Submitted', at: r.created_at, done: true, rejected: false },
        { label: 'AI Rejected', at: r.updated_at || r.created_at, done: true, rejected: true },
        { label: 'Closed', at: r.updated_at || r.created_at, done: true, rejected: true },
      ]
    : [
        { label: 'Submitted', at: r.created_at, done: true, rejected: false },
        { label: 'AI Approved', at: r.response_at || r.created_at, done: isApproved, rejected: false },
        { label: 'Resolved', at: r.resolved_at, done: !!r.resolved_at || r.status === 'completed', rejected: false },
      ];
  return (
    <div className="flex items-center gap-1 mt-3">
      {steps.map((s, i) => (
        <div key={s.label} className="flex-1">
          <div className="flex items-center">
            <div
              className={cn(
                'h-2 w-2 rounded-full shrink-0',
                s.rejected ? 'bg-destructive' : s.done ? 'bg-primary' : 'bg-muted'
              )}
            />
            {i < steps.length - 1 && (
              <div
                className={cn(
                  'h-0.5 flex-1',
                  steps[i + 1].rejected
                    ? 'bg-destructive/50'
                    : steps[i + 1].done
                    ? 'bg-primary'
                    : 'bg-muted'
                )}
              />
            )}
          </div>
          <p
            className={cn(
              'text-[10px] mt-1 font-medium',
              s.rejected ? 'text-destructive' : s.done ? 'text-foreground' : 'text-muted-foreground'
            )}
          >
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
};

const MyRequests = () => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['key']>('all');
  const [search, setSearch] = useState('');
  const [live, setLive] = useState(false);

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: async (): Promise<TrackedReport[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('id,title,category,status,created_at,updated_at,response_at,resolved_at,location,admin_notes,action_taken,ai_validation_status,ai_validation_reason,ai_validation_confidence,admin_review_status')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as TrackedReport[];
    },
    enabled: !!user,
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-reports-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['my-reports', user.id] })
      )
      .subscribe((status) => setLive(status === 'SUBSCRIBED'));
    return () => {
      supabase.removeChannel(channel);
      setLive(false);
    };
  }, [user, queryClient]);

  const stats = useMemo(() => ({
    total: reports.length,
    pending: reports.filter(r => ['pending', 'under_review'].includes(r.status)).length,
    in_progress: reports.filter(r => ['in_progress', 'assigned'].includes(r.status)).length,
    completed: reports.filter(r => r.status === 'completed').length,
  }), [reports]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      const byFilter =
        filter === 'all' ? true
        : filter === 'open' ? !['completed', 'rejected', 'closed'].includes(r.status)
        : r.status === filter;
      const byText = !q || r.title.toLowerCase().includes(q) || r.category.toLowerCase().includes(q) || (r.location || '').toLowerCase().includes(q);
      return byFilter && byText;
    });
  }, [reports, filter, search]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        <div className="px-4 pt-12 pb-5">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">My Reports</h1>
              <p className="text-muted-foreground text-sm mt-1">View the status and updates for community reports you submitted.</p>
            </div>
            <span className={cn(
              'flex items-center gap-1.5 text-[10px] font-medium px-2 py-1 rounded-full shrink-0',
              live ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-muted text-muted-foreground'
            )}>
              <Radio className={cn('h-3 w-3', live && 'animate-pulse')} />
              {live ? 'Live' : 'Offline'}
            </span>
          </div>
        </div>

        <AuthGuard fallback="message">
          <div className="px-4 mb-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Total', value: stats.total, color: 'text-foreground', bg: 'bg-muted', Icon: ListChecks },
                { label: 'Pending', value: stats.pending, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10', Icon: ClipboardList },
                { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', Icon: Clock },
                { label: 'Resolved', value: stats.completed, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', Icon: CheckCircle2 },
              ].map((stat) => (
                <Card key={stat.label} variant="elevated">
                  <CardContent className="p-4">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center mb-2', stat.bg)}>
                      <stat.Icon className={cn('h-5 w-5', stat.color)} />
                    </div>
                    {isLoading ? (
                      <Skeleton className="h-7 w-10" />
                    ) : (
                      <div className={cn('text-2xl font-bold', stat.color)}>{stat.value}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-0.5">{stat.label}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="px-4 mb-3 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title, category or location"
                className="pl-9"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors border',
                    filter === f.key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background text-muted-foreground border-border hover:bg-muted'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 mb-4">
              <Card variant="flat" className="p-4 border-destructive/30 bg-destructive/5">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">Failed to load your reports. Please try again.</p>
                </div>
              </Card>
            </div>
          )}

          <div className="px-4 space-y-3">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} variant="elevated">
                  <CardContent className="p-4 space-y-3">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </CardContent>
                </Card>
              ))
            ) : visible.length === 0 ? (
              <Card variant="flat" className="p-8 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {reports.length === 0 ? 'You have no reports yet' : 'No reports match your filter'}
                </p>
                {reports.length === 0 && (
                  <button
                    onClick={() => navigate('/report-issue')}
                    className="text-primary font-medium mt-2 hover:underline"
                  >
                    Submit your first report
                  </button>
                )}
              </Card>
            ) : (
              visible.map((r) => {
                const config = statusConfig[r.status] ?? statusConfig.pending;
                const Icon = config.icon;
                const title = r.title.replace(/^\[REPORT\]\s*/, '');
                return (
                  <Card key={r.id} variant="elevated">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <Badge variant="secondary" className="text-xs">{r.category}</Badge>
                        <Badge className={cn('text-xs', config.color)}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                      </div>
                      <h3 className="font-semibold leading-snug">{title}</h3>
                      {r.location && (
                        <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{r.location}</span>
                        </p>
                      )}

                      <TrackTimeline r={r} />

                      {(r.action_taken || r.admin_notes || r.ai_validation_reason) && (
                        <div className={cn(
                          'mt-3 rounded-lg p-2.5 border',
                          r.status === 'rejected'
                            ? 'bg-destructive/5 border-destructive/20'
                            : 'bg-muted/60 border-border/60'
                        )}>
                          <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">
                            {r.status === 'rejected' ? 'AI Auto-Rejection Reason' : 'AI Verification & Office Update'}
                          </p>
                          <p className="text-xs leading-relaxed">
                            {r.action_taken || r.admin_notes || r.ai_validation_reason}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                        <p className="text-[11px] text-muted-foreground">
                          Submitted {format(new Date(r.created_at), 'MMM d, yyyy')}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Updated {formatDistanceToNow(new Date(r.updated_at || r.created_at), { addSuffix: true })}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {!isLoading && visible.length > 0 && (
            <p className="px-4 pt-4 text-center text-[11px] text-muted-foreground flex items-center justify-center gap-1">
              <Eye className="h-3 w-3" /> Showing {visible.length} of {reports.length} reports
            </p>
          )}
        </AuthGuard>
      </div>

      <BottomNav currentPath="/my-requests" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default MyRequests;
