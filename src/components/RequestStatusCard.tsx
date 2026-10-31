import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, Clock, CheckCircle2, ListChecks, ChevronRight, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAppPreferences } from "@/lib/preferences";
import { supabase } from "@/integrations/supabase/client";

interface ReportSummary {
  id: string;
  title: string;
  category: string;
  status: string;
  created_at: string;
  location: string | null;
}

export const RequestStatusCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useAppPreferences();
  const { data: reports = [], isLoading, error, refetch } = useQuery({
    queryKey: ['my-reports', user?.id],
    queryFn: async (): Promise<ReportSummary[]> => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('service_requests')
        .select('id,title,category,status,created_at,location')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data || []) as ReportSummary[];
    },
    enabled: !!user,
    staleTime: 30_000,
  });

  const stats = [
    { icon: ClipboardList, label: t.submitted, value: reports.filter((report) => report.status === 'pending').length, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-500/10" },
    { icon: ListChecks, label: t.underReview, value: reports.filter((report) => report.status === 'under_review').length, color: "text-primary", bg: "bg-primary/10" },
    { icon: Clock, label: t.inProgress, value: reports.filter((report) => ['assigned', 'in_progress'].includes(report.status)).length, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-500/10" },
    { icon: CheckCircle2, label: t.resolve, value: reports.filter((report) => report.status === 'completed').length, color: "text-success", bg: "bg-success/10" },
  ];

  return (
    <section className="px-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{t.myReportsTitle}</h2>
        {user && (
          <button type="button" onClick={() => navigate('/my-requests')} className="flex items-center gap-1 text-sm font-medium text-primary">
            {t.viewAll} <ChevronRight className="h-4 w-4" />
          </button>
        )}
      </div>
      <Card variant="elevated" className="overflow-hidden">
        <CardContent className="p-0">
          {!user ? (
            <div className="px-5 py-6 text-center">
              <p className="font-medium">{t.signInToTrack}</p>
              <button type="button" onClick={() => navigate('/auth')} className="mt-2 text-sm font-medium text-primary">{t.signIn}</button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 divide-x divide-y divide-border sm:grid-cols-4 sm:divide-y-0">
                {stats.map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="flex flex-col items-center gap-2 p-4">
                      <div className={`rounded-lg p-2 ${stat.bg}`}>
                        <Icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <span className="text-2xl font-bold">
                        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : error ? '—' : stat.value}
                      </span>
                      <span className="text-xs text-muted-foreground">{stat.label}</span>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-border px-4 py-4">
                <h3 className="mb-3 text-sm font-semibold">{t.recentReports}</h3>
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : error ? (
                  <div>
                    <p className="text-sm text-muted-foreground">Could not load your reports. Check your connection and try again.</p>
                    <button type="button" onClick={() => refetch()} className="mt-2 text-sm font-medium text-primary">Try Again</button>
                  </div>
                ) : reports.length === 0 ? (
                  <div className="py-2">
                    <p className="text-sm font-medium">{t.noReportsYet}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t.noReportsDesc}</p>
                    <button type="button" onClick={() => navigate('/report-issue')} className="mt-3 text-sm font-medium text-primary">{t.reportIssueBtn}</button>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {reports.slice(0, 3).map((report) => (
                      <div key={report.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{report.title || report.category}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {report.location || 'Location not provided'} · {new Date(report.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-xs font-medium capitalize text-muted-foreground">
                          {report.status.split('_').join(' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
};
