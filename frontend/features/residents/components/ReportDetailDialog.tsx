import { useEffect, useState, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlignLeft,
  Bell,
  BellOff,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileText,
  Image as ImageIcon,
  Map,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Tag,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { ImagePreview } from '@/features/reports/components/MediaUpload';
import { LocationPicker } from '@/features/reports/components/LocationPicker';
import { useAuth } from '@/features/auth/useAuth';
import { reportQueryKeys } from '@/features/reports/api/reportQueryKeys';
import { getResidentReportUpdate } from '@/features/reports/reportUpdateText';
import { supabase } from '@/integrations/supabase/client';
import { getApprovedCategoryLabel } from '@/lib/reportAnalysis';
import {
  VERIFIED_PURISIMA_BOUNDARY,
  verifyPointWithinBarangayBoundary,
} from '@/lib/purisimaGeo';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAppPreferences } from '@/lib/preferences';

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
  admin_review_notes?: string | null;
  reporter_name: string | null;
  reporter_contact?: string | null;
  response_at: string | null;
  resolved_at: string | null;
  updated_at?: string;
  action_taken?: string | null;
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

interface ProgressStep {
  label: string;
  date: string | null;
}

interface Props {
  report: PublicReport | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mobileMyReportsLayout?: boolean;
}

export const statusMeta: Record<string, { label: string; cls: string }> = {
  pending: {
    label: 'Pending',
    cls: 'border-orange-500/30 bg-orange-500/15 text-orange-600 dark:text-orange-400',
  },
  under_review: {
    label: 'Under Review',
    cls: 'border-amber-500/30 bg-amber-500/15 text-amber-600 dark:text-amber-400',
  },
  assigned: {
    label: 'Assigned',
    cls: 'border-indigo-500/30 bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
  },
  in_progress: {
    label: 'In Progress',
    cls: 'border-blue-500/30 bg-blue-500/15 text-blue-600 dark:text-blue-400',
  },
  completed: {
    label: 'Resolved',
    cls: 'border-primary/30 bg-primary/15 text-primary',
  },
  closed: {
    label: 'Closed',
    cls: 'border-gray-500/30 bg-gray-500/15 text-gray-600 dark:text-gray-400',
  },
};

const getOfficialUpdateLabel = (status: string) => {
  switch (status) {
    case 'under_review':
      return 'Review Update';
    case 'assigned':
      return 'Assignment Update';
    case 'in_progress':
      return 'Progress Update';
    case 'completed':
    case 'closed':
      return 'Resolution Details';
    default:
      return 'Barangay Response';
  }
};

const getReportStage = (status: string) => {
  if (status === 'completed' || status === 'closed') return 3;
  if (status === 'assigned' || status === 'in_progress') return 2;
  if (status === 'under_review') return 1;
  return 0;
};

const getProgressSteps = (report: PublicReport): ProgressStep[] => {
  const stage = getReportStage(report.status);
  return [
    { label: 'Submitted', date: report.created_at },
    {
      label: 'Under Review',
      date:
        stage >= 1
          ? report.status === 'under_review'
            ? report.updated_at || report.response_at
            : report.response_at
          : null,
    },
    {
      label: 'In Progress',
      date:
        stage >= 2 && (report.status === 'assigned' || report.status === 'in_progress')
          ? report.updated_at || report.response_at
          : null,
    },
    {
      label: 'Resolved',
      date: stage >= 3 ? report.resolved_at || report.updated_at || null : null,
    },
  ];
};

const getCleanDescription = (description: string) =>
  description
    .replace(/\n\nAI Validation:[\s\S]*$/i, '')
    .replace(/\n\nCaptured:[^\r\n]*\r?\nPurok:[^\r\n]*\r?\nGPS:[^\r\n]*$/i, '')
    .trim();

