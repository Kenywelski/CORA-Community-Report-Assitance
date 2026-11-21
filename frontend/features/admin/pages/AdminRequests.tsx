import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Check,
  CheckCircle,
  MapPin,
  MessageSquare,
  RefreshCw,
  Loader2,
  Trash2,
  User,
  FileText,
  Calendar,
  Phone,
  Home,
  Cake,
  Users as UsersIcon,
  Briefcase,
  MoreHorizontal,
  Pencil,
  X,
  ShieldCheck,
  Search,
  ClipboardList,
  Clock,
  Clock3,
  Filter,
  Image as ImageIcon,
  Map,
  ChevronRight,
  Send,
  type LucideIcon,
} from 'lucide-react';
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
import { format, formatDistanceToNow } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { ImagePreview, MediaGallery, type MediaItem } from '@/features/reports/components/MediaUpload';
import { LocationPicker } from '@/features/reports/components/LocationPicker';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/useAuth';
import type { Tables, TablesUpdate } from '@/integrations/supabase/types';
import { getLegacyStaffUpdate } from '@/features/reports/reportUpdateText';
import { isConfirmedTestReport } from '@/features/reports/testReports';
import {
  APPROVED_CONCERN_CATEGORIES,
  getApprovedCategoryLabel,
} from '@/lib/reportAnalysis';

type ServiceRequest = Tables<'community_reports'>;
type AdminReportStatus = Exclude<ServiceRequest['status'], 'rejected'>;

const REPORT_STATUS_OPTIONS: Array<{
  value: AdminReportStatus;
  label: string;
}> = [
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Resolved' },
];

const isResolvedReport = (status: ServiceRequest['status']) =>
  status === 'completed' || status === 'closed';

const statusConfig: Record<
  string,
  { label: string; color: string; icon: LucideIcon }
> = {
  pending: {
    label: 'Pending',
    color:
      'border-orange-300/70 bg-orange-100 text-orange-600 hover:bg-orange-100 dark:border-orange-400/40 dark:bg-orange-500/20 dark:text-orange-300',
    icon: Clock,
  },
  under_review: {
    label: 'Under Review',
    color:
      'border-amber-300/70 bg-amber-100 text-amber-700 hover:bg-amber-100 dark:border-amber-400/40 dark:bg-amber-500/20 dark:text-amber-300',
    icon: ShieldCheck,
  },
  assigned: {
    label: 'In Progress',
    color:
      'border-blue-300/70 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-300',
    icon: RefreshCw,
  },
  in_progress: {
    label: 'In Progress',
    color:
      'border-blue-300/70 bg-blue-100 text-blue-700 hover:bg-blue-100 dark:border-blue-400/40 dark:bg-blue-500/20 dark:text-blue-300',
    icon: CheckCircle,
  },
  completed: {
    label: 'Resolved',
    color:
      'border-emerald-300/70 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-500/20 dark:text-emerald-300',
    icon: CheckCircle,
  },
};

const FIELD_MAP: Record<string, { key: string; icon: typeof User }> = {
  'buong pangalan': { key: 'fullName', icon: User },
  'full name': { key: 'fullName', icon: User },
  'petsa ng kapanganakan': { key: 'birthDate', icon: Cake },
  'date of birth': { key: 'birthDate', icon: Cake },
  edad: { key: 'age', icon: Cake },
  age: { key: 'age', icon: Cake },
  kasarian: { key: 'gender', icon: UsersIcon },
  gender: { key: 'gender', icon: UsersIcon },
  'katayuang sibil': { key: 'civilStatus', icon: UsersIcon },
  'civil status': { key: 'civilStatus', icon: UsersIcon },
  tirahan: { key: 'address', icon: Home },
  address: { key: 'address', icon: Home },
  trabaho: { key: 'occupation', icon: Briefcase },
  occupation: { key: 'occupation', icon: Briefcase },
  'contact number': { key: 'contact', icon: Phone },
  contact: { key: 'contact', icon: Phone },
  layunin: { key: 'purpose', icon: FileText },
  purpose: { key: 'purpose', icon: FileText },
  'taunang kita': { key: 'income', icon: Briefcase },
};

function parseDescription(desc: string) {
  const fields: Record<string, string> = {};
  const extras: string[] = [];
  if (!desc) return { fields, extras };
  const lines = desc.includes('\n')
    ? desc.split('\n')
    : desc.split(/(?=\s[A-ZÀ-ÿ][a-zà-ÿ ]+:\s)/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([^:]+):\s*(.+)$/);
    if (m) {
      const label = m[1].trim().toLowerCase();
      const value = m[2].trim();
      const mapped = FIELD_MAP[label];
      if (mapped && !fields[mapped.key]) {
        fields[mapped.key] = value;
        continue;
      }
      extras.push(`${m[1].trim()}: ${value}`);
    } else {
      extras.push(line);
    }
  }
  return { fields, extras };
}

