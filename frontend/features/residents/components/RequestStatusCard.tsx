import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  CheckCircle2,
  ChevronRight,
  Clock,
  ClipboardList,
  Clock3,
  FileSearch,
  Loader2,
  MapPin,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/features/auth/useAuth';
import { useAppPreferences } from '@/lib/preferences';
import { supabase } from '@/integrations/supabase/client';
import { reportQueryKeys } from '@/features/reports/api/reportQueryKeys';
import { isConfirmedTestReport } from '@/features/reports/testReports';
import { cn } from '@/lib/utils';
import { getApprovedCategoryLabel } from '@/lib/reportAnalysis';

interface ReportSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  location: string | null;
  photo_url: string | null;
  media_urls: string[] | null;
}

const useReportSummary = () => {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: reportQueryKeys.myReportSummary(user?.id),
    queryFn: async (): Promise<ReportSummary[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('community_reports')
        .select('id,title,category,status,created_at,location,photo_url,media_urls')
        .eq('user_id', user.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return ((data || []) as ReportSummary[]).filter(
        (report) => !isConfirmedTestReport(report),
      );
    },
    enabled: !!user,
    staleTime: 30_000,
    retry: 2,
    refetchOnReconnect: true,
  });

  return { user, ...query };
};

export const ReportStats = () => {
  const { t, translate } = useAppPreferences();
  const { data: reports = [], isLoading, error } = useReportSummary();

  const stats = [
    {
      icon: Clock,
      label: t.submitted,
      value: reports.filter((report) => report.status === 'pending').length,
      iconClass: 'text-orange-600 dark:text-orange-400',
      iconBg: 'bg-orange-500/10',
    },
    {
      icon: FileSearch,
      label: t.underReview,
      value: reports.filter((report) => report.status === 'under_review').length,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
    {
      icon: Clock3,
      label: t.inProgress,
      value: reports.filter((report) => ['assigned', 'in_progress'].includes(report.status)).length,
      iconClass: 'text-blue-600 dark:text-blue-400',
      iconBg: 'bg-blue-500/10',
    },
    {
      icon: CheckCircle2,
      label: t.resolve,
      value: reports.filter((report) => report.status === 'completed').length,
      iconClass: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-500/10',
    },
  ];

  return (
    <section aria-label={translate('Report status overview')} className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
      {stats.map((stat) => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="flex min-h-20 items-center gap-3 rounded-2xl border-border p-3 shadow-sm lg:px-4">
            <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', stat.iconBg)}>
              <Icon className={cn('h-5 w-5', stat.iconClass)} />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-extrabold leading-none text-foreground">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : error ? '—' : stat.value}
              </div>
              <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{stat.label}</p>
            </div>
          </Card>
        );
      })}
    </section>
  );
};

const getStatusStyle = (status: string, labels: { submitted: string; underReview: string; inProgress: string; resolve: string }) => {
  switch (status) {
    case 'pending':
      return { label: labels.submitted, className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' };
    case 'under_review':
      return { label: labels.underReview, className: 'bg-amber-500/10 text-amber-700 dark:text-amber-400' };
    case 'assigned':
    case 'in_progress':
      return { label: labels.inProgress, className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' };
    case 'completed':
      return { label: labels.resolve, className: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' };
    default:
      return { label: status.split('_').join(' '), className: 'bg-muted text-muted-foreground' };
  }
};

export const RequestStatusCard = () => {
  const navigate = useNavigate();
  const { t, translate } = useAppPreferences();
  const { user, data: reports = [], isLoading, error, refetch } = useReportSummary();

  return (
    <section className="min-w-0">
      <Card className="min-h-[9rem] overflow-hidden rounded-[20px] border-border p-0 shadow-sm dark:border-[#29414b] dark:bg-[#0d1d25]">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3.5 dark:border-[#243c46] sm:px-5">
          <h2 className="flex items-center gap-2 text-base font-bold tracking-tight text-foreground dark:text-slate-50 lg:text-lg">
            <ClipboardList className="h-[18px] w-[18px] shrink-0 text-teal-500" />
            {t.recentReports}
          </h2>
          {user && (
            <button
              type="button"
              onClick={() => navigate('/my-requests')}
              className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-primary hover:text-primary/80 dark:text-teal-400 dark:hover:text-teal-300"
            >
              {t.viewAll} <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="p-3 sm:p-4">
        {!user ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <p className="font-medium">{t.signInToTrack}</p>
            <button type="button" onClick={() => navigate('/auth')} className="mt-2 text-sm font-semibold text-primary">
              {t.signIn}
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex min-h-44 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <p className="text-sm font-semibold">{translate('Reports are temporarily unavailable')}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {translate('Your reports are safe. Try loading them again.')}
            </p>
            <button type="button" onClick={() => refetch()} className="mt-3 text-sm font-semibold text-primary">
              {translate('Try Again')}
            </button>
          </div>
        ) : reports.length === 0 ? (
          <div className="flex min-h-44 flex-col items-center justify-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <ClipboardList className="h-6 w-6" />
            </div>
            <p className="mt-3 text-sm font-semibold">{t.noReportsYet}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t.noReportsDesc}</p>
            <button type="button" onClick={() => navigate('/report-issue')} className="mt-3 text-sm font-semibold text-primary">{t.reportIssueBtn}</button>
          </div>
        ) : (
          <div className="divide-y divide-border/60 dark:divide-[#243c46]">
            {reports.slice(0, 3).map((report) => {
              const status = getStatusStyle(report.status, t);
              const imageUrl = report.photo_url || report.media_urls?.[0];

              return (
                <article
                  key={report.id}
                  role="button"
                  tabIndex={0}
                  aria-label={translate('View details for {title}', { title: report.title })}
                  onClick={() => navigate(`/my-requests?report=${encodeURIComponent(report.id)}`)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      navigate(`/my-requests?report=${encodeURIComponent(report.id)}`);
                    }
                  }}
                  className="group -mx-1 grid w-[calc(100%+0.5rem)] cursor-pointer grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-transparent px-2 py-2.5 text-left transition-colors hover:border-[#b8d8d5] hover:bg-[#f3f8f8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 dark:hover:border-[#2d4a54] dark:hover:bg-[#122630] sm:grid-cols-[4.5rem_minmax(0,1fr)_auto_auto]"
                >
                  <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary dark:bg-[#18313b] dark:text-teal-300 sm:w-[4.5rem]">
                    {imageUrl ? (
                      <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ClipboardList className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {report.title || getApprovedCategoryLabel(report.category)}
                    </p>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-muted-foreground dark:text-slate-400">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{report.location || 'Barangay Purisima'}</span>
                    </p>
                  </div>
                  <span
                    className={cn(
                      'hidden items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex',
                      status.className
                    )}
                  >
                    {status.label}
                  </span>
                  <button
                    type="button"
                    className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-border bg-secondary px-3 text-xs font-bold text-secondary-foreground transition-colors hover:border-primary/30 hover:bg-secondary hover:text-secondary-foreground dark:border-[#2d4a54] dark:bg-[#142630] dark:text-slate-100 dark:hover:bg-[#1b323c] sm:px-4"
                    onClick={(event) => {
                      event.stopPropagation();
                      navigate(`/my-requests?report=${encodeURIComponent(report.id)}`);
                    }}
                    onKeyDown={(event) => event.stopPropagation()}
                    aria-label={translate('View details for {title}', { title: report.title })}
                  >
                    <span>{translate('View Details')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </article>
              );
            })}
          </div>
        )}
        </div>
      </Card>
    </section>
  );
};
