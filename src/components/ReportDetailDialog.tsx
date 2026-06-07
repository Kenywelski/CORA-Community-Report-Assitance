import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MapPin, Clock, CheckCircle2, AlertCircle, Bell, BellOff, Send, ShieldCheck, User, Loader2, Image as ImageIcon } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface PublicReport {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  photo_url: string | null;
  media_urls: string[] | null;
  assigned_department: string | null;
  admin_notes: string | null;
  reporter_name: string | null;
  response_at: string | null;
  resolved_at: string | null;
  created_at: string;
  user_id: string | null;
}

interface Comment {
  id: string;
  user_id: string | null;
  author_name: string | null;
  content: string;
  is_official: boolean;
  created_at: string;
}

export const statusMeta: Record<string, { label: string; cls: string }> = {
  pending:      { label: 'Pending',      cls: 'bg-orange-500/15 text-orange-600 border-orange-500/30 dark:text-orange-400' },
  under_review: { label: 'Under Review', cls: 'bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400' },
  assigned:     { label: 'Assigned',     cls: 'bg-indigo-500/15 text-indigo-600 border-indigo-500/30 dark:text-indigo-400' },
  in_progress:  { label: 'In Progress',  cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400' },
  completed:    { label: 'Resolved',     cls: 'bg-green-500/15 text-green-600 border-green-500/30 dark:text-green-400' },
  closed:       { label: 'Closed',       cls: 'bg-gray-500/15 text-gray-600 border-gray-500/30 dark:text-gray-400' },
  rejected:     { label: 'Rejected',     cls: 'bg-red-500/15 text-red-600 border-red-500/30 dark:text-red-400' },
};

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'less than a minute';
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days !== 1 ? 's' : ''}`;
}

interface Props {
  report: PublicReport | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export const ReportDetailDialog = ({ report, open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState('');

  const { data: comments = [] } = useQuery({
    queryKey: ['report-comments', report?.id],
    queryFn: async (): Promise<Comment[]> => {
      if (!report) return [];
      const { data, error } = await supabase
        .from('report_comments')
        .select('*')
        .eq('report_id', report.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: !!report && open,
  });

  const { data: follows = [] } = useQuery({
    queryKey: ['report-follows', report?.id],
    queryFn: async () => {
      if (!report) return [];
      const { data, error } = await supabase
        .from('report_follows')
        .select('user_id')
        .eq('report_id', report.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!report && open,
  });

  useEffect(() => {
    if (!report || !open) return;
    const ch = supabase
      .channel(`report-${report.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_comments', filter: `report_id=eq.${report.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['report-comments', report.id] }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'report_follows', filter: `report_id=eq.${report.id}` },
        () => queryClient.invalidateQueries({ queryKey: ['report-follows', report.id] }))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [report?.id, open, queryClient]);

  const isFollowing = !!user && follows.some(f => f.user_id === user.id);

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !report) return;
      if (isFollowing) {
        await supabase.from('report_follows').delete().eq('report_id', report.id).eq('user_id', user.id);
      } else {
        await supabase.from('report_follows').insert({ report_id: report.id, user_id: user.id });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['report-follows', report?.id] });
      toast.success(isFollowing ? 'Unfollowed report' : 'Following report — you\'ll get updates');
    },
    onError: () => toast.error('Could not update follow'),
  });

  const commentMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !report) throw new Error('Not signed in');
      const { error } = await supabase.from('report_comments').insert({
        report_id: report.id, user_id: user.id, content, is_official: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText('');
      queryClient.invalidateQueries({ queryKey: ['report-comments', report?.id] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to post comment'),
  });

  if (!report) return null;
  const meta = statusMeta[report.status] || statusMeta.pending;
  const created = new Date(report.created_at);
  const timeSince = formatDuration(Date.now() - created.getTime());
  const responseTime = report.response_at ? formatDuration(new Date(report.response_at).getTime() - created.getTime()) : null;
  const resolutionTime = report.resolved_at ? formatDuration(new Date(report.resolved_at).getTime() - created.getTime()) : null;
  const reporterDisplay = report.reporter_name || (report.user_id ? 'Resident' : 'Anonymous');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-2 pr-6">
            <DialogTitle className="text-lg leading-tight">{report.title.replace(/^\[REPORT\]\s*/, '')}</DialogTitle>
            <Badge variant="outline" className={cn('shrink-0', meta.cls)}>{meta.label}</Badge>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Meta */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3" /> {reporterDisplay}</span>
            {report.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {report.location}</span>}
            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {format(created, 'MMM d, yyyy h:mm a')}</span>
          </div>

          {report.category && <Badge variant="secondary" className="text-xs">{report.category.replace(/^Report:\s*/, '')}</Badge>}

          {/* Photo */}
          {report.photo_url && (
            <img src={report.photo_url} alt="" className="rounded-lg max-h-64 object-cover w-full" />
          )}

          {/* Description */}
          <p className="text-sm whitespace-pre-wrap">{report.description}</p>

          {/* Response speed */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Time Since</div>
              <div className="text-xs font-semibold">{timeSince}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">First Response</div>
              <div className="text-xs font-semibold">{responseTime ?? '—'}</div>
            </div>
            <div className="rounded-lg bg-muted p-2">
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Resolved In</div>
              <div className="text-xs font-semibold">{resolutionTime ?? '—'}</div>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Timeline</h4>
            <div className="space-y-2 pl-1">
              <TimelineRow active label="Submitted" date={report.created_at} />
              <TimelineRow active={!!report.response_at} label="First Response" date={report.response_at} />
              {report.assigned_department && (
                <TimelineRow active label={`Assigned: ${report.assigned_department}`} date={null} />
              )}
              <TimelineRow active={!!report.resolved_at} label="Resolved" date={report.resolved_at} />
            </div>
          </div>

          {/* Admin notes */}
          {report.admin_notes && (
            <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-1">
                <ShieldCheck className="h-3.5 w-3.5" /> Municipal Response
              </div>
              <p className="text-sm whitespace-pre-wrap">{report.admin_notes}</p>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex items-center gap-2">
            {user ? (
              <Button
                variant={isFollowing ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                className="gap-1.5"
              >
                {isFollowing ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                {isFollowing ? 'Following' : 'Follow'}
              </Button>
            ) : null}
            <span className="text-xs text-muted-foreground">{follows.length} follower{follows.length !== 1 ? 's' : ''}</span>
          </div>

          {/* Comments */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Discussion ({comments.length})</h4>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Be the first.</p>}
              {comments.map((c) => (
                <div key={c.id} className={cn('rounded-lg p-2.5 text-sm', c.is_official ? 'bg-primary/5 border border-primary/20' : 'bg-muted')}>
                  <div className="flex items-center gap-1.5 text-xs font-medium mb-0.5">
                    {c.is_official ? <ShieldCheck className="h-3 w-3 text-primary" /> : <User className="h-3 w-3" />}
                    <span className={c.is_official ? 'text-primary' : ''}>
                      {c.is_official ? 'Official' : (c.author_name || 'Resident')}
                    </span>
                    <span className="text-muted-foreground">· {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</span>
                  </div>
                  <p className="whitespace-pre-wrap">{c.content}</p>
                </div>
              ))}
            </div>

            {user ? (
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Write a comment..."
                  rows={2}
                  className="resize-none text-sm"
                />
                <Button
                  size="icon"
                  onClick={() => commentText.trim() && commentMutation.mutate(commentText.trim())}
                  disabled={!commentText.trim() || commentMutation.isPending}
                >
                  {commentMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sign in to comment.</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const TimelineRow = ({ active, label, date }: { active: boolean; label: string; date: string | null }) => (
  <div className="flex items-center gap-2 text-sm">
    <div className={cn('h-2 w-2 rounded-full', active ? 'bg-primary' : 'bg-muted-foreground/30')} />
    <span className={cn(active ? 'font-medium' : 'text-muted-foreground')}>{label}</span>
    {date && <span className="text-xs text-muted-foreground ml-auto">{format(new Date(date), 'MMM d, h:mm a')}</span>}
  </div>
);
