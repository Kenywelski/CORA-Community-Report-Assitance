import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  ClipboardList,
  Users,
  MapPin,
  MessageSquare,
  TrendingUp,
  Clock,
  CheckCircle,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PURISIMA_CENTER,
  PURISIMA_DEFAULT_ZOOM,
  VERIFIED_PURISIMA_BOUNDARY,
  verifyPointWithinBarangayBoundary,
} from '@/lib/purisimaGeo';
import {
  PurisimaBoundaryLayer,
  PurisimaMapController,
} from '@/features/maps/PurisimaBoundaryLayer';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';
import { isConfirmedTestReport } from '@/features/reports/testReports';
import {
  APPROVED_CONCERN_CATEGORIES,
  getApprovedCategoryLabel,
  resolveApprovedCategory,
} from '@/lib/reportAnalysis';
import { useAppPreferences } from '@/lib/preferences';

type ServiceRequest = Pick<
  Tables<'community_reports'>,
  | 'id'
  | 'title'
  | 'status'
  | 'created_at'
  | 'location'
  | 'latitude'
  | 'longitude'
  | 'ai_category'
  | 'category'
>;

const reportPinIcon = L.divIcon({
  className: 'cora-admin-report-marker',
  html: `
    <div style="position: relative; width: 28px; height: 34px; display: flex; align-items: flex-start; justify-content: center;">
      <svg width="28" height="34" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 3px 5px rgba(15, 38, 42, 0.28));">
        <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.25 16.125 42.625 16.8125 43.14C17.5156 43.665 18.4844 43.665 19.1875 43.14C19.875 42.625 36 30.25 36 18C36 8.05887 27.9411 0 18 0Z" fill="#F36B3F"/>
        <circle cx="18" cy="17" r="7" fill="#FFFFFF"/>
      </svg>
    </div>
  `,
  iconSize: [28, 34],
  iconAnchor: [14, 32],
  popupAnchor: [0, -28],
});

const chartConfig = {
  pending: { label: 'Pending', color: 'hsl(var(--warning))' },
  under_review: { label: 'Under Review', color: 'hsl(var(--accent))' },
  in_progress: { label: 'In Progress', color: 'hsl(var(--primary))' },
  completed: { label: 'Resolved', color: 'hsl(var(--success))' },
  requests: { label: 'Requests', color: 'hsl(var(--primary))' },
  users: { label: 'Users', color: 'hsl(var(--accent))' },
} satisfies ChartConfig;

const statusLabelMap: Record<string, string> = {
  pending: 'Pending',
  under_review: 'Under Review',
  assigned: 'In Progress',
  in_progress: 'In Progress',
  completed: 'Resolved',
  closed: 'Resolved',
};

const adminDashboardQueryKey = ['admin-dashboard-live-data'] as const;

