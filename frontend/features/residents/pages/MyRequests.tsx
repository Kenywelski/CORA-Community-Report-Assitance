import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import {
  AlertCircle,
  Archive,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  type LucideIcon,
} from 'lucide-react';
import { AuthGuard } from '@/features/residents/components/AuthGuard';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ReportDetailDialog, type PublicReport } from '@/features/residents/components/ReportDetailDialog';
import { useAuth } from '@/features/auth/useAuth';
import { reportQueryKeys } from '@/features/reports/api/reportQueryKeys';
import { isConfirmedTestReport } from '@/features/reports/testReports';
import { supabase } from '@/integrations/supabase/client';
import { getApprovedCategoryLabel } from '@/lib/reportAnalysis';
import { useAppPreferences } from '@/lib/preferences';

type Status = 'pending' | 'under_review' | 'assigned' | 'in_progress' | 'completed' | 'closed';
type Filter = 'all' | 'pending' | 'under_review' | 'in_progress' | 'completed';

interface TrackedReport extends Omit<PublicReport, 'status'> {
  status: Status;
  updated_at: string;
  action_taken: string | null;
}

interface Palette {
  page: string;
  card: string;
  border: string;
  text: string;
  muted: string;
  primary: string;
  primaryText: string;
  subtle: string;
  thumbnail: string;
  shadow: string;
  rowHover: string;
  rowHoverBorder: string;
  errorText: string;
  errorBackground: string;
  errorBorder: string;
}

interface StatusDetails {
  icon: LucideIcon;
  label: string;
  light: { color: string; background: string };
  dark: { color: string; background: string };
}

const PALETTES: Record<'light' | 'dark', Palette> = {
  light: {
    page: 'radial-gradient(circle at top, #fbfdff 0%, #f7faff 46%, #f2f7fb 100%)',
    card: '#ffffff',
    border: '#dbe5ee',
    text: '#07172e',
    muted: '#52677f',
    primary: '#16877e',
    primaryText: '#ffffff',
    subtle: '#e8eef3',
    thumbnail: '#eef3f7',
    shadow: '0 2px 8px rgba(44, 68, 98, 0.08)',
    rowHover: '#f3f8f8',
    rowHoverBorder: '#b8d8d5',
    errorText: '#b91c1c',
    errorBackground: '#fef2f2',
    errorBorder: '#fecaca',
  },
  dark: {
    page: 'hsl(var(--background))',
    card: 'hsl(var(--card))',
    border: '#273e49',
    text: '#f1f7f7',
    muted: '#9cb0b5',
    primary: '#29b9a7',
    primaryText: '#061b18',
    subtle: '#223338',
    thumbnail: '#223338',
    shadow: '0 4px 14px rgba(0, 8, 10, 0.28)',
    rowHover: 'hsl(var(--primary) / 0.025)',
    rowHoverBorder: 'hsl(var(--primary) / 0.25)',
    errorText: '#fca5a5',
    errorBackground: 'rgba(127, 29, 29, 0.22)',
    errorBorder: 'rgba(248, 113, 113, 0.35)',
  },
};

const STATUS_DETAILS: Record<Status, StatusDetails> = {
  pending: {
    icon: FileText,
    label: 'Submitted',
    light: { color: '#089b8c', background: '#d9f7f2' },
    dark: { color: '#5eead4', background: 'rgba(20, 184, 166, 0.14)' },
  },
  under_review: {
    icon: Clock3,
    label: 'Under Review',
    light: { color: '#f06413', background: '#fff0e8' },
    dark: { color: '#fdba74', background: 'rgba(249, 115, 22, 0.14)' },
  },
  assigned: {
    icon: RefreshCw,
    label: 'In Progress',
    light: { color: '#0965dc', background: '#e6f0ff' },
    dark: { color: '#93c5fd', background: 'rgba(59, 130, 246, 0.14)' },
  },
  in_progress: {
    icon: RefreshCw,
    label: 'In Progress',
    light: { color: '#0965dc', background: '#e6f0ff' },
    dark: { color: '#93c5fd', background: 'rgba(59, 130, 246, 0.14)' },
  },
  completed: {
    icon: CheckCircle2,
    label: 'Resolved',
    light: { color: '#069653', background: '#ddf7e9' },
    dark: { color: '#86efac', background: 'rgba(34, 197, 94, 0.14)' },
  },
  closed: {
    icon: Archive,
    label: 'Closed',
    light: { color: '#475569', background: '#f1f5f9' },
    dark: { color: '#cbd5e1', background: 'rgba(148, 163, 184, 0.14)' },
  },
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Submitted' },
  { key: 'under_review', label: 'Under Review' },
  { key: 'in_progress', label: 'In Progress' },
  { key: 'completed', label: 'Resolved' },
];

