import { useState, useEffect, useRef } from 'react';
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
  LocateFixed,
  Plus,
  Minus,
  ExternalLink,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import { AdminLayout } from '@/components/admin/AdminLayout';
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
} from 'recharts';
import { format, subDays, startOfDay } from 'date-fns';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  PURISIMA_CENTER,
  PURISIMA_COORDINATES,
  PURISIMA_DEFAULT_ZOOM,
  PURISIMA_INFO,
  getOpenStreetMapLargerUrl,
} from '@/lib/purisimaGeo';
import { cn } from '@/lib/utils';
import type { Tables } from '@/integrations/supabase/types';

type ServiceRequest = Tables<'service_requests'>;

const purisimaMainPinIcon = L.divIcon({
  className: 'cora-admin-purisima-marker',
  html: `
    <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: flex-start; justify-content: center;">
      <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 4px 6px rgba(15, 38, 42, 0.32));">
        <path d="M18 0C8.05887 0 0 8.05887 0 18C0 30.25 16.125 42.625 16.8125 43.14C17.5156 43.665 18.4844 43.665 19.1875 43.14C19.875 42.625 36 30.25 36 18C36 8.05887 27.9411 0 18 0Z" fill="hsl(174, 62%, 28%)"/>
        <circle cx="18" cy="17" r="7.5" fill="#FFFFFF"/>
        <circle cx="18" cy="17" r="3.5" fill="hsl(16, 85%, 58%)"/>
      </svg>
    </div>
  `,
  iconSize: [36, 44],
  iconAnchor: [18, 42],
  popupAnchor: [0, -38],
});

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
  pending: { label: 'Submitted', color: 'hsl(var(--warning))' },
  under_review: { label: 'Under Review', color: 'hsl(var(--accent))' },
  in_progress: { label: 'In Progress', color: 'hsl(var(--primary))' },
  completed: { label: 'Resolved', color: 'hsl(var(--success))' },
  rejected: { label: 'Rejected', color: 'hsl(var(--destructive))' },
  requests: { label: 'Requests', color: 'hsl(var(--primary))' },
  users: { label: 'Users', color: 'hsl(var(--accent))' },
} satisfies ChartConfig;

const statusLabelMap: Record<string, string> = {
  pending: 'Submitted',
  under_review: 'Under Review',
  assigned: 'In Progress',
  in_progress: 'In Progress',
  completed: 'Resolved',
  rejected: 'Rejected',
};

