import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import {
  Check,
  Clock3,
  Filter,
  Loader2,
  MessageSquare,
  MoreVertical,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Feedback = Tables<'resident_feedback'>;
type FeedbackFilter = 'all' | 'reviewed' | 'pending';

const getInitials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'R';

const AdminFeedback = () => {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [profileNames, setProfileNames] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FeedbackFilter>('all');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchFeedback = useCallback(async () => {
    const { data, error } = await supabase
      .from('resident_feedback')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load feedback');
      setIsLoading(false);
      return;
    }

    const rows = (data || []) as Feedback[];
    setFeedback(rows);
    setIsLoading(false);

    const userIds = [
      ...new Set(
        rows
          .filter((item) => !item.is_anonymous && item.user_id)
          .map((item) => item.user_id as string),
      ),
    ];

    if (userIds.length > 0) {
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name')
        .in('user_id', userIds);

      if (profilesError) {
        toast.error('Failed to load feedback author names');
      } else {
        setProfileNames(
          Object.fromEntries(
            (profiles ?? []).map((profile) => [profile.user_id, profile.full_name || 'Resident']),
          ),
        );
      }
    }

  }, []);

  useEffect(() => {
    void fetchFeedback();
    const channel = supabase
      .channel('admin-feedback-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resident_feedback' },
        () => void fetchFeedback(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchFeedback]);

  const reviewedIds = useMemo(
    () => new Set(feedback.filter((item) => item.is_reviewed).map((item) => item.id)),
    [feedback],
  );

  const toggleReviewed = async (id: string) => {
    const item = feedback.find((entry) => entry.id === id);
    if (!item) return;

    const nextIsReviewed = !item.is_reviewed;
    const { error } = await supabase
      .from('resident_feedback')
      .update({ is_reviewed: nextIsReviewed })
      .eq('id', id)
      .select('id')
      .single();

    if (error) {
      console.error('Failed to update feedback review status:', error);
      toast.error('Failed to update feedback review status');
      return;
    }

    setFeedback((current) =>
      current.map((entry) =>
        entry.id === id ? { ...entry, is_reviewed: nextIsReviewed } : entry,
      ),
    );
    toast.success(nextIsReviewed ? 'Feedback marked as reviewed' : 'Feedback marked as pending');
    setOpenMenuId(null);
  };

  const deleteFeedback = async (id: string) => {
    const { error } = await supabase
      .from('resident_feedback')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    if (error) {
      toast.error('Failed to delete feedback');
      return;
    }

    setFeedback((current) => current.filter((item) => item.id !== id));
    setOpenMenuId(null);
    toast.success('Feedback deleted');
  };

  const ratedFeedback = feedback.filter((item) => typeof item.rating === 'number');
  const averageRating = ratedFeedback.length
    ? (
        ratedFeedback.reduce((sum, item) => sum + (item.rating || 0), 0) /
        ratedFeedback.length
      ).toFixed(1)
    : '0.0';

  const filteredFeedback = useMemo(() => {
    const query = search.trim().toLowerCase();

    return feedback.filter((item) => {
      const isReviewed = reviewedIds.has(item.id);
      if (filter === 'reviewed' && !isReviewed) return false;
      if (filter === 'pending' && isReviewed) return false;

      if (!query) return true;
      const name = item.is_anonymous
        ? 'Anonymous'
        : item.user_id
          ? profileNames[item.user_id] || 'Resident'
          : 'Resident';

      return [name, item.subject, item.message].some((value) =>
        value.toLowerCase().includes(query),
      );
    });
  }, [feedback, filter, profileNames, reviewedIds, search]);

  if (isLoading) {
    return (
      <AdminLayout title="Feedback" subtitle="Loading submissions...">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Feedback" subtitle={`${feedback.length} total submissions`}>
      <div className="space-y-4">
        <section aria-label="Feedback summary" className="grid grid-cols-2 border-y border-border/70">
          <div className="flex items-center gap-3 py-4 pr-3 sm:gap-4 sm:py-5 sm:pr-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning sm:h-12 sm:w-12">
              <Star className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{averageRating} / 5</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">Average Rating</p>
            </div>
          </div>
          <div className="flex items-center gap-3 border-l border-border/70 py-4 pl-3 sm:gap-4 sm:py-5 sm:pl-6">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-12 sm:w-12">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-extrabold tracking-tight sm:text-2xl">{feedback.length}</p>
              <p className="mt-1 text-xs font-medium text-muted-foreground sm:text-sm">Total Feedback</p>
            </div>
          </div>
        </section>

        <section
          aria-label="Search and filter feedback"
          className="flex flex-col gap-3 border-b border-border/70 pb-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="relative min-w-0 sm:w-full sm:max-w-[520px]">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search feedback..."
              aria-label="Search feedback"
              className="h-10 rounded-xl border-border/70 bg-card pl-10 text-sm shadow-none"
            />
          </div>
          <Select value={filter} onValueChange={(value) => setFilter(value as FeedbackFilter)}>
            <SelectTrigger className="h-10 w-full justify-start gap-2 rounded-xl border-border/70 bg-card sm:w-[210px]">
              <Filter className="h-4 w-4 shrink-0 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All Feedback</SelectItem>
              <SelectItem value="reviewed">Reviewed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section aria-label="Feedback submissions">
          {filteredFeedback.length === 0 ? (
            <div className="flex min-h-[190px] flex-col items-center justify-center px-4 py-8 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageSquare className="h-6 w-6" />
              </span>
              <p className="font-bold">
                {feedback.length === 0 ? 'No feedback yet' : 'No feedback found'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {feedback.length === 0
                  ? 'Resident submissions will appear here.'
                  : 'Try another search or filter.'}
              </p>
              {(search || filter !== 'all') && (
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="mt-2"
                  onClick={() => {
                    setSearch('');
                    setFilter('all');
                  }}
                >
                  Clear search and filters
                </Button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/70 border-b border-border/70">
              <div className="hidden grid-cols-[minmax(150px,1.1fr)_minmax(0,2fr)_86px_112px_48px] items-center gap-3 border-y border-border/70 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Resident</span>
                <span>Feedback</span>
                <span>Rating</span>
                <span>Status</span>
                <span className="text-center">Actions</span>
              </div>
              {filteredFeedback.map((item) => {
                const name = item.is_anonymous
                  ? 'Anonymous'
                  : item.user_id
                    ? profileNames[item.user_id] || 'Resident'
                    : 'Resident';
                const isReviewed = reviewedIds.has(item.id);
                const rating = item.rating || 0;

                return (
                  <div
                    key={item.id}
                    className="grid gap-3 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(150px,1.1fr)_minmax(0,2fr)_86px_112px_48px] lg:items-center lg:px-2"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-extrabold text-primary">
                        {getInitials(name)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">{name}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {format(new Date(item.created_at), 'MMM d, yyyy')}
                          <span className="mx-1">&bull;</span>
                          {item.is_anonymous ? 'Anonymous' : 'Resident'}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Feedback
                      </p>
                      <h2 className="truncate text-sm font-bold text-foreground">{item.subject}</h2>
                      <p className="mt-0.5 line-clamp-2 break-words text-sm leading-relaxed text-muted-foreground">
                        {item.message}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:block">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Rating
                      </span>
                      <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
                        {Array.from({ length: 5 }).map((_, index) => (
                          <Star
                            key={index}
                            className={cn(
                              'h-3.5 w-3.5',
                              index < rating
                                ? 'fill-warning text-warning'
                                : 'text-muted-foreground/35',
                            )}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-start">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Status
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold',
                          isReviewed
                            ? 'bg-primary/10 text-primary'
                            : 'bg-warning/10 text-warning-foreground',
                        )}
                      >
                        {isReviewed ? (
                          <Check className="h-3.5 w-3.5" strokeWidth={3} />
                        ) : (
                          <Clock3 className="h-3.5 w-3.5" />
                        )}
                        {isReviewed ? 'Reviewed' : 'Pending'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between lg:justify-end">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Actions
                      </span>
                      <Popover
                        open={openMenuId === item.id}
                        onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}
                      >
                        <PopoverTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label={`Actions for feedback from ${name}`}
                          >
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" className="w-52 rounded-xl p-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full justify-start"
                            onClick={() => toggleReviewed(item.id)}
                          >
                            {isReviewed ? <Clock3 /> : <Check />}
                            {isReviewed ? 'Mark as pending' : 'Mark as reviewed'}
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                type="button"
                                variant="ghost"
                                className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 />
                                Delete feedback
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this feedback?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => void deleteFeedback(item.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminFeedback;