const AdminDashboard = () => {
  const queryClient = useQueryClient();
  const { translate } = useAppPreferences();
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  const { data: dashboardData } = useQuery({
    queryKey: adminDashboardQueryKey,
    queryFn: async () => {
      const [requestsResult, usersResult, feedbackResult] = await Promise.all([
        supabase
          .from('community_reports')
          .select(
            'id, title, status, created_at, location, latitude, longitude, ai_category, category',
          )
          .neq('status', 'rejected')
          .order('created_at', { ascending: false }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('resident_feedback').select('id', { count: 'exact', head: true }),
      ]);

      if (requestsResult.error) throw requestsResult.error;
      if (usersResult.error) throw usersResult.error;
      if (feedbackResult.error) throw feedbackResult.error;

      return {
        requests: requestsResult.data.filter((request) => !isConfirmedTestReport(request)),
        usersCount: usersResult.count ?? 0,
        feedbackCount: feedbackResult.count ?? 0,
      };
    },
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  const requests = useMemo(
    () => dashboardData?.requests ?? [],
    [dashboardData?.requests],
  );

  useEffect(() => {
    const refreshDashboard = () => {
      void queryClient.invalidateQueries({ queryKey: adminDashboardQueryKey });
    };

    const channel = supabase
      .channel('admin-dashboard-live-data')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_reports' },
        refreshDashboard,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles' },
        refreshDashboard,
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'resident_feedback' },
        refreshDashboard,
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isMapFullscreen]);

  useEffect(() => {
    if (!isMapFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsMapFullscreen(false);
    };
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMapFullscreen]);

  const requestCounts = useMemo(() => {
    const counts = {
      pending: 0,
      underReview: 0,
      inProgress: 0,
      resolved: 0,
    };

    requests.forEach((request) => {
      if (request.status === 'pending') counts.pending += 1;
      else if (request.status === 'under_review') counts.underReview += 1;
      else if (request.status === 'in_progress' || request.status === 'assigned') {
        counts.inProgress += 1;
      } else if (request.status === 'completed' || request.status === 'closed') {
        counts.resolved += 1;
      }
    });

    return counts;
  }, [requests]);

  const stats = useMemo(() => ({
    totalRequests: requests.length,
    pendingRequests: requestCounts.pending + requestCounts.underReview,
    completedRequests: requestCounts.resolved,
    totalUsers: dashboardData?.usersCount ?? 0,
    totalFeedback: dashboardData?.feedbackCount ?? 0,
  }), [dashboardData?.feedbackCount, dashboardData?.usersCount, requestCounts, requests.length]);

  const pinnedReports = useMemo(
    () => requests.filter(
      (request) =>
        request.latitude != null &&
        request.longitude != null &&
        !Number.isNaN(Number(request.latitude)) &&
        !Number.isNaN(Number(request.longitude)) &&
        verifyPointWithinBarangayBoundary(
          { lat: Number(request.latitude), lng: Number(request.longitude) },
          VERIFIED_PURISIMA_BOUNDARY,
        ).isInside === true,
    ),
    [requests],
  );

  const statusData = useMemo(() => [
    { name: translate('Pending'), value: requestCounts.pending, fill: '#f59e0b' },
    { name: translate('Under Review'), value: requestCounts.underReview, fill: '#3b82f6' },
    { name: translate('In Progress'), value: requestCounts.inProgress, fill: '#14b8a6' },
    { name: translate('Resolved'), value: requestCounts.resolved, fill: '#21b77a' },
  ], [requestCounts, translate]);

  const weeklyData = useMemo(
    () => Array.from({ length: 7 }, (_, index) => {
      const date = startOfDay(subDays(new Date(), 6 - index));
      const count = requests.filter((request) => {
        const requestDate = startOfDay(new Date(request.created_at));
        return requestDate.getTime() === date.getTime();
      }).length;

      return {
        date: format(date, 'EEE'),
        requests: count,
      };
    }),
    [requests],
  );
  const weeklyRequestDomainMax =
    Math.max(0, ...weeklyData.map((item) => item.requests)) + 1;

  const categoryData = useMemo(() => {
    const classCounts = Object.fromEntries(
      APPROVED_CONCERN_CATEGORIES.map((category) => [category.key, 0]),
    ) as Record<(typeof APPROVED_CONCERN_CATEGORIES)[number]['key'], number>;

    requests.forEach((request) => {
      const category =
        resolveApprovedCategory(request.ai_category) ||
        resolveApprovedCategory(request.category) ||
        resolveApprovedCategory(request.title);
      if (category) classCounts[category.key] += 1;
    });

    return APPROVED_CONCERN_CATEGORIES.map((category) => ({
      category: category.label,
      count: classCounts[category.key],
    }));
  }, [requests]);

  const statCards = [
    {
      icon: ClipboardList,
      label: translate('Total Reports'),
      value: stats.totalRequests,
      color: 'text-[#108b7c] dark:text-[#47d8ca]',
      background: 'bg-[#e8f6f3] dark:bg-[#17413f]',
    },
    {
      icon: Clock,
      label: translate('Pending'),
      value: stats.pendingRequests,
      color: 'text-[#e99b09] dark:text-[#ffc34f]',
      background: 'bg-[#fff6df] dark:bg-[#493819]',
    },
    {
      icon: CheckCircle,
      label: translate('Resolved'),
      value: stats.completedRequests,
      color: 'text-[#16a56c] dark:text-[#4ce09a]',
      background: 'bg-[#e8f8f0] dark:bg-[#183e2f]',
    },
    {
      icon: Users,
      label: translate('Users'),
      value: stats.totalUsers,
      color: 'text-[#f27443] dark:text-[#ff936d]',
      background: 'bg-[#fff0e9] dark:bg-[#4a3026]',
    },
    {
      icon: MessageSquare,
      label: translate('Feedback'),
      value: stats.totalFeedback,
      color: 'text-muted-foreground dark:text-[#85c7d2]',
      background: 'bg-[#edf2f5] dark:bg-[#29434d]',
    },
  ];

  const reportStatusTotal = statusData.reduce(
    (total, status) => total + status.value,
    0
  );

  const categoryAxisMax = Math.max(
    4,
    ...categoryData.map((item) => item.count),
  );

  return (
    <AdminLayout title="Dashboard" subtitle="Overview of system statistics">
      {/* Stats Grid */}
      <div className="mb-6 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-5">
        {statCards.map((stat, index) => (
          <Card
            key={stat.label}
            className={cn(
              'h-[81px] rounded-2xl border-[#dfe8eb] bg-card shadow-[0_7px_16px_rgba(31,66,75,0.10)] dark:border-border',
              index === 4 && 'col-span-2 md:col-span-2 lg:col-span-1',
            )}
          >
            <CardContent className="flex h-full items-center p-3">
              <div className="flex items-center gap-3">
                <div className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-[14px]', stat.background, stat.color)}>
                  <stat.icon className="h-5 w-5" strokeWidth={2.2} />
                </div>
                <div className="min-w-0">
                  <p className="text-[1.55rem] font-extrabold leading-none tracking-tight">{stat.value}</p>
                  <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barangay Purisima Interactive Map */}
      <div className="mb-5 grid grid-cols-1 gap-4 min-[1120px]:grid-cols-[1.07fr_1fr]">
      <Card
        data-testid="admin-dashboard-purisima-map"
        className={cn(
          'overflow-hidden rounded-2xl border-[#dce7e9] bg-card shadow-[0_8px_20px_rgba(31,66,75,0.10)] dark:border-border',
          isMapFullscreen &&
            'fixed inset-0 z-[60] m-0 flex h-[100dvh] w-screen max-w-none flex-col rounded-none border-0 bg-card shadow-none'
        )}
      >
        <CardHeader
          className={cn(
            'h-[68px] justify-center px-4 py-0 sm:px-5',
            isMapFullscreen &&
              'absolute right-3 top-3 z-[1000] h-auto rounded-xl border border-border bg-card/90 p-3 shadow-lg backdrop-blur',
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base font-extrabold">
                  Barangay Purisima
                </CardTitle>
                <p className="text-xs font-medium text-muted-foreground">
                  Tago, Surigao del Sur
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-lg border-primary text-primary hover:bg-primary/10 hover:text-primary"
                onClick={() => setIsMapFullscreen((prev) => !prev)}
                title={translate(isMapFullscreen ? 'Exit fullscreen' : 'View fullscreen')}
                aria-label={translate(isMapFullscreen ? 'Exit fullscreen map' : 'View map fullscreen')}
              >
                {isMapFullscreen ? (
                  <Minimize2 className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5 text-primary" />
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            'p-0',
            isMapFullscreen && 'relative flex min-h-0 flex-1 flex-col'
          )}
        >
          <div
            className={cn(
              'relative w-full bg-muted/20',
              isMapFullscreen ? 'min-h-0 flex-1' : 'h-[300px] sm:h-[314px]'
            )}
          >
            <MapContainer
              center={PURISIMA_CENTER}
              zoom={PURISIMA_DEFAULT_ZOOM}
              scrollWheelZoom
              maxBoundsViscosity={1}
              style={{ height: '100%', width: '100%' }}
              className="z-0"
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              <PurisimaBoundaryLayer />
              <PurisimaMapController fitPadding={[24, 24]} />

              {/* Resident Report GPS Pins */}
              {pinnedReports.map((rep) => (
                <Marker
                  key={rep.id}
                  position={[Number(rep.latitude), Number(rep.longitude)]}
                  icon={reportPinIcon}
                >
                  <Popup>
                    <div className="max-w-[220px] space-y-1 p-0.5 text-left">
                      <p className="text-xs font-bold text-foreground">
                        {rep.title}
                      </p>
                      <p className="text-[11px] font-medium text-primary">
                        {getApprovedCategoryLabel(rep.category)} ·{' '}
                        {statusLabelMap[rep.status] || rep.status}
                      </p>
                      {rep.location && (
                        <p className="text-[11px] text-muted-foreground">
                          📍 {rep.location}
                        </p>
                      )}
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>

          <div className={cn(
            'flex min-h-[46px] flex-wrap items-center gap-5 border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-foreground',
            isMapFullscreen &&
              'absolute bottom-3 left-3 z-[1000] min-h-0 rounded-xl border border-border bg-card/90 py-3 shadow-lg backdrop-blur',
          )}>
            <span className="inline-flex items-center gap-2 font-medium">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#f27443]" />
              {translate('Report GPS Pin')} ({pinnedReports.length})
            </span>
          </div>
        </CardContent>
      </Card>

      <Card className="flex flex-col rounded-2xl border-[#dce7e9] bg-card shadow-[0_8px_20px_rgba(31,66,75,0.10)] dark:border-border">
        <CardHeader className="h-[68px] justify-center px-5 py-0">
          <CardTitle className="flex items-center gap-3 text-lg font-extrabold">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-foreground">
              <ClipboardList className="h-5 w-5" />
            </span>
            {translate('Report Status')}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 items-center px-5 pb-6 pt-2">
          <div className="grid w-full items-center gap-5 min-[1120px]:grid-cols-[1.08fr_0.92fr]">
            <div className="relative mx-auto h-[250px] w-full max-w-[230px]">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                    position={{ x: 66, y: 0 }}
                  />
                  <Pie
                    data={statusData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={86}
                    startAngle={90}
                    endAngle={-270}
                    stroke="transparent"
                  >
                    {statusData.map((entry) => (
                      <Cell key={entry.name} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-4xl font-extrabold leading-none text-foreground">
                  {reportStatusTotal}
                </span>
                <span className="mt-1 text-xs font-medium text-muted-foreground">
                  {translate('Total Reports')}
                </span>
              </div>
            </div>

            <div className="space-y-1">
              {statusData.map((item) => (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-4 border-b border-border/80 py-3 last:border-0"
                >
                  <span className="flex items-center gap-2.5 text-sm font-semibold">
                    <span
                      className="h-3.5 w-3.5 rounded-full"
                      style={{ backgroundColor: item.fill }}
                    />
                    {item.name}
                  </span>
                  <Badge variant="secondary" className="min-w-8 justify-center rounded-full">
                    {item.value}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      </div>

      {/* Weekly Requests */}
      <div className="mb-[22px]">
        {/* Weekly Requests Line Chart */}
        <Card className="h-[238px] rounded-2xl border-[#dce7e9] bg-card shadow-[0_8px_20px_rgba(31,66,75,0.10)] dark:border-border">
          <CardHeader className="h-[52px] justify-center px-5 py-0">
            <CardTitle className="flex items-center gap-3 text-lg font-extrabold">
              <TrendingUp className="h-5 w-5 text-foreground" />
              {translate('Weekly Requests')}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 sm:px-6">
            <ChartContainer config={chartConfig} className="h-[174px] w-full">
              <LineChart data={weeklyData} margin={{ top: 4, right: 12, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis
                  allowDecimals={false}
                  domain={[0, weeklyRequestDomainMax]}
                  tickLine={false}
                  axisLine={false}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2.5}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card className="rounded-2xl border-[#dce7e9] bg-card shadow-[0_8px_20px_rgba(31,66,75,0.10)] dark:border-border lg:h-[358px]">
        <CardHeader className="h-[56px] justify-center px-5 py-0">
          <CardTitle className="flex items-center gap-3 text-lg font-extrabold">
            <ClipboardList className="h-5 w-5 text-foreground" />
            {translate('Report Categories (the four supported concern classes)')}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 pb-5">
          <div className="mb-3.5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {categoryData.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between rounded-xl border border-[#d7e3e6] bg-muted/20 px-3.5 py-2.5 dark:border-border"
              >
                <span className="text-xs font-semibold text-foreground">
                  {item.category}
                </span>
                <Badge variant="secondary" className="rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {item.count}
                </Badge>
              </div>
            ))}
          </div>
          <ChartContainer config={chartConfig} className="h-[220px]">
            <BarChart data={categoryData} layout="vertical">
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                domain={[0, categoryAxisMax]}
                ticks={categoryAxisMax === 4 ? [0, 1, 2, 3, 4] : undefined}
              />
              <YAxis
                type="category"
                dataKey="category"
                tickLine={false}
                axisLine={false}
                width={140}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar
                dataKey="count"
                fill="hsl(var(--primary))"
                radius={[0, 4, 4, 0]}
                barSize={36}
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminDashboard;