const useViewportWidth = () => {
  const [width, setWidth] = useState(() => (typeof window === 'undefined' ? 1280 : window.innerWidth));

  useEffect(() => {
    const updateWidth = () => setWidth(window.innerWidth);
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return width;
};

const createStyles = (
  palette: Palette,
  theme: 'light' | 'dark',
  width: number,
  searchFocused: boolean,
): Record<string, CSSProperties> => {
  const mobile = width < 768;
  const desktop = width >= 1024;
  const wide = width >= 1280;
  const compact = width <= 430;

  return {
    page: { minHeight: '100vh', color: palette.text, background: palette.page },
    shell: {
      width: '100%',
      maxWidth: wide ? '72rem' : desktop ? '64rem' : mobile ? '28rem' : '42rem',
      margin: '0 auto',
      padding: desktop ? '56px 16px 40px' : '20px 16px 96px',
    },
    back: {
      display: mobile ? 'flex' : 'none',
      alignItems: 'center',
      gap: 7,
      marginBottom: 18,
      padding: 0,
      border: 0,
      color: palette.muted,
      background: 'transparent',
      fontSize: 13,
      fontWeight: 700,
      cursor: 'pointer',
    },
    heading: { display: 'flex', alignItems: 'stretch', gap: 12 },
    headingAccent: {
      width: 6,
      minHeight: 52,
      flex: '0 0 6px',
      borderRadius: 999,
      background: palette.primary,
    },
    headingTitle: {
      margin: 0,
      color: palette.text,
      fontSize: compact ? 28 : 30,
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: '-0.035em',
    },
    headingText: { margin: '5px 0 0', color: palette.muted, fontSize: 14, fontWeight: 500, lineHeight: 1.35 },
    summaryGrid: {
      display: 'grid',
      gridTemplateColumns: desktop ? 'repeat(4, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
      gap: desktop ? 16 : compact ? 10 : 12,
      marginTop: 24,
    },
    summaryCard: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      height: 84,
      minWidth: 0,
      overflow: 'hidden',
      padding: compact ? 10 : 12,
      border: `1px solid ${palette.border}`,
      borderRadius: 16,
      background: palette.card,
      boxShadow: palette.shadow,
    },
    summaryContent: { position: 'relative', zIndex: 1, minWidth: 0, marginLeft: compact ? 9 : 12 },
    summaryLabel: {
      margin: 0,
      overflow: 'hidden',
      color: palette.muted,
      fontSize: compact ? 11 : 12,
      fontWeight: 600,
      lineHeight: 1.15,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    summaryValue: {
      display: 'block',
      marginTop: 5,
      color: palette.text,
      fontSize: 22,
      fontWeight: 800,
      lineHeight: 0.9,
      letterSpacing: '-0.03em',
    },
    panel: {
      marginTop: 24,
      padding: desktop ? 20 : 18,
      border: `1px solid ${palette.border}`,
      borderRadius: 16,
      background: palette.card,
      boxShadow: palette.shadow,
    },
    panelTitle: {
      margin: 0,
      color: palette.text,
      fontSize: 20,
      fontWeight: 800,
      lineHeight: 1,
      letterSpacing: '-0.025em',
    },
    toolbar: {
      display: 'flex',
      flexDirection: desktop ? 'row' : 'column',
      alignItems: desktop ? 'center' : undefined,
      justifyContent: desktop ? 'space-between' : undefined,
      gap: 12,
      marginTop: 16,
    },
    filters: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      minWidth: 0,
      overflowX: desktop ? 'visible' : 'auto',
      paddingBottom: desktop ? 0 : 2,
      scrollbarWidth: 'none',
    },
    searchWrap: {
      position: 'relative',
      display: 'block',
      width: desktop ? (wide ? 280 : 260) : '100%',
      flex: desktop ? `0 0 ${wide ? 280 : 260}px` : undefined,
    },
    searchIcon: {
      position: 'absolute',
      top: '50%',
      left: 13,
      zIndex: 1,
      width: 16,
      height: 16,
      color: palette.muted,
      strokeWidth: 2.25,
      transform: 'translateY(-50%)',
      pointerEvents: 'none',
    },
    searchInput: {
      width: '100%',
      height: 36,
      padding: '0 12px 0 36px',
      border: `1px solid ${searchFocused ? palette.primary : palette.border}`,
      borderRadius: 12,
      outline: 'none',
      color: palette.text,
      background: palette.card,
      boxShadow: searchFocused ? '0 0 0 3px rgba(10, 164, 118, 0.12)' : 'none',
      fontFamily: 'inherit',
      fontSize: 12,
      fontWeight: 500,
    },
    error: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 18,
      padding: 12,
      border: `1px solid ${palette.errorBorder}`,
      borderRadius: 12,
      color: palette.errorText,
      background: palette.errorBackground,
      fontSize: 13,
      fontWeight: 600,
    },
    list: { display: 'grid', gap: 8, marginTop: 18 },
    row: {
      minHeight: desktop ? 112 : 96,
      overflow: 'hidden',
      border: '1px solid transparent',
      borderRadius: 16,
      background: palette.card,
      boxShadow: 'none',
      transition: 'background-color 160ms ease, border-color 160ms ease',
    },
    rowMain: {
      display: 'grid',
      gridTemplateColumns: wide
        ? '140px minmax(280px, 1fr) 126px 150px'
        : desktop
          ? '128px minmax(220px, 1fr) 120px 146px'
          : mobile
            ? '76px minmax(0, 1fr)'
            : '104px minmax(0, 1fr) 112px 142px',
      alignItems: 'center',
      minHeight: desktop ? 112 : 96,
      gap: desktop ? 14 : 10,
      padding: desktop ? '8px 10px' : '8px',
    },
    categoryBadge: {
      display: 'inline-flex',
      alignItems: 'center',
      maxWidth: '100%',
      minHeight: 22,
      padding: '3px 11px',
      borderRadius: 999,
      color: palette.primary,
      background: theme === 'dark' ? 'rgba(41, 185, 167, 0.12)' : '#e8f4f2',
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1,
      whiteSpace: 'nowrap',
    },
    actionGroup: {
      display: mobile ? 'flex' : 'contents',
      gridColumn: mobile ? '1 / -1' : undefined,
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: 10,
    },
    reportTitle: {
      margin: '7px 0 0',
      overflow: 'hidden',
      color: palette.text,
      fontSize: desktop ? 15 : 14,
      fontWeight: 700,
      lineHeight: 1.25,
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
    metaLine: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
      margin: '5px 0 0',
      color: palette.muted,
      fontSize: desktop ? 12 : 11,
      fontWeight: 500,
      lineHeight: 1.2,
    },
    location: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      minWidth: 0,
      margin: '5px 0 0',
      color: palette.muted,
      fontSize: desktop ? 12 : 11,
      fontWeight: 500,
      lineHeight: 1.2,
    },
    empty: {
      padding: '44px 18px',
      border: `1px dashed ${palette.border}`,
      borderRadius: 14,
      color: palette.muted,
      fontSize: 13,
      textAlign: 'center',
    },
  };
};