const AdminRequests = () => {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(
    null
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isEditingRemarks, setIsEditingRemarks] = useState(false);
  const [editingRemarks, setEditingRemarks] = useState('');
  const [isRemarksMenuOpen, setIsRemarksMenuOpen] = useState(false);
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const fetchRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('community_reports')
      .select('*')
      .neq('status', 'rejected')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load requests');
      setIsLoading(false);
      return;
    }

    setRequests((data ?? []).filter((request) => !isConfirmedTestReport(request)));
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('admin-requests-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_reports' },
        () => fetchRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  useEffect(() => {
    if (!selectedRequest) return;
    const latestRequest = requests.find((request) => request.id === selectedRequest.id);
    if (!latestRequest) {
      setSelectedRequest(null);
    } else if (latestRequest !== selectedRequest) {
      setSelectedRequest(latestRequest);
    }
  }, [requests, selectedRequest]);

  const updateReportStatus = async (
    id: string,
    newStatus: AdminReportStatus
  ) => {
    const currentRequest = requests.find((request) => request.id === id);
    if (currentRequest && isResolvedReport(currentRequest.status)) {
      toast.error('Resolved reports can no longer be edited');
      return;
    }

    setIsUpdating(true);
    const nowIso = new Date().toISOString();
    const patch: TablesUpdate<'community_reports'> = {
      status: newStatus,
      updated_at: nowIso,
      admin_overridden: true,
      admin_review_status: newStatus,
      requires_review: false,
    };

    if (newStatus === 'under_review' || newStatus === 'in_progress') {
      patch.acknowledged_at = nowIso;
      patch.response_at = nowIso;
    }
    if (newStatus === 'completed') {
      patch.resolved_at = nowIso;
    }
    if (selectedRequest && selectedRequest.id === id && adminNotes) {
      patch.admin_review_notes = adminNotes;
    }

    const { error } = await supabase
      .from('community_reports')
      .update(patch)
      .eq('id', id)
      .select('id')
      .single();

    if (!error) {
      const label =
        REPORT_STATUS_OPTIONS.find((o) => o.value === newStatus)?.label ||
        newStatus;
      toast.success(`Report status updated to ${label}`);
      setRequests((prev) =>
        prev.map((item) =>
          item.id === id ? ({ ...item, ...patch } as ServiceRequest) : item
        )
      );
      setSelectedRequest((prev) =>
        prev && prev.id === id
          ? ({ ...prev, ...patch } as ServiceRequest)
          : prev
      );
    } else {
      toast.error('Failed to update report status');
    }
    setIsUpdating(false);
  };

  const markReportResolved = async (id: string) => {
    await updateReportStatus(id, 'completed');
  };

  const saveRemarksOnly = async (
    value: string,
    action: 'send' | 'edit'
  ) => {
    if (!selectedRequest) return;
    if (isResolvedReport(selectedRequest.status)) {
      toast.error('Resolved reports can no longer be edited');
      return;
    }
    const remarks = value.trim();
    if (!remarks) {
      toast.error('Remarks cannot be empty');
      return;
    }

    setIsUpdating(true);
    const updatedAt = new Date().toISOString();
    const { error } = await supabase
      .from('community_reports')
      .update({ admin_review_notes: remarks, updated_at: updatedAt })
      .eq('id', selectedRequest.id)
      .select('id')
      .single();
    if (error) toast.error('Failed to save remarks');
    else {
      toast.success(action === 'edit' ? 'Remarks updated' : 'Remarks sent');
      setSelectedRequest((prev) =>
        prev ? { ...prev, admin_review_notes: remarks, updated_at: updatedAt } : prev
      );
      setRequests((prev) =>
        prev.map((item) =>
          item.id === selectedRequest.id
            ? { ...item, admin_review_notes: remarks, updated_at: updatedAt }
            : item
        )
      );
      if (action === 'send') setAdminNotes('');
      setEditingRemarks(remarks);
      setIsEditingRemarks(false);
    }
    setIsUpdating(false);
  };

  const deleteRemarks = async () => {
    if (!selectedRequest) return;
    if (isResolvedReport(selectedRequest.status)) {
      toast.error('Resolved reports can no longer be edited');
      return;
    }

    setIsUpdating(true);
    const { error } = await supabase
      .from('community_reports')
      .update({ admin_review_notes: null, updated_at: new Date().toISOString() })
      .eq('id', selectedRequest.id)
      .select('id')
      .single();

    if (error) {
      toast.error('Failed to delete remarks');
    } else {
      toast.success('Remarks deleted');
      setSelectedRequest((prev) =>
        prev ? { ...prev, admin_review_notes: null } : prev
      );
      setRequests((prev) =>
        prev.map((item) =>
          item.id === selectedRequest.id
            ? { ...item, admin_review_notes: null }
            : item
        )
      );
      setEditingRemarks('');
      setIsEditingRemarks(false);
    }
    setIsUpdating(false);
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase
      .from('community_reports')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    if (error) {
      toast.error('Failed to delete request');
    } else {
      toast.success('Request deleted');
      setSelectedRequest(null);
      fetchRequests();
    }
  };

  const openRequestDetails = (req: ServiceRequest) => {
    setSelectedRequest(req);
    setAdminNotes(req.admin_review_notes ? '' : getLegacyStaffUpdate(req.admin_notes));
    setEditingRemarks(req.admin_review_notes || '');
    setIsEditingRemarks(false);
    setIsRemarksMenuOpen(false);
  };

  const stats = {
    total: requests.length,
    guest: requests.filter((r) => r.user_id === null).length,
    submitted: requests.filter((r) => r.status === 'pending').length,
    inProgress: requests.filter((r) =>
      ['assigned', 'in_progress'].includes(r.status)
    ).length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  const statusCounts = {
    pending: stats.submitted,
    under_review: requests.filter((r) => r.status === 'under_review').length,
    in_progress: stats.inProgress,
    completed: stats.completed,
  };

  const categories = APPROVED_CONCERN_CATEGORIES.map(
    (category) => category.label
  );

  const filteredRequests = requests
    .filter((r) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'guest') return r.user_id === null;
      if (activeTab === 'in_progress') {
        return r.status === 'in_progress' || r.status === 'assigned';
      }
      return r.status === activeTab;
    })
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        getApprovedCategoryLabel(r.category).toLowerCase().includes(q) ||
        (r.location?.toLowerCase().includes(q) ?? false)
      );
    })
    .filter(
      (r) =>
        categoryFilter === 'all' ||
        getApprovedCategoryLabel(r.category) === categoryFilter
    )
    .filter((r) => {
      if (dateFilter === 'all') return true;
      const createdAt = new Date(r.created_at);
      const now = new Date();

      if (dateFilter === 'today') {
        return createdAt.toDateString() === now.toDateString();
      }

      const days = dateFilter === '7days' ? 7 : 30;
      const cutoff = new Date(now);
      cutoff.setDate(cutoff.getDate() - days);
      return createdAt >= cutoff;
    });

  if (isLoading) {
    return (
      <AdminLayout
        title="Report Management"
        subtitle="Loading resident reports"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Report Management"
      subtitle={`${stats.total} total ${stats.total === 1 ? 'report' : 'reports'}`}
    >
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
        {[
          {
            label: 'Total Reports',
            value: stats.total,
            icon: ClipboardList,
            iconClass:
              'bg-teal-50 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300',
          },
          {
            label: 'Pending',
            value: stats.submitted,
            icon: Clock,
            iconClass:
              'bg-orange-50 text-orange-500 dark:bg-orange-500/15 dark:text-orange-300',
          },
          {
            label: 'Under Review',
            value: statusCounts.under_review,
            icon: ShieldCheck,
            iconClass:
              'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300',
          },
          {
            label: 'In Progress',
            value: stats.inProgress,
            icon: Clock3,
            iconClass:
              'bg-blue-50 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300',
          },
          {
            label: 'Resolved',
            value: stats.completed,
            icon: CheckCircle,
            iconClass:
              'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300',
          },
        ].map((stat, index) => {
          const StatIcon = stat.icon;
          return (
            <Card
              key={stat.label}
              className={cn(
                'rounded-2xl border-border/80 bg-card shadow-sm',
                index === 4 && 'col-span-2 sm:col-span-2 md:col-span-1'
              )}
            >
              <CardContent className="flex min-h-[76px] items-center gap-3 p-3 sm:p-4">
                <div
                  className={cn(
                    'flex h-11 w-11 shrink-0 items-center justify-center rounded-full',
                    stat.iconClass
                  )}
                >
                  <StatIcon className="h-[22px] w-[22px]" strokeWidth={2.1} />
                </div>
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none text-foreground">
                    {stat.value}
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                    {stat.label}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-[minmax(0,1fr)_270px_170px]">
        <div className="relative col-span-2 min-w-0 md:col-span-1">
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, description, category, location..."
            className="h-11 rounded-xl border-border bg-card pl-11 text-sm shadow-sm placeholder:text-muted-foreground"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="h-11 min-w-0 rounded-xl border-border bg-card px-3 text-sm font-semibold shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
              <Filter className="h-5 w-5 shrink-0" />
              <SelectValue
                className="block min-w-0 truncate text-left"
                placeholder="Category"
              />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {getApprovedCategoryLabel(category)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="h-11 min-w-0 rounded-xl border-border bg-card px-3 text-sm font-semibold shadow-sm">
            <div className="flex min-w-0 flex-1 items-center gap-2 whitespace-nowrap">
              <Calendar className="h-5 w-5 shrink-0" />
              <SelectValue className="truncate" placeholder="Date Range" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Dates</SelectItem>
            <SelectItem value="today">Today</SelectItem>
            <SelectItem value="7days">Last 7 Days</SelectItem>
            <SelectItem value="30days">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="rounded-2xl border-0 bg-card shadow-none">
        <CardContent className="p-2.5 sm:p-3">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-3 flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/70 p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-6 md:overflow-visible">
              {[
                { value: 'all', label: 'All', count: stats.total },
                { value: 'guest', label: 'Guest Reports', count: stats.guest },
                { value: 'pending', label: 'Pending', count: statusCounts.pending },
                { value: 'under_review', label: 'Under Review', count: statusCounts.under_review },
                { value: 'in_progress', label: 'In Progress', count: statusCounts.in_progress },
                { value: 'completed', label: 'Resolved', count: statusCounts.completed },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  className="min-h-9 shrink-0 rounded-lg px-3 text-[11px] font-semibold text-muted-foreground data-[state=active]:bg-primary data-[state=active]:!text-white data-[state=active]:opacity-100 data-[state=active]:shadow-sm md:min-w-0 md:px-1.5 lg:text-xs"
                >
                  {tab.label} ({tab.count})
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="space-y-3">
              {filteredRequests.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 text-center">
                  <ClipboardList className="mb-3 h-9 w-9 text-muted-foreground/60" />
                  <p className="font-semibold text-foreground">No reports found</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Try changing the search term or filters.
                  </p>
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const cfg =
                    statusConfig[req.status] ?? statusConfig.in_progress;
                  const StatusIcon = cfg.icon;
                  const thumbnail = req.photo_url || req.media_urls?.[0];
                  const categoryLabel = getApprovedCategoryLabel(req.category);

                  return (
                    <div
                      key={req.id}
                      data-testid="admin-report-item"
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-2xl border border-transparent bg-transparent p-2 transition-all duration-200 hover:border-primary/35 hover:bg-primary/[0.055] focus-visible:border-primary/35 focus-visible:bg-primary/[0.055] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 lg:px-2.5"
                      onClick={() => openRequestDetails(req)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openRequestDetails(req);
                        }
                      }}
                    >
                      <div className="grid min-h-24 grid-cols-[96px_minmax(0,1fr)] items-center gap-x-2.5 gap-y-2.5 md:grid-cols-[104px_minmax(0,1fr)_112px_142px] lg:min-h-28 lg:grid-cols-[128px_minmax(220px,1fr)_120px_146px] lg:gap-x-3.5 xl:grid-cols-[140px_minmax(280px,1fr)_126px_150px]">
                        <div className="flex aspect-[3/2] w-24 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-muted md:aspect-auto md:h-[78px] md:w-[104px] lg:h-[88px] lg:w-[128px] xl:h-24 xl:w-[140px]">
                          {thumbnail ? (
                            <img
                              src={thumbnail}
                              alt={`${req.title} report`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary/5 text-primary/45">
                              <ImageIcon className="h-9 w-9" />
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge className="h-[22px] border-0 bg-primary/10 px-[11px] py-0 text-[11px] font-bold text-primary hover:bg-primary/10">
                              {categoryLabel}
                            </Badge>
                          </div>
                          <p className="mt-[7px] truncate text-sm font-bold text-foreground lg:text-[15px]">
                            {req.title.replace(/^\[REPORT\]\s*/, '')}
                          </p>
                          <p className="mt-[5px] flex min-w-0 items-center gap-[5px] text-[11px] font-medium leading-tight text-muted-foreground lg:text-xs">
                            <Calendar className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                              {format(
                                new Date(req.created_at),
                                'MMM d, yyyy • h:mm a'
                              )}
                            </span>
                          </p>
                          {req.location && (
                            <p className="mt-[5px] flex min-w-0 items-center gap-[5px] text-[11px] font-medium leading-tight text-muted-foreground lg:text-xs">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{req.location}</span>
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 flex min-w-0 items-center justify-end gap-2.5 md:contents">
                          <Badge
                            className={cn(
                              'h-7 min-w-[104px] shrink-0 justify-center border-0 px-2 text-[11px] font-bold shadow-none md:h-[30px] md:min-w-[112px] md:px-3 md:text-xs lg:min-w-[120px] xl:min-w-[126px]',
                              cfg.color
                            )}
                          >
                            <StatusIcon className="mr-1.5 h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" />
                            {cfg.label}
                          </Badge>
                          <Button
                            type="button"
                            variant="ghost"
                            className="h-10 min-w-[138px] shrink-0 rounded-full bg-primary/10 px-4 font-bold text-primary hover:bg-primary/15 hover:text-primary md:w-full md:min-w-0"
                            onClick={(event) => {
                              event.stopPropagation();
                              openRequestDetails(req);
                            }}
                          >
                            View Details
                            <ChevronRight className="ml-2 h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={(o) => !o && setSelectedRequest(null)}
      >
        <DialogContent
          closeButtonClassName="hidden"
          className="!flex h-[86dvh] max-h-[86dvh] w-[calc(100vw-1rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-[22px] border-0 bg-background p-0 shadow-2xl ring-0 sm:w-[calc(100vw-3rem)]"
        >
          {selectedRequest &&
            (() => {
              const req = selectedRequest;
              const isResolved = isResolvedReport(req.status);
              const hasSentRemarks = Boolean(req.admin_review_notes?.trim());
              const metadataName = user?.user_metadata?.full_name;
              const remarkAuthor =
                (typeof metadataName === 'string' && metadataName.trim()) ||
                user?.email?.split('@')[0] ||
                'Admin';
              const cfg = statusConfig[req.status] ?? statusConfig.in_progress;
              const StatusIcon = cfg.icon;
              const categoryLabel = getApprovedCategoryLabel(req.category);
              const cleanTitle = req.title.replace(/^\[REPORT\]\s*/, '');
              const cleanDescription = (req.description || '')
                .replace(/\n\nAI Validation:[\s\S]*$/i, '')
                .trim();
              const refNum = `REPORT-${req.id.slice(0, 8).toUpperCase()}`;
              const { fields } = parseDescription(req.description || '');
              const mediaItems: MediaItem[] =
                req.media_urls && req.media_urls.length > 0
                  ? req.media_urls.map((url, index) => ({
                      url,
                      type:
                        (req.media_types?.[index] as 'image' | 'video') ||
                        (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'),
                    }))
                  : req.photo_url
                    ? [{ url: req.photo_url, type: 'image' }]
                    : [];
              const dialogStatusValue: ServiceRequest['status'] =
                isResolved
                  ? 'completed'
                  : req.status === 'assigned'
                    ? 'in_progress'
                    : req.status;
              const currentStep =
                isResolved
                  ? 3
                  : req.status === 'assigned' || req.status === 'in_progress'
                    ? 2
                    : req.status === 'under_review'
                      ? 1
                      : 0;
              const latestUpdate =
                req.resolved_at ||
                req.updated_at ||
                req.response_at ||
                req.created_at;
              const progressSteps = [
                { label: 'Pending', at: req.created_at },
                {
                  label: 'Under Review',
                  at:
                    currentStep >= 1
                      ? req.status === 'under_review'
                        ? req.updated_at || req.response_at
                        : req.response_at
                      : null,
                },
                {
                  label: 'In Progress',
                  at:
                    currentStep >= 2
                      ? req.updated_at || req.response_at
                      : null,
                },
                {
                  label: 'Resolved',
                  at:
                    currentStep >= 3
                      ? req.resolved_at || req.updated_at
                      : null,
                },
              ];
              return (
                <>
                  <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [scrollbar-gutter:stable] sm:p-4 lg:p-5">
                    <header>
                      <div className="flex min-w-0 items-center justify-between gap-2">
                        <DialogTitle className="min-w-0 flex-1 truncate text-lg font-extrabold leading-tight tracking-tight sm:text-2xl">
                          {cleanTitle}
                        </DialogTitle>
                        <div className="flex shrink-0 items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-extrabold sm:text-sm',
                              cfg.color
                            )}
                          >
                            <StatusIcon className="h-4 w-4" />
                            {cfg.label}
                          </span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 shrink-0 rounded-none border-0 bg-transparent p-0 text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground focus-visible:ring-0 sm:h-8 sm:w-8"
                            aria-label="Close report details"
                            onClick={() => setSelectedRequest(null)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex max-w-full truncate rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          {categoryLabel}
                        </span>
                        <span className="inline-flex rounded-full bg-muted px-3 py-1 font-mono text-[11px] font-semibold text-muted-foreground">
                          Report ID: {refNum}
                        </span>
                      </div>
                    </header>

                    <section className="mt-3 rounded-[18px] border border-border/70 bg-card p-3 shadow-sm">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                          Report Progress
                        </h2>
                        <span className="ml-auto max-w-full self-end truncate rounded-full bg-primary/10 px-3 py-1 text-right text-[10px] font-semibold text-primary sm:w-fit sm:text-xs">
                          Last Update: {format(new Date(latestUpdate), 'MMM d, h:mm a')}
                        </span>
                      </div>

                      <div
                        className={cn(
                          'mt-3 grid gap-2 min-[420px]:grid-cols-4 min-[420px]:gap-0'
                        )}
                      >
                        {progressSteps.map((step, index) => {
                          const active = index <= currentStep;
                          const current = index === currentStep;
                          const nextIsActive = index < currentStep;
                          return (
                            <div
                              key={step.label}
                              className="relative flex min-h-16 gap-3 min-[420px]:block min-[420px]:min-h-0 min-[420px]:text-center"
                            >
                              {index < progressSteps.length - 1 && (
                                <>
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'absolute bottom-[-10px] left-[19px] top-10 border-l-2 border-dotted min-[420px]:hidden',
                                      nextIsActive
                                        ? 'border-primary/80'
                                        : 'border-border'
                                    )}
                                  />
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'absolute left-[calc(50%+24px)] top-5 hidden w-[calc(100%-48px)] border-t-2 border-dotted min-[420px]:block',
                                      nextIsActive
                                        ? 'border-primary/80'
                                        : 'border-border'
                                    )}
                                  />
                                </>
                              )}
                              <div
                                className={cn(
                                  'relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-card min-[420px]:mx-auto',
                                  active && 'border-primary text-primary',
                                  current && 'bg-primary text-primary-foreground',
                                  !active && 'border-border text-muted-foreground/45'
                                )}
                              >
                                {active ? (
                                  <CheckCircle className="h-5 w-5" />
                                ) : (
                                  <span className="h-2 w-2 rounded-full bg-current" />
                                )}
                              </div>
                              <div className="min-w-0 flex-1 pt-0.5 min-[420px]:mt-2 min-[420px]:flex-none min-[420px]:pt-0">
                                <div className="flex min-w-0 items-center justify-between gap-2 min-[420px]:flex-col min-[420px]:justify-start">
                                  <span
                                    className={cn(
                                      'inline-flex min-w-24 justify-center rounded-full px-2.5 py-1 text-xs font-extrabold',
                                      active && 'bg-primary/10 text-primary',
                                      current && 'bg-primary text-primary-foreground',
                                      !active && 'bg-muted text-muted-foreground'
                                    )}
                                  >
                                    {step.label}
                                  </span>
                                  <p className="mt-1.5 min-w-0 text-right text-[11px] text-muted-foreground sm:text-xs min-[420px]:text-center">
                                    {step.at
                                      ? format(new Date(step.at), 'MMM d, h:mm a')
                                      : active
                                        ? 'Time not recorded'
                                        : 'Pending'}
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
                        <span className="text-xs font-semibold text-muted-foreground">
                          Update Status
                        </span>
                        <Select
                          value={dialogStatusValue}
                          disabled={isUpdating || isResolved}
                          onValueChange={(value) =>
                            updateReportStatus(
                              req.id,
                              value as AdminReportStatus
                            )
                          }
                        >
                          <SelectTrigger
                            data-testid="dialog-footer-status-select"
                            className="h-9 w-[190px] rounded-full"
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {REPORT_STATUS_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {isResolved && (
                          <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                            This resolved report is read-only.
                          </span>
                        )}
                      </div>
                    </section>

                    <div className="mt-2 grid items-stretch gap-1.5 lg:grid-cols-2">
                      <div className="contents">
                      {mediaItems.length > 0 && (
                        <section className="order-1 flex h-full min-h-0 flex-col overflow-hidden rounded-[18px] border border-border/70 bg-card shadow-sm">
                          {mediaItems[0].type === 'image' ? (
                            <ImagePreview
                              src={mediaItems[0].url}
                              alt={`Evidence for ${cleanTitle}`}
                              className="min-h-0 w-full flex-1 bg-muted"
                            >
                              <img
                                src={mediaItems[0].url}
                                alt={`Evidence for ${cleanTitle}`}
                                className="block h-full w-full object-cover"
                              />
                            </ImagePreview>
                          ) : (
                            <video
                              src={mediaItems[0].url}
                              controls
                              className="min-h-40 w-full flex-1 bg-black object-contain"
                            />
                          )}
                          {mediaItems.length > 1 && (
                            <div className="border-t border-border/60 p-3">
                              <p className="mb-2 text-xs font-bold">
                                Attached Media ({mediaItems.length})
                              </p>
                              <MediaGallery items={mediaItems.slice(1)} />
                            </div>
                          )}
                        </section>
                      )}
                      <section className="order-3 h-full overflow-hidden rounded-[18px] border border-border/70 bg-card p-2.5 shadow-sm lg:col-span-2">
                        <div className="mb-1.5 flex items-center gap-3 px-1">
                          <Map className="h-5 w-5 text-primary" />
                          <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                            Reported Location
                          </h2>
                        </div>
                        {req.latitude != null && req.longitude != null ? (
                          <LocationPicker
                            value={{
                              lat: Number(req.latitude),
                              lng: Number(req.longitude),
                            }}
                            onChange={() => undefined}
                            height="260px"
                            readOnly
                            hideLabel
                            hideCoordinates
                          />
                        ) : (
                          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-2xl bg-muted/30 text-center text-muted-foreground">
                            <MapPin className="h-8 w-8" />
                            <p className="text-sm font-semibold">
                              No map coordinates were saved.
                            </p>
                            {req.location && (
                              <p className="max-w-sm text-xs">{req.location}</p>
                            )}
                          </div>
                        )}
                      </section>

                      <section
                        className={cn(
                          'order-2 h-full rounded-[18px] border border-border/70 bg-card p-2.5 shadow-sm',
                          mediaItems.length === 0 && 'lg:col-span-2'
                        )}
                      >
                        <div className="mb-1.5 flex items-center gap-2">
                          <FileText className="h-5 w-5 text-primary" />
                          <h2 className="text-base font-extrabold tracking-tight sm:text-lg">
                            Report Information
                          </h2>
                        </div>
                        <div className="space-y-2">
                          <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                            <div className="font-semibold text-foreground">Category</div>
                            <div className="min-w-0 text-muted-foreground">
                              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                                {categoryLabel}
                              </span>
                            </div>
                          </div>
                          <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                            <div className="font-semibold text-foreground">Description</div>
                            <div className="min-w-0 whitespace-pre-wrap leading-relaxed text-muted-foreground">
                              {cleanDescription || '—'}
                            </div>
                          </div>
                          <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                            <div className="font-semibold text-foreground">Location</div>
                            <div className="min-w-0 text-muted-foreground">
                              {req.location || 'Location not provided'}
                            </div>
                          </div>
                          <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                            <div className="font-semibold text-foreground">Date &amp; Time</div>
                            <div className="min-w-0 text-muted-foreground">
                              {format(new Date(req.created_at), 'MMM d, yyyy, h:mm a')}
                            </div>
                          </div>
                          {req.assigned_department && (
                            <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                              <div className="font-semibold text-foreground">Assigned Office</div>
                              <div className="min-w-0 text-muted-foreground">
                                {req.assigned_department}
                              </div>
                            </div>
                          )}
                          <div className="border-t border-border/60 pt-2">
                            <h3 className="mb-1.5 flex items-center gap-2 text-base font-extrabold tracking-tight sm:text-lg">
                              <User className="h-4 w-4 text-primary" />
                              Reporter Information
                            </h3>
                            <div className="space-y-2">
                              <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                                <div className="font-semibold text-foreground">Name</div>
                                <div className="min-w-0 text-muted-foreground">
                                  {fields.fullName || req.reporter_name || '—'}
                                </div>
                              </div>
                              <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                                <div className="font-semibold text-foreground">Contact</div>
                                <div className="min-w-0 text-muted-foreground">
                                  {fields.contact || req.reporter_contact || '—'}
                                </div>
                              </div>
                              {fields.address && (
                                <div className="grid gap-1.5 text-sm sm:grid-cols-[125px_minmax(0,1fr)] sm:gap-4">
                                  <div className="font-semibold text-foreground">Address</div>
                                  <div className="min-w-0 text-muted-foreground">
                                    {fields.address}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </section>

                      </div>
                    </div>

                    <section className="mt-2 rounded-[18px] border border-border/70 bg-card p-3 shadow-sm">
                      <div data-testid="report-field-action-remarks">
                        <h2 className="mb-2 flex items-center gap-2 text-base font-extrabold tracking-tight">
                          <MessageSquare className="h-5 w-5 text-primary" />
                          Field Action Remarks
                        </h2>
                        {hasSentRemarks && (
                          <article className="mb-2 rounded-xl bg-primary/[0.05] p-2.5">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex min-w-0 items-center gap-1.5 pt-0.5 text-xs">
                                <span className="truncate font-bold text-primary">
                                  {remarkAuthor}
                                </span>
                                <span aria-hidden="true" className="text-muted-foreground">
                                  ·
                                </span>
                                <span className="shrink-0 text-muted-foreground">
                                  {formatDistanceToNow(
                                    new Date(req.updated_at || req.created_at),
                                    { addSuffix: true }
                                  )}
                                </span>
                              </div>
                              <Popover
                                open={isRemarksMenuOpen}
                                onOpenChange={setIsRemarksMenuOpen}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 shrink-0 rounded-lg bg-background/40 text-muted-foreground hover:bg-background hover:text-foreground"
                                    aria-label="Remarks actions"
                                    disabled={isUpdating || isResolved}
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                  align="end"
                                  className="w-44 rounded-xl p-2"
                                >
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    className="w-full justify-start"
                                    onClick={() => {
                                      setEditingRemarks(req.admin_review_notes || '');
                                      setIsEditingRemarks(true);
                                      setIsRemarksMenuOpen(false);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                    Edit remarks
                                  </Button>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        className="w-full justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                        Delete remarks
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete these remarks?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          This removes the sent remarks from the report and cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => void deleteRemarks()}
                                        >
                                          Delete remarks
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </PopoverContent>
                              </Popover>
                            </div>
                            {isEditingRemarks ? (
                              <>
                                <Textarea
                                  aria-label="Edit sent field action remarks"
                                  value={editingRemarks}
                                  onChange={(event) =>
                                    setEditingRemarks(event.target.value)
                                  }
                                  rows={1}
                                  className="!mt-2 !min-h-12 resize-none rounded-lg border-primary/70 bg-background px-3 py-2 text-sm shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                                  disabled={isUpdating || isResolved}
                                />
                                <div className="mt-2 flex justify-end gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() => {
                                      setEditingRemarks(req.admin_review_notes || '');
                                      setIsEditingRemarks(false);
                                    }}
                                    disabled={isUpdating}
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="rounded-lg"
                                    onClick={() =>
                                      void saveRemarksOnly(editingRemarks, 'edit')
                                    }
                                    disabled={isUpdating || !editingRemarks.trim()}
                                  >
                                    {isUpdating ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Check className="h-4 w-4" />
                                    )}
                                    {isUpdating ? 'Saving...' : 'Save'}
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <div className="mt-2 whitespace-pre-wrap rounded-lg px-1 py-1 text-sm leading-5 text-foreground">
                                {req.admin_review_notes}
                              </div>
                            )}
                          </article>
                        )}
                        <div className="relative mt-2 overflow-hidden rounded-2xl border border-border/80 bg-background transition-colors focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                          <Textarea
                            id="admin-report-remarks"
                            aria-label="Field Action Remarks"
                            value={adminNotes}
                            onChange={(event) => setAdminNotes(event.target.value)}
                            onKeyDown={(event) => {
                              if (
                                event.key === 'Enter' &&
                                !event.shiftKey &&
                                !event.nativeEvent.isComposing
                              ) {
                                event.preventDefault();
                                if (!isUpdating && adminNotes.trim()) {
                                  void saveRemarksOnly(adminNotes, 'send');
                                }
                              }
                            }}
                            placeholder="Write a remark..."
                            rows={2}
                            className="min-h-20 resize-none border-0 bg-transparent px-4 py-3 pb-16 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                            disabled={isResolved}
                          />
                          <Button
                            type="button"
                            onClick={() => void saveRemarksOnly(adminNotes, 'send')}
                            disabled={isUpdating || isResolved || !adminNotes.trim()}
                            aria-label="Send remark"
                            className="absolute bottom-3 right-3 rounded-xl"
                          >
                            {isUpdating ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            {isUpdating ? 'Sending...' : 'Send'}
                          </Button>
                        </div>
                      </div>
                    </section>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 bg-background px-3 py-3 sm:px-5">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedRequest(null)}
                      className="mr-auto rounded-lg border border-emerald-700 bg-transparent text-emerald-800 shadow-none hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500 dark:text-emerald-300 dark:hover:bg-emerald-950 dark:hover:text-emerald-200"
                    >
                      <X className="mr-1 h-4 w-4" /> Close
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <AdminActionButton
                          action="delete"
                          icon={Trash2}
                          aria-label="Delete report"
                          title="Delete report"
                          disabled={isUpdating}
                        />
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Delete this report?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteRequest(req.id)}
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                  </div>
                </>
              );
            })()}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRequests;