export const ReportDetailDialog = ({
  report,
  open,
  onOpenChange,
  mobileMyReportsLayout = false,
}: Props) => {
  const { user } = useAuth();
  const { translate } = useAppPreferences();
  const queryClient = useQueryClient();
  const [isDesktopViewport, setIsDesktopViewport] = useState(() =>
    !mobileMyReportsLayout ||
    (typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches)
  );
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!mobileMyReportsLayout) return;
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const updateViewport = () => setIsDesktopViewport(mediaQuery.matches);
    updateViewport();
    mediaQuery.addEventListener('change', updateViewport);
    return () => mediaQuery.removeEventListener('change', updateViewport);
  }, [mobileMyReportsLayout]);

  const showMyReportsMobileView = mobileMyReportsLayout && !isDesktopViewport;

  const { data: comments = [] } = useQuery({
    queryKey: reportQueryKeys.comments(report?.id),
    queryFn: async (): Promise<Comment[]> => {
      if (!report) return [];
      const { data, error } = await supabase
        .from('report_comments')
        .select('*')
        .eq('report_id', report.id)
        .eq('is_official', true)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: Boolean(report && open),
  });

  const { data: follows = [] } = useQuery({
    queryKey: reportQueryKeys.follows(report?.id),
    queryFn: async () => {
      if (!report) return [];
      const { data, error } = await supabase
        .from('report_follows')
        .select('user_id')
        .eq('report_id', report.id);
      if (error) throw error;
      return data || [];
    },
    enabled: Boolean(report && open),
  });

  useEffect(() => {
    if (!report || !open) return;
    const channel = supabase
      .channel('report-' + report.id)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_comments',
          filter: 'report_id=eq.' + report.id,
        },
        () => queryClient.invalidateQueries({ queryKey: reportQueryKeys.comments(report.id) }),
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'report_follows',
          filter: 'report_id=eq.' + report.id,
        },
        () => queryClient.invalidateQueries({ queryKey: reportQueryKeys.follows(report.id) }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, queryClient, report]);

  const isFollowing = Boolean(user && follows.some((follow) => follow.user_id === user.id));

  const followMutation = useMutation({
    mutationFn: async () => {
      if (!user || !report) return;
      const query = isFollowing
        ? supabase
            .from('report_follows')
            .delete()
            .eq('report_id', report.id)
            .eq('user_id', user.id)
        : supabase.from('report_follows').insert({ report_id: report.id, user_id: user.id });
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportQueryKeys.follows(report?.id) });
      toast.success(
        isFollowing
          ? translate('Unfollowed report')
          : translate("Following report — you'll get updates"),
      );
    },
    onError: () => toast.error(translate('Could not update follow')),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !report || report.user_id !== user.id || report.status !== 'pending') {
        throw new Error('Only your pending reports can be deleted.');
      }

      const { data, error } = await supabase
        .from('community_reports')
        .delete()
        .eq('id', report.id)
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('The delete policy may not be deployed, or the report is no longer pending.');
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: reportQueryKeys.all });
      setDeleteDialogOpen(false);
      onOpenChange(false);
      toast.success(translate('Report deleted.'));
    },
    onError: (error) => {
      console.error('Failed to delete report:', error);
      toast.error(
        translate('Could not delete report. Confirm the delete policy is deployed and the report is pending.'),
      );
    },
  });

  if (!report) return null;

  const meta = statusMeta[report.status] || statusMeta.pending;
  const created = new Date(report.created_at);
  const isOwner = Boolean(user && report.user_id === user.id);
  const officialUpdateLabel = getOfficialUpdateLabel(report.status);
  const residentUpdate = getResidentReportUpdate(report);
  const cleanTitle = report.title.replace(/^\[REPORT\]\s*/, '');
  const cleanCategory = getApprovedCategoryLabel(report.category);
  const cleanDescription = getCleanDescription(report.description);
  const reportReference = `REPORT-${report.id.slice(0, 8).toUpperCase()}`;
  const reportImage = report.photo_url || report.media_urls?.find(Boolean) || null;
  const coordinates =
    report.latitude != null && report.longitude != null
      ? { lat: Number(report.latitude), lng: Number(report.longitude) }
      : null;
  const locationParts = report.location?.split(',').map((part) => part.trim()) || [];
  const purok = locationParts.find((part) => /^purok\b/i.test(part)) || '—';
  const locationVerification = coordinates
    ? verifyPointWithinBarangayBoundary(coordinates, VERIFIED_PURISIMA_BOUNDARY)
    : null;
  const locationIsVerified = Boolean(
    locationVerification?.hasVerifiedBoundary && locationVerification.isInside === true,
  );
  const progressSteps = getProgressSteps(report);
  const currentStepIndex = getReportStage(report.status);
  const latestUpdate =
    report.resolved_at || report.updated_at || report.response_at || report.created_at;
  const handleCopyReportId = async () => {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error(translate('Clipboard access is unavailable.'));
      }
      await navigator.clipboard.writeText(reportReference);
      toast.success(translate('Report ID copied'));
    } catch (error) {
      console.error('Failed to copy report ID', error);
      toast.error(translate('Unable to copy the report ID.'));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        closeButtonClassName="hidden"
        className={cn(
          '!block !h-[100dvh] !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-x-hidden overflow-y-auto rounded-none border-0 bg-background p-0 shadow-2xl ring-0 [scrollbar-gutter:stable]',
          '!left-0 !top-0',
        )}
      >
        <div
          className={cn(
            'min-h-full',
            'p-2 sm:p-3 lg:p-4 lg:pb-6',
          )}
        >
          <DialogTitle className="sr-only">{cleanTitle}</DialogTitle>
          {(!mobileMyReportsLayout || isDesktopViewport) && (
            <div>
          <header>
            <div className="flex min-w-0 items-center justify-between gap-2">
              <h2 className="min-w-0 flex-1 truncate text-lg font-extrabold leading-tight tracking-tight sm:text-2xl">
                {cleanTitle}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                {isOwner && report.status === 'pending' && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full border-0 bg-red-50 p-0 text-red-600 shadow-none hover:bg-red-100 hover:text-red-700 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                    aria-label={translate('Delete report')}
                    title={translate('Delete report')}
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div
                  className={cn(
                    'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold sm:text-sm',
                    meta.cls,
                  )}
                >
                  {(report.status === 'completed' || report.status === 'closed') && (
                    <Check className="h-4 w-4" strokeWidth={3} />
                  )}
                  {translate(meta.label)}
                </div>
                <DialogClose asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 rounded-full border border-border/70 bg-background p-0 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground focus-visible:ring-0"
                    aria-label={translate('Close report details')}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </DialogClose>
              </div>
            </div>

            <div className="mt-1.5 inline-flex items-center rounded-full bg-muted pr-1 text-muted-foreground">
              <span
                className="inline-flex px-3 py-1 font-mono text-[11px] font-semibold"
                title={report.id}
              >
                Report ID: {reportReference}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="h-6 w-6 shrink-0 rounded-full p-0 text-muted-foreground hover:bg-background hover:text-primary"
                aria-label={translate('Copy report ID')}
                title={translate('Copy report ID')}
                onClick={() => void handleCopyReportId()}
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
          </header>

          <section className="mt-5 rounded-[18px] border border-border/70 bg-card p-2.5 shadow-sm sm:p-3">
            <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                {translate('Report Progress')}
              </h2>
              <span className="ml-auto max-w-full self-end truncate rounded-full bg-primary/10 px-3 py-1 text-right text-[10px] font-semibold text-primary sm:w-fit sm:text-xs">
                Last Update: {format(new Date(latestUpdate), 'MMM d, h:mm a')}
              </span>
            </div>

            <div
              className={cn(
                'mt-2 grid gap-1.5 md:gap-0',
                'md:grid-cols-4',
              )}
            >
              {progressSteps.map((step, index) => (
                <ProgressStepItem
                  key={step.label}
                  step={step}
                  index={index}
                  currentStepIndex={currentStepIndex}
                  isLast={index === progressSteps.length - 1}
                />
              ))}
            </div>
          </section>

          <div className="mt-2 grid gap-1.5 lg:grid-cols-2">
              <section className="order-1 flex h-auto flex-col overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm lg:h-full">
                {reportImage ? (
                  <ImagePreview
                    src={reportImage}
                    alt={'Evidence for ' + cleanTitle}
                    className="w-full bg-muted lg:min-h-40 lg:flex-1"
                    fullScreenOnMobile
                  >
                    <img
                      src={reportImage}
                      alt={'Evidence for ' + cleanTitle}
                      className="block h-auto w-full object-contain lg:absolute lg:inset-0 lg:h-full lg:object-cover"
                    />
                  </ImagePreview>
                ) : (
                  <div className="flex min-h-40 flex-1 flex-col items-center justify-center gap-2 bg-muted/35 text-muted-foreground">
                    <ImageIcon className="h-9 w-9" />
                    <span className="text-sm font-medium">{translate('No evidence image available')}</span>
                  </div>
                )}
              </section>

              <section className="order-3 h-full overflow-hidden rounded-[18px] border border-border/70 bg-card p-2.5 shadow-sm lg:col-span-2">
                <div className="mb-1.5 flex items-center gap-3 px-1">
                  <Map className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                    {translate('Reported Location')}
                  </h2>
                </div>
                {coordinates ? (
                  <LocationPicker
                    value={coordinates}
                    onChange={() => undefined}
                    height="380px"
                    readOnly
                    hideLabel
                    hideCoordinates={mobileMyReportsLayout}
                    focusOnValue
                    zoomControlVariant="report"
                    markerVariant="report"
                  />
                ) : (
                  <div className="flex min-h-[260px] flex-col items-center justify-center gap-2 rounded-2xl bg-muted/30 text-center text-muted-foreground">
                    <MapPin className="h-8 w-8" />
                    <p className="text-sm font-semibold">{translate('No map coordinates were saved.')}</p>
                    {report.location && <p className="max-w-sm text-xs">{report.location}</p>}
                  </div>
                )}
              </section>
              <section className="order-2 h-full rounded-[18px] border border-border/70 bg-card p-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                    {translate('Report Information')}
                  </h2>
                </div>
                <div className="space-y-2">
                  <InformationRow label={translate('Category')}>
                    <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                      {cleanCategory}
                    </span>
                  </InformationRow>
                  <InformationRow label={translate('Description')}>
                    <p className="whitespace-pre-wrap leading-relaxed">{cleanDescription}</p>
                  </InformationRow>
                  <InformationRow label={translate('Location')}>
                    <p>{report.location || translate('Location not provided')}</p>
                  </InformationRow>
                  <InformationRow label={translate('Date & Time')}>
                    <p>{format(created, 'MMM d, yyyy, h:mm a')}</p>
                  </InformationRow>
                  {report.assigned_department && (
                    <InformationRow label={translate('Assigned Office')}>
                      <p>{report.assigned_department}</p>
                    </InformationRow>
                  )}
                  <div className="border-t border-border/60 pt-2">
                    <h3 className="mb-1.5 flex items-center gap-2 text-base font-extrabold tracking-tight text-foreground sm:text-lg">
                      <User className="h-4 w-4 text-primary" />
                      {translate('Reporter Information')}
                    </h3>
                    <div className="space-y-2">
                      <InformationRow label={translate('Name')}>
                        <p>{report.reporter_name || '—'}</p>
                      </InformationRow>
                      {report.reporter_contact !== undefined && (
                        <InformationRow label={translate('Contact')}>
                          <p>{report.reporter_contact || '—'}</p>
                        </InformationRow>
                      )}
                    </div>
                  </div>
                </div>
              </section>

          </div>
            </div>
          )}

          {showMyReportsMobileView && (
            <div>
              <header className="px-3 pb-2 pt-6">
                <div className="flex min-w-0 items-center gap-2">
                  <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold leading-tight text-[#0b1838] dark:text-foreground">
                    {cleanTitle}
                  </h1>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-extrabold',
                      meta.cls,
                    )}
                  >
                    {translate(meta.label)}
                  </span>
                  {isOwner && report.status === 'pending' && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full border-0 bg-red-50 p-0 text-red-600 shadow-none hover:bg-red-100 hover:text-red-700 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20 dark:hover:text-red-200"
                      aria-label={translate('Delete report')}
                      title={translate('Delete report')}
                      onClick={() => setDeleteDialogOpen(true)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                  <DialogClose asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 rounded-full border border-border/70 bg-background p-0 text-muted-foreground shadow-sm hover:bg-muted hover:text-foreground focus-visible:ring-0"
                      aria-label={translate('Close report details')}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </DialogClose>
                </div>

                <div className="mt-3 flex items-center justify-between gap-1 rounded-full bg-[#e8f7f0] py-1 pl-2.5 pr-1 text-xs text-[#0b1838] dark:bg-primary/10 dark:text-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileText className="h-3.5 w-3.5 shrink-0 text-[#008c5b]" />
                    <span className="truncate font-semibold">
                      {translate('Report ID')}: {reportReference}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 rounded-full p-0 text-[#008c5b] hover:bg-white/70 dark:text-teal-300 dark:hover:bg-white/10"
                    aria-label={translate('Copy report ID')}
                    onClick={() => void handleCopyReportId()}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </header>

              <main className="space-y-4 px-4 pb-4 pt-1">
                <section className="rounded-[22px] bg-[#eff8f4] p-3 dark:bg-card">
                  <div className="flex min-w-0 items-center justify-between gap-1.5">
                    <h2 className="min-w-0 flex-1 truncate whitespace-nowrap text-[13px] font-extrabold tracking-tight text-[#0b1838] dark:text-foreground">
                      {translate('Report Progress')}
                    </h2>
                    <span className="shrink-0 whitespace-nowrap rounded-full bg-[#dcf3e8] px-1.5 py-1 text-[8px] font-bold text-[#008c5b] dark:bg-primary/15 dark:text-teal-300">
                      {translate('Last Update: {date}', {
                        date: format(new Date(latestUpdate), 'MMM d, h:mm a'),
                      })}
                    </span>
                  </div>

                  <div className="relative mt-4">
                    <div className="absolute left-[12.5%] right-[12.5%] top-4 h-0.5 bg-[#cbd5df] dark:bg-slate-600" />
                    {currentStepIndex > 0 && (
                      <div
                        className="absolute left-[12.5%] top-4 h-0.5 bg-[#008c5b]"
                        style={{
                          width: `${(currentStepIndex / (progressSteps.length - 1)) * 75}%`,
                        }}
                      />
                    )}
                    <div className="relative grid grid-cols-4 gap-1">
                      {progressSteps.map((step, index) => {
                        const active = index <= currentStepIndex;
                        return (
                          <div key={step.label} className="flex min-w-0 flex-col items-center text-center">
                            <span
                              className={cn(
                                'z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 bg-white dark:bg-card',
                                active
                                  ? 'border-[#008c5b] bg-[#008c5b] text-white'
                                  : 'border-[#aab6c5] text-[#aab6c5] dark:border-slate-600 dark:text-slate-500',
                              )}
                            >
                              {active ? (
                                <Check className="h-4 w-4" strokeWidth={3} />
                              ) : (
                                <span className="h-2 w-2 rounded-full bg-current" />
                              )}
                            </span>
                            <span
                              className={cn(
                                'mt-2 flex min-h-7 w-full items-center justify-center rounded-full px-1 text-[9px] font-extrabold leading-tight min-[400px]:text-[10px]',
                                active
                                  ? 'bg-[#008c5b] text-white'
                                  : 'bg-[#e9eef1] text-[#344054] dark:bg-muted dark:text-muted-foreground',
                              )}
                            >
                              {translate(step.label)}
                            </span>
                            <span className="mt-1 text-[9px] leading-tight text-[#68778e] dark:text-muted-foreground min-[400px]:text-[10px]">
                              {step.date
                                ? format(new Date(step.date), 'MMM d, h:mm a')
                                : translate('Pending')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <section className="overflow-hidden rounded-[20px] border border-[#e4ebef] bg-white shadow-sm dark:border-border/70 dark:bg-card">
                  {reportImage ? (
                    <ImagePreview
                      src={reportImage}
                      alt={'Evidence for ' + cleanTitle}
                      className="w-full bg-white dark:bg-card"
                      fullScreenOnMobile
                    >
                      <img
                        src={reportImage}
                        alt={'Evidence for ' + cleanTitle}
                        className="block h-auto w-full object-contain"
                      />
                    </ImagePreview>
                  ) : (
                    <div className="flex min-h-48 flex-col items-center justify-center gap-2 bg-[#f5f8f8] text-sm font-medium text-muted-foreground">
                      <ImageIcon className="h-9 w-9" />
                      {translate('No evidence image available')}
                    </div>
                  )}
                </section>

                <section className="rounded-[22px] border border-[#e4ebef] bg-white p-4 dark:border-border/70 dark:bg-card">
                  <h2 className="mb-2 text-lg font-extrabold tracking-tight text-[#0b1838] dark:text-foreground">
                    {translate('Report Information')}
                  </h2>
                  <div className="divide-y divide-[#e7edf0] dark:divide-border/60">
                    <MobileInformationRow label={translate('Category')} icon={<Tag className="h-5 w-5" />}>
                      <span className="inline-flex rounded-full bg-[#e2f5eb] px-3 py-1 text-xs font-bold text-[#008c5b]">
                        {cleanCategory}
                      </span>
                    </MobileInformationRow>
                    <MobileInformationRow label={translate('Description')} icon={<AlignLeft className="h-5 w-5" />}>
                      <p className="whitespace-pre-wrap leading-snug">{cleanDescription}</p>
                    </MobileInformationRow>
                    <MobileInformationRow label={translate('Purok')} icon={<User className="h-5 w-5" />}>
                      <p>{purok}</p>
                    </MobileInformationRow>
                    <MobileInformationRow label={translate('Location')} icon={<MapPin className="h-5 w-5" />}>
                      <p>{report.location || translate('Location not provided')}</p>
                    </MobileInformationRow>
                    <MobileInformationRow label={translate('Date & Time')} icon={<CalendarDays className="h-5 w-5" />}>
                      <p>{format(created, 'MMM d, yyyy, h:mm a')}</p>
                    </MobileInformationRow>
                    {report.assigned_department && (
                      <MobileInformationRow label={translate('Assigned Office')} icon={<Building2 className="h-5 w-5" />}>
                        <p>{report.assigned_department}</p>
                      </MobileInformationRow>
                    )}
                  </div>
                </section>

                <details className="group rounded-[20px] border border-[#e4ebef] bg-white px-4 py-3 dark:border-border/70 dark:bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-3">
                    <User className="h-6 w-6 shrink-0 text-[#008c5b]" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold text-[#0b1838] dark:text-foreground">
                        {translate('Reporter Information')}
                      </span>
                      <span className="block text-xs text-[#68778e] dark:text-muted-foreground">
                        {translate('Optional details (Name and Contact)')}
                      </span>
                    </span>
                    <ChevronDown className="h-5 w-5 shrink-0 text-[#0b1838] transition-transform group-open:rotate-180 dark:text-foreground" />
                  </summary>
                  <div className="mt-3 space-y-3 border-t border-[#e7edf0] pt-3 dark:border-border/60">
                    <InformationRow label={translate('Name')}>
                      <p>{report.reporter_name || '—'}</p>
                    </InformationRow>
                    {report.reporter_contact !== undefined && (
                      <InformationRow label={translate('Contact')}>
                        <p>{report.reporter_contact || '—'}</p>
                      </InformationRow>
                    )}
                  </div>
                </details>

                <section className="rounded-[22px] border border-[#e1efe8] bg-[#f0f9f5] p-4 dark:border-border/70 dark:bg-card">
                  <h2 className="mb-3 flex items-center gap-2 text-lg font-extrabold text-[#0b1838] dark:text-foreground">
                    <MapPin className="h-6 w-6 text-[#008c5b]" />
                    {translate('Reported Location')}
                  </h2>
                  {coordinates ? (
                    <LocationPicker
                      value={coordinates}
                      onChange={() => undefined}
                      height="min(38dvh, 300px)"
                      readOnly
                      hideLabel
                      hideCoordinates
                      zoomControlVariant="report"
                      markerVariant="report"
                      focusOnValue
                    />
                  ) : (
                    <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl bg-white/70 text-center text-muted-foreground">
                      <MapPin className="h-8 w-8" />
                      <p className="text-sm font-semibold">{translate('No map coordinates were saved.')}</p>
                    </div>
                  )}
                  <div
                    className={cn(
                      'mt-3 flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-extrabold',
                      locationIsVerified
                        ? 'bg-[#d6f7e5] text-[#008c5b]'
                        : 'bg-amber-100 text-amber-800',
                    )}
                  >
                    <ShieldCheck className="h-5 w-5 shrink-0" />
                    {locationIsVerified
                      ? translate('Location verified.')
                      : translate('Location not verified.')}
                  </div>
                </section>
              </main>
            </div>
          )}

          <section
            className={cn(
              'mt-2 rounded-[18px] border border-border/70 bg-card p-3 shadow-sm',
              showMyReportsMobileView &&
                'mx-4 mt-1 rounded-[22px] border-[#e4ebef] bg-white p-3 dark:border-border/70 dark:bg-card lg:mx-0 lg:mt-2 lg:rounded-[18px] lg:border-border/70 lg:bg-card lg:p-3',
            )}
          >
            <div
              className={cn(
                'flex min-w-0 flex-col gap-2 border-b border-border/60 pb-2.5 sm:flex-row sm:items-center sm:justify-between',
                showMyReportsMobileView && 'border-b pb-2.5 lg:border-b lg:pb-2.5',
              )}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <h2
                    className={cn(
                      'text-lg font-extrabold tracking-tight sm:text-xl',
                      showMyReportsMobileView &&
                        'min-w-0 whitespace-nowrap text-lg leading-tight tracking-tight lg:text-lg lg:tracking-normal',
                    )}
                  >
                    {translate('Messages & Updates')}
                  </h2>
                </div>
              </div>

              {!isOwner && (
                <div className="flex items-center gap-2">
                  {user && (
                    <Button
                      variant={isFollowing ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => followMutation.mutate()}
                      disabled={followMutation.isPending}
                      className="gap-1.5 rounded-full"
                    >
                      {isFollowing ? (
                        <BellOff className="h-4 w-4" />
                      ) : (
                        <Bell className="h-4 w-4" />
                      )}
                      {isFollowing ? translate('Following') : translate('Follow report')}
                    </Button>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {translate(
                      follows.length === 1 ? '{count} follower' : '{count} followers',
                      { count: follows.length },
                    )}
                  </span>
                </div>
              )}
            </div>

            <div className="mt-2.5 space-y-2">
              {(residentUpdate || report.action_taken) && (
                <DiscussionEntry
                  official
                  author={translate('Barangay Response')}
                  date={latestUpdate}
                  label={translate(officialUpdateLabel)}
                  content={residentUpdate || report.action_taken || ''}
                  secondaryContent={
                    residentUpdate &&
                    report.action_taken &&
                    residentUpdate !== report.action_taken
                      ? report.action_taken
                      : undefined
                  }
                />
              )}

              {comments.map((comment) => (
                <DiscussionEntry
                  key={comment.id}
                  official={comment.is_official}
                  author={
                    comment.is_official
                      ? translate('Barangay Response')
                      : comment.author_name || 'Resident'
                  }
                  date={comment.created_at}
                  content={comment.content}
                />
              ))}

              {comments.length === 0 && !residentUpdate && !report.action_taken && (
                showMyReportsMobileView ? (
                  <div className="flex min-h-[112px] flex-col items-center justify-center py-3 text-center">
                    <div className="relative mb-1 h-14 w-20 text-[#b8ead3]">
                      <MessageCircle className="absolute left-1 top-0 h-10 w-10 fill-current stroke-white/80" />
                      <MessageCircle className="absolute bottom-0 right-0 h-10 w-10 fill-current stroke-white/80" />
                      <span className="absolute left-4 top-4 flex gap-1">
                        <i className="h-1.5 w-1.5 rounded-full bg-[#68c79a]" />
                        <i className="h-1.5 w-1.5 rounded-full bg-[#68c79a]" />
                        <i className="h-1.5 w-1.5 rounded-full bg-[#68c79a]" />
                      </span>
                    </div>
                    <p className="text-sm text-[#68778e] dark:text-muted-foreground">{translate('No messages yet.')}</p>
                  </div>
                ) : (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    No messages yet.
                  </p>
                )
              )}
            </div>
          </section>
        </div>
      </DialogContent>
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(isOpen) => {
          if (!deleteMutation.isPending) setDeleteDialogOpen(isOpen);
        }}
      >
        <AlertDialogContent className="border-0">
          <AlertDialogHeader>
            <AlertDialogTitle>{translate('Delete this report?')}</AlertDialogTitle>
            <AlertDialogDescription>
              {translate('This permanently deletes your pending report and its comments.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleteMutation.isPending}
              className="border border-primary/70 text-primary hover:border-primary hover:bg-primary/10"
            >
              {translate('Keep report')}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                deleteMutation.mutate();
              }}
              className="border-0 bg-red-600 text-white !outline-none !ring-0 !ring-offset-0 hover:bg-red-700 focus-visible:border-0"
            >
              {deleteMutation.isPending ? translate('Deleting...') : translate('Delete report')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
};

const ProgressStepItem = ({
  step,
  index,
  currentStepIndex,
  isLast,
}: {
  step: ProgressStep;
  index: number;
  currentStepIndex: number;
  isLast: boolean;
}) => {
  const { translate } = useAppPreferences();
  const active = index <= currentStepIndex;
  const current = index === currentStepIndex;
  const nextIsActive = index < currentStepIndex;

  return (
    <div className="relative flex min-h-16 gap-3 md:block md:min-h-0 md:text-center">
      {!isLast && (
        <>
          <span
            aria-hidden="true"
            className={cn(
              'absolute bottom-[-10px] left-[19px] top-10 border-l-2 border-dotted md:hidden',
              nextIsActive ? 'border-primary/80' : 'border-border',
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-[calc(50%+24px)] top-5 hidden w-[calc(100%-48px)] border-t-2 border-dotted md:block',
              nextIsActive ? 'border-primary/80' : 'border-border',
            )}
          />
        </>
      )}
      <div
        className={cn(
          'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-card md:mx-auto',
          active && 'border-primary text-primary',
          current && 'bg-primary text-primary-foreground',
          !active && 'border-border text-muted-foreground/45',
        )}
      >
        {active ? (
          <Check className="h-5 w-5" strokeWidth={3} />
        ) : (
          <span className="h-2 w-2 rounded-full bg-current" />
        )}
      </div>
      <div className="min-w-0 pt-0.5 md:mt-2 md:pt-0">
        <span
          className={cn(
            'inline-flex min-w-24 justify-center rounded-full px-2.5 py-1 text-xs font-extrabold',
            active && 'bg-primary/10 text-primary',
            current && 'bg-primary text-primary-foreground',
            !active && 'bg-muted text-muted-foreground',
          )}
        >
          {translate(step.label)}
        </span>
        <p className="mt-1.5 text-[11px] text-muted-foreground sm:text-xs">
          {step.date
            ? format(new Date(step.date), 'MMM d, h:mm a')
            : active
              ? translate('Time not recorded')
              : translate('Pending')}
        </p>
      </div>
    </div>
  );
};

const InformationRow = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
    <div className="font-semibold text-foreground">{label}</div>
    <div className="min-w-0 text-muted-foreground">{children}</div>
  </div>
);

const MobileInformationRow = ({
  label,
  icon,
  children,
}: {
  label: string;
  icon: ReactNode;
  children: ReactNode;
}) => (
  <div className="grid grid-cols-[24px_minmax(66px,0.42fr)_minmax(0,1fr)] items-start gap-2 py-2.5 text-sm">
    <span className="pt-0.5 text-[#008c5b]">{icon}</span>
    <span className="font-bold text-[#0b1838] dark:text-foreground">{label}</span>
    <div className="min-w-0 text-[#26364d] dark:text-muted-foreground">{children}</div>
  </div>
);

const DiscussionEntry = ({
  official,
  author,
  date,
  label,
  content,
  secondaryContent,
}: {
  official: boolean;
  author: string;
  date: string;
  label?: string;
  content: string;
  secondaryContent?: string;
}) => {
  const { translate } = useAppPreferences();

  return (
  <article className="grid grid-cols-[36px_minmax(0,1fr)] items-start gap-2.5">
    <div
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
        official
          ? 'bg-primary/10 text-primary'
          : 'bg-muted text-muted-foreground',
      )}
    >
      {official ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </div>
    <div className="min-w-0 overflow-hidden rounded-2xl bg-muted/65 px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="max-w-full break-words text-sm font-extrabold">{author}</span>
          {official && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
              <ShieldCheck className="h-3 w-3" /> {translate('Official')}
            </span>
          )}
        </div>
        <time className="shrink-0 text-[11px] text-muted-foreground">
          {format(new Date(date), 'MMM d, yyyy, h:mm a')}
        </time>
      </div>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{content}</p>
      {secondaryContent && (
        <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.055] p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-primary">
          <CheckCircle2 className="h-3.5 w-3.5" /> {translate('Action Taken')}
          </div>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{secondaryContent}</p>
        </div>
      )}
    </div>
  </article>
  );
};