const AdminDashboard = () => {
  const [stats, setStats] = useState({
    totalRequests: 0,
    pendingRequests: 0,
    completedRequests: 0,
    totalUsers: 0,
    totalSpots: 0,
    totalFeedback: 0,
  });
  const [pinnedReports, setPinnedReports] = useState<ServiceRequest[]>([]);
  const [statusData, setStatusData] = useState<
    { name: string; value: number; fill: string }[]
  >([]);
  const [weeklyData, setWeeklyData] = useState<
    { date: string; requests: number }[]
  >([]);
  const [categoryData, setCategoryData] = useState<
    { category: string; count: number }[]
  >([
    { category: 'Garbage Problem', count: 0 },
    { category: 'Waste Problem', count: 0 },
    { category: 'Street Light', count: 0 },
    { category: 'Road Problem', count: 0 },
  ]);
  const [isMapFullscreen, setIsMapFullscreen] = useState(false);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      mapRef.current?.invalidateSize();
    }, 150);
    return () => window.clearTimeout(timer);
  }, [isMapFullscreen]);

  const fetchDashboardData = async () => {
    // Fetch requests
    const { data: requests } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    // Fetch users count
    const { count: usersCount } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    // Fetch feedback count
    const { count: feedbackCount } = await supabase
      .from('feedback')
      .select('*', { count: 'exact', head: true });

    if (requests) {
      const pending = requests.filter((r) => r.status === 'pending').length;
      const underReview = requests.filter(
        (r) => r.status === 'under_review'
      ).length;
      const inProgress = requests.filter(
        (r) => r.status === 'in_progress' || r.status === 'assigned'
      ).length;
      const completed = requests.filter((r) => r.status === 'completed').length;
      const rejected = requests.filter((r) => r.status === 'rejected').length;

      setStats({
        totalRequests: requests.length,
        pendingRequests: pending + underReview,
        completedRequests: completed,
        totalUsers: usersCount || 0,
        totalSpots: 0,
        totalFeedback: feedbackCount || 0,
      });

      setPinnedReports(
        requests.filter(
          (r) =>
            r.latitude != null &&
            r.longitude != null &&
            !Number.isNaN(Number(r.latitude)) &&
            !Number.isNaN(Number(r.longitude))
        )
      );

      // Status pie chart data
      setStatusData(
        [
          { name: 'Submitted', value: pending, fill: 'hsl(var(--warning))' },
          {
            name: 'Under Review',
            value: underReview,
            fill: 'hsl(var(--accent))',
          },
          {
            name: 'In Progress',
            value: inProgress,
            fill: 'hsl(var(--primary))',
          },
          {
            name: 'Resolved',
            value: completed,
            fill: 'hsl(var(--success))',
          },
          {
            name: 'Rejected',
            value: rejected,
            fill: 'hsl(var(--destructive))',
          },
        ].filter((d) => d.value > 0)
      );

      // Weekly data for line chart
      const last7Days = Array.from({ length: 7 }, (_, i) => {
        const date = startOfDay(subDays(new Date(), 6 - i));
        const count = requests.filter((r) => {
          const reqDate = startOfDay(new Date(r.created_at));
          return reqDate.getTime() === date.getTime();
        }).length;
        return {
          date: format(date, 'EEE'),
          requests: count,
        };
      });
      setWeeklyData(last7Days);

      // Category breakdown — strictly only the 4 classes: Garbage Problem, Waste Problem, Street Light, Road Problem
      const classCounts: Record<string, number> = {
        'Garbage Problem': 0,
        'Waste Problem': 0,
        'Street Light': 0,
        'Road Problem': 0,
      };

      requests.forEach((r) => {
        const text = `${r.category || ''} ${r.ai_category || ''} ${r.title || ''}`.toLowerCase();
        if (
          text.includes('street light') ||
          text.includes('streetlight') ||
          text.includes('lighting')
        ) {
          classCounts['Street Light'] += 1;
        } else if (
          text.includes('road') ||
          text.includes('pothole') ||
          text.includes('pavement')
        ) {
          classCounts['Road Problem'] += 1;
        } else if (
          text.includes('garbage') ||
          text.includes('litter') ||
          text.includes('trash')
        ) {
          classCounts['Garbage Problem'] += 1;
        } else if (
          text.includes('waste') ||
          text.includes('drainage') ||
          text.includes('flooding') ||
          text.includes('canal')
        ) {
          classCounts['Waste Problem'] += 1;
        }
      });

      setCategoryData([
        { category: 'Garbage Problem', count: classCounts['Garbage Problem'] },
        { category: 'Waste Problem', count: classCounts['Waste Problem'] },
        { category: 'Street Light', count: classCounts['Street Light'] },
        { category: 'Road Problem', count: classCounts['Road Problem'] },
      ]);
    }
  };

  const handleResetMapCenter = () => {
    mapRef.current?.setView(PURISIMA_CENTER, PURISIMA_DEFAULT_ZOOM, {
      animate: true,
    });
  };

  const statCards = [
    {
      icon: ClipboardList,
      label: 'Total Reports',
      value: stats.totalRequests,
      color: 'text-primary',
    },
    {
      icon: Clock,
      label: 'Pending / Review',
      value: stats.pendingRequests,
      color: 'text-warning',
    },
    {
      icon: CheckCircle,
      label: 'Resolved',
      value: stats.completedRequests,
      color: 'text-success',
    },
    {
      icon: Users,
      label: 'Users',
      value: stats.totalUsers,
      color: 'text-accent',
    },
    {
      icon: MessageSquare,
      label: 'Feedback',
      value: stats.totalFeedback,
      color: 'text-muted-foreground',
    },
  ];

  return (
    <AdminLayout title="Dashboard" subtitle="Overview of system statistics">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label} variant="elevated">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${stat.color}`}>
                  <stat.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Barangay Purisima Interactive Map */}
      <Card
        variant="elevated"
        data-testid="admin-dashboard-purisima-map"
        className={cn(
          'mb-6 overflow-hidden border-border',
          isMapFullscreen &&
            'fixed inset-3 z-50 m-0 flex flex-col rounded-2xl border-2 border-primary/40 bg-card shadow-2xl sm:inset-6'
        )}
      >
        <CardHeader className="border-b border-border bg-muted/30 px-4 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  <span>Map of Barangay Purisima</span>
                  <Badge variant="secondary" className="text-[11px] font-medium">
                    Tago, Surigao del Sur · PSGC {PURISIMA_INFO.psgcCode}
                  </Badge>
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  Coordinates: {PURISIMA_COORDINATES.lat.toFixed(5)}° N,{' '}
                  {PURISIMA_COORDINATES.lng.toFixed(5)}° E ·{' '}
                  {pinnedReports.length} GPS-pinned resident{' '}
                  {pinnedReports.length === 1 ? 'report' : 'reports'}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => mapRef.current?.zoomIn()}
                title="Zoom in"
                aria-label="Zoom in map"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => mapRef.current?.zoomOut()}
                title="Zoom out"
                aria-label="Zoom out map"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={handleResetMapCenter}
              >
                <LocateFixed className="h-3.5 w-3.5 text-primary" />
                <span>Center Brgy. Purisima</span>
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setIsMapFullscreen((prev) => !prev)}
              >
                {isMapFullscreen ? (
                  <>
                    <Minimize2 className="h-3.5 w-3.5 text-primary" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3.5 w-3.5 text-primary" />
                    <span className="hidden sm:inline">Fullscreen</span>
                  </>
                )}
              </Button>
              <a
                href={getOpenStreetMapLargerUrl(16)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-primary transition-colors hover:bg-muted"
              >
                <span className="hidden sm:inline">OpenStreetMap</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </CardHeader>

        <CardContent
          className={cn(
            'p-0',
            isMapFullscreen && 'flex min-h-0 flex-1 flex-col'
          )}
        >
          <div
            className={cn(
              'relative w-full bg-muted/20',
              isMapFullscreen ? 'min-h-[380px] flex-1' : 'h-[380px] sm:h-[430px]'
            )}
          >
            <MapContainer
              center={PURISIMA_CENTER}
              zoom={PURISIMA_DEFAULT_ZOOM}
              scrollWheelZoom
              style={{ height: '100%', width: '100%' }}
              className="z-0"
              ref={mapRef}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {/* Official Barangay Purisima Center Marker */}
              <Marker position={PURISIMA_CENTER} icon={purisimaMainPinIcon}>
                <Popup>
                  <div className="space-y-1 p-0.5 text-left">
                    <p className="text-xs font-bold text-foreground">
                      {PURISIMA_INFO.barangay}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {PURISIMA_INFO.municipality}, {PURISIMA_INFO.province} (
                      {PURISIMA_INFO.postalCode})
                    </p>
                    <p className="font-mono text-[10px] text-muted-foreground">
                      {PURISIMA_COORDINATES.lat.toFixed(5)}° N,{' '}
                      {PURISIMA_COORDINATES.lng.toFixed(5)}° E
                    </p>
                  </div>
                </Popup>
              </Marker>

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
                        {rep.category} ·{' '}
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

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/20 px-4 py-2.5 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-primary" />
                Barangay Purisima Center ({PURISIMA_INFO.municipality},{' '}
                {PURISIMA_INFO.province})
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-[#F36B3F]" />
                Resident Report GPS Pin ({pinnedReports.length})
              </span>
            </div>
            <span className="text-[11px]">
              {PURISIMA_INFO.region} · Postal Code {PURISIMA_INFO.postalCode}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Weekly Requests Line Chart */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="h-5 w-5" />
              Weekly Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <LineChart data={weeklyData}>
                <XAxis dataKey="date" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="requests"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Status Pie Chart */}
        <Card variant="elevated">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-5 w-5" />
              Request Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px]">
              <PieChart>
                <ChartTooltip content={<ChartTooltipContent />} />
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, value }) => `${name}: ${value}`}
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card variant="elevated">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ClipboardList className="h-5 w-5" />
            Report Categories (Garbage Problem, Waste Problem, Street Light, Road Problem)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {categoryData.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between rounded-xl border border-border bg-muted/30 px-3.5 py-2.5"
              >
                <span className="text-xs font-semibold text-foreground">
                  {item.category}
                </span>
                <Badge variant="secondary" className="text-xs font-bold">
                  {item.count}
                </Badge>
              </div>
            ))}
          </div>
          <ChartContainer config={chartConfig} className="h-[260px]">
            <BarChart data={categoryData} layout="vertical">
              <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
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
              />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>
    </AdminLayout>
  );
};

export default AdminDashboard;