const MyRequests = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLoading: authLoading } = useAuth();
  const { theme, translate } = useAppPreferences();
  const queryClient = useQueryClient();
  const viewportWidth = useViewportWidth();
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredReportId, setHoveredReportId] = useState<string | null>(null);
  const palette = PALETTES[theme];
  const styles = createStyles(palette, theme, viewportWidth, searchFocused);
  const mobile = viewportWidth < 768;
  const desktop = viewportWidth >= 1024;
  const wide = viewportWidth >= 1280;
  const compact = viewportWidth <= 430;

  const { data: reports = [], isLoading, error } = useQuery({
    queryKey: reportQueryKeys.myReports(user?.id),
    queryFn: async (): Promise<TrackedReport[]> => {
      if (!user) return [];
      const { data, error: queryError } = await supabase
        .from('community_reports')
        .select('id,title,description,category,status,created_at,updated_at,location,latitude,longitude,photo_url,media_urls,assigned_department,admin_notes,admin_review_notes,action_taken,reporter_name,reporter_contact,response_at,resolved_at,user_id')
        .eq('user_id', user.id)
        .neq('status', 'rejected')
        .order('created_at', { ascending: false })
        .limit(100);
      if (queryError) throw queryError;
      return ((data || []) as TrackedReport[]).filter(
        (report) => !isConfirmedTestReport(report),
      );
    },
    enabled: Boolean(user),
    staleTime: 30_000,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`my-reports-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_reports', filter: `user_id=eq.${user.id}` },
        () => queryClient.invalidateQueries({ queryKey: reportQueryKeys.myReports(user.id) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, user]);

  const stats = useMemo(() => ({
    submitted: reports.filter((report) => report.status === 'pending').length,
    underReview: reports.filter((report) => report.status === 'under_review').length,
    inProgress: reports.filter((report) => ['assigned', 'in_progress'].includes(report.status)).length,
    resolved: reports.filter((report) => report.status === 'completed').length,
  }), [reports]);

  const visibleReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    return reports.filter((report) => {
      const matchesFilter = filter === 'all'
        || (filter === 'in_progress'
          ? ['assigned', 'in_progress'].includes(report.status)
          : report.status === filter);
      const matchesSearch = !query
        || report.title.toLowerCase().includes(query)
        || report.category.toLowerCase().includes(query)
        || (report.location || '').toLowerCase().includes(query);
      return matchesFilter && matchesSearch;
    });
  }, [filter, reports, search]);

  const selectedReportId = searchParams.get('report');
  const selectedReport = reports.find((report) => report.id === selectedReportId) ?? null;

  const openReport = (reportId: string) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('report', reportId);
    setSearchParams(nextParams);
  };

  const closeReport = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('report');
    setSearchParams(nextParams, { replace: true });
  };

  if (authLoading) {
    return (
      <div style={{ display: 'grid', minHeight: '100vh', placeItems: 'center', color: palette.primary, background: palette.page }}>
        <Loader2 aria-label={translate('Loading')} style={{ width: 32, height: 32 }} />
      </div>
    );
  }

  const summaryCards = [
    {
      label: translate('Submitted'),
      value: stats.submitted,
      Icon: FileText,
      icon: '#08aa9a',
      iconBackground: '#dcf8f3',
      wave: '#20d9c4',
    },
    {
      label: translate('Under Review'),
      value: stats.underReview,
      Icon: Clock3,
      icon: '#f36a16',
      iconBackground: '#fff0e9',
      wave: '#ff8a4c',
    },
    {
      label: translate('In Progress'),
      value: stats.inProgress,
      Icon: RefreshCw,
      icon: '#0866dc',
      iconBackground: '#e7f0ff',
      wave: '#6da8ff',
    },
    {
      label: translate('Resolved'),
      value: stats.resolved,
      Icon: CheckCircle2,
      icon: '#079856',
      iconBackground: '#e2f8eb',
      wave: '#45df86',
    },
  ];

  return (
    <div style={styles.page}>
      <main style={styles.shell}>

        <header style={styles.heading}>
          <span aria-hidden="true" style={styles.headingAccent} />
          <div>
            <h1 style={styles.headingTitle}>{translate('My Reports')}</h1>
            <p style={styles.headingText}>{translate('Track and manage your submitted community reports.')}</p>
          </div>
        </header>

        <AuthGuard fallback="message">
          <section style={styles.summaryGrid} aria-label={translate('Report summary')}>
            {summaryCards.map((card) => (
              <article key={card.label} style={styles.summaryCard}>
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    right: -24,
                    bottom: -48,
                    width: 126,
                    height: 78,
                    borderRadius: '100% 0 0',
                    background: card.wave,
                    opacity: 1,
                  }}
                />
                <span
                  style={{
                    position: 'relative',
                    zIndex: 1,
                    display: 'grid',
                    width: compact ? 38 : 42,
                    height: compact ? 38 : 42,
                    flex: `0 0 ${compact ? 38 : 42}px`,
                    placeItems: 'center',
                    borderRadius: 12,
                    color: card.icon,
                    background: card.iconBackground,
                  }}
                >
                  <card.Icon style={{ width: 21, height: 21, strokeWidth: 2.25 }} />
                </span>
                <div style={styles.summaryContent}>
                  <p style={styles.summaryLabel}>{card.label}</p>
                  {isLoading ? (
                    <span style={{ display: 'block', width: 34, height: 22, marginTop: 6, borderRadius: 6, background: palette.subtle }} />
                  ) : (
                    <strong style={styles.summaryValue}>{card.value}</strong>
                  )}
                </div>
              </article>
            ))}
          </section>

          <section style={styles.panel}>
            <h2 style={styles.panelTitle}>{translate('Reports')}</h2>

            <div style={styles.toolbar}>
              <div style={styles.filters} aria-label={translate('Filter reports')}>
                {FILTERS.map((item) => {
                  const active = filter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setFilter(item.key)}
                      style={{
                        height: 36,
                        flex: '0 0 auto',
                        padding: '0 14px',
                        border: `1px solid ${active ? palette.primary : palette.border}`,
                        borderRadius: 999,
                        color: active ? palette.primaryText : palette.text,
                        background: active ? palette.primary : palette.card,
                        boxShadow: active ? '0 2px 5px rgba(22, 135, 126, 0.2)' : 'none',
                        fontSize: 13,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        cursor: 'pointer',
                      }}
                    >
                      {translate(item.label)}
                    </button>
                  );
                })}
              </div>

              <label style={styles.searchWrap}>
                <Search style={styles.searchIcon} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  placeholder={translate('Search by title, category, or location')}
                  aria-label={translate('Search reports')}
                  style={styles.searchInput}
                />
              </label>
            </div>

            {error && (
              <div style={styles.error}>
                <AlertCircle style={{ width: 18, height: 18, flex: '0 0 18px' }} />
                <span>{translate('Failed to load your reports. Please try again.')}</span>
              </div>
            )}

            <div style={styles.list}>
              {isLoading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    style={{
                      minHeight: 82,
                      overflow: 'hidden',
                      border: `1px solid ${palette.border}`,
                      borderRadius: 16,
                      background: theme === 'dark'
                        ? 'linear-gradient(90deg, #142226 25%, #223338 50%, #142226 75%)'
                        : 'linear-gradient(90deg, #f6f9fb 25%, #edf2f6 50%, #f6f9fb 75%)',
                    }}
                  />
                ))
              ) : visibleReports.length === 0 ? (
                <div style={styles.empty}>
                  <ClipboardList style={{ width: 40, height: 40, margin: '0 auto 12px', color: palette.muted }} />
                  <p style={{ margin: 0, fontWeight: 500 }}>
                    {reports.length === 0
                      ? translate('You have no reports yet.')
                      : translate('No reports match your search or filter.')}
                  </p>
                  {reports.length === 0 && (
                    <button
                      type="button"
                      onClick={() => navigate('/report-issue')}
                      style={{
                        marginTop: 8,
                        padding: 0,
                        border: 0,
                        color: palette.primary,
                        background: 'transparent',
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {translate('Submit your first report')}
                    </button>
                  )}
                </div>
              ) : (
                visibleReports.map((report) => {
                  const status = STATUS_DETAILS[report.status] ?? STATUS_DETAILS.pending;
                  const statusColors = status[theme];
                  const StatusIcon = status.icon;
                  const title = report.title.replace(/^\[REPORT\]\s*/, '');
                  const categoryLabel = getApprovedCategoryLabel(report.category);
                  const imageUrl = report.photo_url || report.media_urls?.[0];
                  const thumbnailWidth = wide ? 140 : desktop ? 128 : mobile ? 76 : 104;
                  const thumbnailHeight = wide ? 96 : desktop ? 88 : mobile ? 72 : 78;

                  return (
                    <article
                      key={report.id}
                      role="button"
                      tabIndex={0}
                      aria-label={translate('View updates for {title}', { title })}
                      onClick={() => openReport(report.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openReport(report.id);
                        }
                      }}
                      onMouseEnter={() => setHoveredReportId(report.id)}
                      onMouseLeave={() => setHoveredReportId(null)}
                      onFocus={() => setHoveredReportId(report.id)}
                      onBlur={() => setHoveredReportId(null)}
                      style={{
                        ...styles.row,
                        borderColor: hoveredReportId === report.id ? palette.rowHoverBorder : 'transparent',
                        background: hoveredReportId === report.id ? palette.rowHover : palette.card,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={styles.rowMain}>
                        <div
                          style={{
                            display: 'grid',
                            width: thumbnailWidth,
                            height: thumbnailHeight,
                            overflow: 'hidden',
                            placeItems: 'center',
                            borderRadius: 10,
                            color: palette.muted,
                            background: palette.thumbnail,
                          }}
                        >
                          {imageUrl ? (
                            <img src={imageUrl} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <FileText style={{ width: 21, height: 21 }} />
                          )}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <span style={styles.categoryBadge}>{categoryLabel}</span>
                          <h3 style={styles.reportTitle}>{title}</h3>
                          <p style={styles.metaLine}>
                            <Calendar style={{ width: 14, height: 14, flex: '0 0 14px', strokeWidth: 2.4 }} />
                            <span>{format(new Date(report.created_at), 'MMM d, yyyy • h:mm a')}</span>
                          </p>
                          <p style={styles.location}>
                            <MapPin style={{ width: 14, height: 14, flex: '0 0 14px', strokeWidth: 2.4 }} />
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {report.location || 'Barangay Purisima'}
                            </span>
                          </p>
                        </div>

                        <div style={styles.actionGroup}>
                          <span
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              minWidth: mobile ? 104 : 112,
                              height: desktop ? 30 : 28,
                              gap: 6,
                              padding: `0 ${compact ? 8 : 12}px`,
                              borderRadius: 999,
                              color: statusColors.color,
                              background: statusColors.background,
                              fontSize: desktop ? 12 : 11,
                              fontWeight: 700,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            <StatusIcon
                              style={{
                                width: desktop ? 15 : 14,
                                height: desktop ? 15 : 14,
                                flex: `0 0 ${desktop ? 15 : 14}px`,
                                strokeWidth: 2.4,
                              }}
                            />
                            {translate(status.label)}
                          </span>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              openReport(report.id);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: mobile ? 'auto' : '100%',
                              minWidth: mobile ? 138 : undefined,
                              height: 40,
                              flexShrink: 0,
                              gap: 12,
                              padding: '0 16px',
                              border: 0,
                              borderRadius: 999,
                              color: palette.primary,
                              background: theme === 'dark' ? '#22383b' : '#eaf3f2',
                              fontFamily: 'inherit',
                              fontSize: 13,
                              fontWeight: 700,
                              lineHeight: 1,
                              whiteSpace: 'nowrap',
                              cursor: 'pointer',
                            }}
                          >
                            {translate('View Details')}
                            <ChevronRight
                              aria-hidden="true"
                              style={{
                                width: 17,
                                height: 17,
                                color: palette.primary,
                                strokeWidth: 2.4,
                              }}
                            />
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </AuthGuard>
      </main>

      <ReportDetailDialog
        report={selectedReport}
        open={Boolean(selectedReport)}
        mobileMyReportsLayout
        onOpenChange={(isOpen) => {
          if (!isOpen) closeReport();
        }}
      />

      <BottomNav currentPath="/my-requests" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default MyRequests;
