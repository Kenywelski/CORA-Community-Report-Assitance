import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ReportDetailDialog, statusMeta, type PublicReport } from '@/features/residents/components/ReportDetailDialog';
import { PerformanceDashboard } from '@/features/residents/components/PerformanceDashboard';
import { ActivityFeed } from '@/features/residents/components/ActivityFeed';
import { ArrowLeft, Clock, Megaphone, AlertCircle, MapPin, Plus, X, Search, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { format, formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { reportQueryKeys } from '@/features/reports/api/reportQueryKeys';
import { isConfirmedTestReport } from '@/features/reports/testReports';
import { getApprovedCategoryLabel } from '@/lib/reportAnalysis';

type FilterTab = 'all' | 'reports' | 'announcements';

const CommunityWall = () => {
  const navigate = useNavigate();
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedReport, setSelectedReport] = useState<PublicReport | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  // Public reports from community_reports
  const { data: reports = [], isLoading } = useQuery({
    queryKey: reportQueryKeys.publicFeed(),
    queryFn: async (): Promise<PublicReport[]> => {
      const { data, error } = await supabase
        .from('public_report_feed')
        .select('*')
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return ((data || []) as PublicReport[]).filter(
        (report) => !isConfirmedTestReport(report),
      );
    },
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ['wall-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .eq('is_active', true)
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!selectedReport) return;
    const latestReport = reports.find((report) => report.id === selectedReport.id);
    if (!latestReport) {
      setSelectedReport(null);
      setDetailOpen(false);
    } else if (latestReport !== selectedReport) {
      setSelectedReport(latestReport);
    }
  }, [reports, selectedReport]);

  const q = searchQuery.toLowerCase().trim();
  const filteredReports = reports.filter((r) => {
    if (!q) return true;
    return (
      r.title.toLowerCase().includes(q) ||
      r.description.toLowerCase().includes(q) ||
      r.category.toLowerCase().includes(q) ||
      (r.location?.toLowerCase().includes(q) ?? false)
    );
  });

  const filteredAnnouncements = announcements.filter((a) => {
    if (!q) return true;
    return a.title.toLowerCase().includes(q) || a.content.toLowerCase().includes(q);
  });

  const openReport = (r: PublicReport) => {
    setSelectedReport(r);
    setDetailOpen(true);
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border lg:top-14">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="lg:hidden">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-lg font-bold">Community Reports</h1>
                <p className="text-xs text-muted-foreground">Reports shared by community members</p>
              </div>
            </div>
            <Button size="sm" className="gap-1" onClick={() => navigate('/report-issue')}>
              <Plus className="h-4 w-4" />
              Report
            </Button>
          </div>
        </header>

        <div className="p-4 space-y-3">
          {/* Performance dashboard */}
          <PerformanceDashboard reports={reports} />

          {/* Search + tabs */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search reports & announcements..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9"
              />
              {searchQuery && (
                <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7" onClick={() => setSearchQuery('')}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <Tabs value={activeFilter} onValueChange={(v) => setActiveFilter(v as FilterTab)}>
              <TabsList className="grid grid-cols-3 sm:w-auto w-full">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="reports" className="gap-1"><AlertCircle className="h-3.5 w-3.5" />Reports</TabsTrigger>
                <TabsTrigger value="announcements" className="gap-1"><Megaphone className="h-3.5 w-3.5" />News</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="grid lg:grid-cols-3 gap-3">
            {/* Feed */}
            <main className="lg:col-span-2 space-y-3">
              {activeFilter !== 'reports' && filteredAnnouncements.length > 0 && (
                <div className="space-y-3">
                  {filteredAnnouncements.slice(0, activeFilter === 'announcements' ? 50 : 3).map((a) => (
                    <Card key={a.id} className="cursor-pointer hover:shadow-md border-primary/30 bg-primary/5" onClick={() => navigate('/updates')}>
                      {a.image_url && <img src={a.image_url} alt={a.title} className="w-full h-32 object-cover rounded-t-xl" />}
                      <CardHeader className="pb-2">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-xl bg-primary/20 shrink-0">
                            <Megaphone className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm line-clamp-1">{a.title}</h3>
                            <span className="text-xs text-muted-foreground">{format(new Date(a.published_at), 'MMM d, yyyy')}</span>
                          </div>
                          <Badge variant="secondary" className="text-[10px]">Announcement</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <p className="text-sm text-muted-foreground line-clamp-2">{a.excerpt || a.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {activeFilter !== 'announcements' && (
                <>
                  {isLoading ? (
                    <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Loading reports…</CardContent></Card>
                  ) : filteredReports.length === 0 ? (
                    <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
                      No reports yet. Be the first to report an issue.
                    </CardContent></Card>
                  ) : (
                    filteredReports.map((r) => {
                      const meta = statusMeta[r.status] || statusMeta.pending;
                      const reporterName = r.reporter_name || (r.user_id ? 'Resident' : 'Anonymous');
                      const cleanTitle = r.title.replace(/^\[REPORT\]\s*/, '');
                      const cleanCategory = getApprovedCategoryLabel(r.category);
                      return (
                        <Card
                          key={r.id}
                          variant="elevated"
                          className="cursor-pointer hover:shadow-md transition-shadow animate-slide-up"
                          onClick={() => openReport(r)}
                        >
                          {r.photo_url && (
                            <img src={r.photo_url} alt="" className="w-full h-40 object-cover rounded-t-xl" />
                          )}
                          <CardContent className="p-4 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-sm leading-tight line-clamp-2">{cleanTitle}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-[10px]">{cleanCategory}</Badge>
                                  {r.assigned_department && (
                                    <Badge variant="outline" className="text-[10px]">{r.assigned_department}</Badge>
                                  )}
                                </div>
                              </div>
                              <Badge variant="outline" className={cn('shrink-0 text-[10px]', meta.cls)}>{meta.label}</Badge>
                            </div>

                            <p className="text-sm text-muted-foreground line-clamp-2">{r.description}</p>

                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground pt-1">
                              <span className="flex items-center gap-1"><User className="h-3 w-3" />{reporterName}</span>
                              {r.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location}</span>}
                              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(r.created_at), { addSuffix: true })}</span>
                              {r.response_at && (
                                <span className="text-amber-600 dark:text-amber-400">Responded in {fmtDur(new Date(r.response_at).getTime() - new Date(r.created_at).getTime())}</span>
                              )}
                              {r.resolved_at && (
                                <span className="text-green-600 dark:text-green-400">Resolved in {fmtDur(new Date(r.resolved_at).getTime() - new Date(r.created_at).getTime())}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })
                  )}
                </>
              )}
            </main>

            {/* Side: activity feed */}
            <aside className="lg:col-span-1">
              <div className="lg:sticky lg:top-32">
                <ActivityFeed reports={reports} />
              </div>
            </aside>
          </div>
        </div>
      </div>

      <ReportDetailDialog report={selectedReport} open={detailOpen} onOpenChange={setDetailOpen} />
      <BottomNav currentPath="/community" />
    </div>
  );
};

function fmtDur(ms: number): string {
  const m = Math.floor(ms / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

export default CommunityWall;
