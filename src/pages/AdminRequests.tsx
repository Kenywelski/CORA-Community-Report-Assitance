import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  CheckCircle,
  XCircle,
  MapPin,
  MessageSquare,
  RefreshCw,
  Loader2,
  Trash2,
  User,
  FileText,
  Calendar,
  Hash,
  Phone,
  Home,
  Cake,
  Users as UsersIcon,
  Briefcase,
  Save,
  X,
  Sparkles,
  ShieldCheck,
  Search,
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
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MediaGallery, MediaItem } from '@/components/MediaUpload';
import { LocationPicker } from '@/components/LocationPicker';
import { Input } from '@/components/ui/input';
import type { Tables } from '@/integrations/supabase/types';
import {
  APPROVED_CONCERN_CATEGORIES,
  ApprovedConcernCategoryKey,
  TRAINED_CLASS_REFERENCES,
  evaluateExistingReportRecordByAi,
  inspectCapturedImageQuality,
  runMobileNetV3Classification,
  evaluateImageSuitability,
  evaluateAutonomousAiReportDecision,
  resolveApprovedCategory,
  DEFAULT_CONFIDENCE_THRESHOLD,
} from '@/lib/mobilenetClassifyServiceBridge';

type ServiceRequest = Tables<'service_requests'>;

const REPORT_STATUS_OPTIONS: Array<{
  value: ServiceRequest['status'];
  label: string;
}> = [
  { value: 'pending', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Resolved' },
  { value: 'rejected', label: 'Rejected' },
];

const statusConfig: Record<
  string,
  { label: string; color: string; icon: typeof CheckCircle }
> = {
  pending: {
    label: 'Submitted',
    color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
    icon: Sparkles,
  },
  under_review: {
    label: 'Under Review',
    color: 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
    icon: ShieldCheck,
  },
  assigned: {
    label: 'In Progress',
    color: 'bg-primary text-primary-foreground',
    icon: RefreshCw,
  },
  in_progress: {
    label: 'In Progress',
    color: 'bg-primary text-primary-foreground',
    icon: CheckCircle,
  },
  completed: {
    label: 'Resolved',
    color: 'bg-success text-success-foreground',
    icon: CheckCircle,
  },
  rejected: {
    label: 'Rejected',
    color: 'bg-destructive text-destructive-foreground',
    icon: XCircle,
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
  const [isAutoEvaluating, setIsAutoEvaluating] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(
    null
  );
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [aiFilter, setAiFilter] = useState<'all' | 'valid' | 'rejected'>('all');
  const [classFilter, setClassFilter] = useState<
    'all' | ApprovedConcernCategoryKey
  >('all');

  /**
   * Autonomous AI Enforcement (No Human-in-the-Loop):
   * Automatically evaluates any report that is still pending or marked for review
   * and immediately approves it (if clear & in the 4 supported classes) or rejects it
   * (if blurred, missing photo, or unrelated to the 4 classes).
   */
  const applyAutonomousAiToRecord = useCallback(
    async (req: ServiceRequest): Promise<ServiceRequest> => {
      const nowIso = new Date().toISOString();
      let decision = evaluateExistingReportRecordByAi(req);

      // If there's an attached photo URL and we are running in the browser, also inspect actual image clarity/blur if possible
      const imageUrl =
        req.photo_url ||
        (req.media_urls && req.media_urls.length > 0 ? req.media_urls[0] : null);

      if (imageUrl && decision.verdict === 'approved') {
        try {
          const response = await fetch(imageUrl);
          if (response.ok) {
            const blob = await response.blob();
            if (blob.size > 0) {
              const quality = await inspectCapturedImageQuality(blob);
              const inference = await runMobileNetV3Classification({
                imageUrl,
                photoBlob: blob,
                gps:
                  req.latitude != null && req.longitude != null
                    ? {
                        lat: Number(req.latitude),
                        lng: Number(req.longitude),
                        accuracyMeters: 15,
                        locationTimestamp: Date.now(),
                        capturedAtTimestamp: Date.now(),
                      }
                    : null,
              });
              const suitability = evaluateImageSuitability(
                quality,
                inference,
                DEFAULT_CONFIDENCE_THRESHOLD
              );
              // Prefer explicit valid 4-class category if the image itself passed blur/readability checks
              if (!suitability.isReadable) {
                decision = evaluateAutonomousAiReportDecision({
                  suitability,
                  hasPhoto: true,
                });
              }
            }
          }
        } catch {
          // Use record-level AI evaluation if cross-origin image fetch is blocked
        }
      }

      const nextStatus =
        req.status === 'completed' ? 'completed' : decision.requestStatus;

      const patch = {
        status: nextStatus,
        ai_category:
          decision.matchedCategory?.label ?? req.ai_category ?? null,
        ai_confidence: decision.confidencePercent,
        ai_reason: decision.reason,
        ai_validation_status: decision.aiValidationStatus,
        ai_validation_confidence: decision.confidencePercent,
        ai_validation_reason: decision.reason,
        ai_validated_at: nowIso,
        ai_validation_elements: decision.elements,
        admin_review_status: decision.adminReviewStatus,
        admin_notes: req.admin_notes || decision.adminNote,
        acknowledged_at:
          decision.verdict === 'approved'
            ? req.acknowledged_at || nowIso
            : null,
        response_at:
          decision.verdict === 'approved' ? req.response_at || nowIso : null,
        requires_review: false,
      };

      await supabase.from('service_requests').update(patch).eq('id', req.id);

      return {
        ...req,
        ...patch,
      } as ServiceRequest;
    },
    []
  );

  const fetchRequests = useCallback(async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) {
      // Only auto-evaluate brand new records that have never been evaluated or manually adjusted
      const needsAutoDecision = data.filter(
        (r) =>
          !r.admin_overridden &&
          (!r.ai_validation_status || r.ai_validation_status === 'pending')
      );

      if (needsAutoDecision.length > 0) {
        const updatedMap = new Map<string, ServiceRequest>();
        for (const item of needsAutoDecision) {
          const updated = await applyAutonomousAiToRecord(item);
          updatedMap.set(item.id, updated);
        }
        setRequests(data.map((r) => updatedMap.get(r.id) ?? r));
      } else {
        setRequests(data);
      }
    }
    setIsLoading(false);
  }, [applyAutonomousAiToRecord]);

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('admin-requests-rt')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_requests' },
        () => fetchRequests()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchRequests]);

  const handleAutoVerifyAll = async () => {
    setIsAutoEvaluating(true);
    try {
      const updatedList: ServiceRequest[] = [];
      let approvedCount = 0;
      let rejectedCount = 0;

      for (const req of requests) {
        const updated = await applyAutonomousAiToRecord(req);
        if (updated.ai_validation_status === 'valid') approvedCount++;
        else rejectedCount++;
        updatedList.push(updated);
      }

      setRequests(updatedList);
      if (selectedRequest) {
        const refreshed = updatedList.find((r) => r.id === selectedRequest.id);
        if (refreshed) setSelectedRequest(refreshed);
      }
      toast.success(
        `AI Auto-Verification complete: ${approvedCount} approved, ${rejectedCount} rejected.`
      );
    } finally {
      setIsAutoEvaluating(false);
    }
  };

  const handleRerunSingleAiDecision = async (req: ServiceRequest) => {
    setIsUpdating(true);
    try {
      const updated = await applyAutonomousAiToRecord(req);
      setRequests((prev) =>
        prev.map((item) => (item.id === updated.id ? updated : item))
      );
      setSelectedRequest(updated);
      setAdminNotes(updated.admin_notes || '');
      if (updated.ai_validation_status === 'valid') {
        toast.success(
          `AI Automatically Approved: ${updated.ai_category || updated.category}`
        );
      } else {
        toast.error(
          updated.ai_validation_reason || 'AI Automatically Rejected report.'
        );
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const updateReportStatus = async (
    id: string,
    newStatus: ServiceRequest['status']
  ) => {
    setIsUpdating(true);
    const nowIso = new Date().toISOString();
    const patch: Tables<'service_requests'>['Update'] = {
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
      patch.admin_notes = adminNotes;
    }

    const { error } = await supabase
      .from('service_requests')
      .update(patch)
      .eq('id', id);

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

  const saveRemarksOnly = async () => {
    if (!selectedRequest) return;
    setIsUpdating(true);
    const { error } = await supabase
      .from('service_requests')
      .update({ admin_notes: adminNotes })
      .eq('id', selectedRequest.id);
    if (error) toast.error('Failed to save remarks');
    else toast.success('Remarks saved');
    setIsUpdating(false);
  };

  const deleteRequest = async (id: string) => {
    const { error } = await supabase
      .from('service_requests')
      .delete()
      .eq('id', id);
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
    setAdminNotes(req.admin_notes || '');
  };

  const stats = {
    total: requests.length,
    aiApproved: requests.filter(
      (r) =>
        r.ai_validation_status === 'valid' ||
        r.status === 'in_progress' ||
        r.status === 'completed'
    ).length,
    aiRejected: requests.filter(
      (r) => r.ai_validation_status === 'rejected' || r.status === 'rejected'
    ).length,
    completed: requests.filter((r) => r.status === 'completed').length,
  };

  const filteredRequests = requests
    .filter((r) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'in_progress') {
        return r.status === 'in_progress' || r.status === 'assigned';
      }
      return r.status === activeTab;
    })
    .filter((r) => {
      if (aiFilter === 'all') return true;
      const effectiveAi =
        r.ai_validation_status === 'rejected' || r.status === 'rejected'
          ? 'rejected'
          : 'valid';
      return effectiveAi === aiFilter;
    })
    .filter((r) => {
      if (classFilter === 'all') return true;
      const resolved =
        resolveApprovedCategory(r.ai_category) ||
        resolveApprovedCategory(r.category) ||
        resolveApprovedCategory(r.title);
      return resolved?.key === classFilter;
    })
    .filter((r) => {
      const q = search.toLowerCase().trim();
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        r.category.toLowerCase().includes(q) ||
        (r.location?.toLowerCase().includes(q) ?? false)
      );
    });

  if (isLoading) {
    return (
      <AdminLayout
        title="Autonomous AI Report Management"
        subtitle="Automatic AI approval and rejection across the 4 community concern classes"
      >
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="Autonomous AI Report Management"
      subtitle={`${stats.total} total resident reports · Zero human-in-the-loop verification`}
    >
      {/* Autonomous AI Policy Banner */}
      <Card
        data-testid="autonomous-ai-policy-banner"
        className="mb-4 border-primary/25 bg-primary/5"
      >
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="text-sm font-bold text-foreground">
                Autonomous AI Gatekeeper Active (No Human-in-the-Loop)
              </p>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              AI automatically <strong>approves</strong> clear photos matching
              the 4 trained reference classes (
              {APPROVED_CONCERN_CATEGORIES.map((c) => c.label).join(', ')}) and
              automatically <strong>rejects</strong> blurred, unclear, or
              non-related reports.
            </p>
          </div>
          <Button
            size="sm"
            data-testid="admin-auto-verify-all-btn"
            onClick={handleAutoVerifyAll}
            disabled={isAutoEvaluating}
            className="shrink-0 gap-1.5"
          >
            {isAutoEvaluating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Re-Verify All with AI
          </Button>
        </CardContent>
      </Card>

      {/* Trained 4-Class Reference Filter Strip (Drainage, Streetlight, Road, Waste) */}
      <Card
        data-testid="admin-reference-class-filter"
        className="mb-6 border-border"
      >
        <CardContent className="p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">
                Trained 4-Class Reference Prototypes (Drainage · Streetlight · Road · Waste)
              </p>
              <p className="text-xs text-muted-foreground">
                Click any reference class card below to filter resident reports by that trained concern class:
              </p>
            </div>
            {classFilter !== 'all' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setClassFilter('all')}
                className="h-7 text-xs"
              >
                Show All 4 Classes
              </Button>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TRAINED_CLASS_REFERENCES.map((ref) => {
              const isSelected = classFilter === ref.key;
              const matchCount = requests.filter((r) => {
                const resolved =
                  resolveApprovedCategory(r.ai_category) ||
                  resolveApprovedCategory(r.category) ||
                  resolveApprovedCategory(r.title);
                return resolved?.key === ref.key;
              }).length;

              return (
                <button
                  key={ref.key}
                  type="button"
                  data-testid={`admin-class-filter-${ref.key}`}
                  onClick={() =>
                    setClassFilter((prev) =>
                      prev === ref.key ? 'all' : ref.key
                    )
                  }
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2.5 text-left transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10 ring-2 ring-primary/25'
                      : 'border-border bg-card hover:border-primary/40 hover:bg-muted/40'
                  )}
                >
                  <img
                    src={ref.referenceImageUrl}
                    alt={ref.categoryLabel}
                    className="h-12 w-14 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate text-xs font-bold text-foreground">
                        {ref.shortFilterLabel}
                      </span>
                      <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                        {matchCount}
                      </Badge>
                    </div>
                    <p className="truncate text-[11px] font-medium text-muted-foreground">
                      {ref.categoryLabel}
                    </p>
                    <p className="truncate text-[10px] text-primary">
                      {ref.problemTitle}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: 'Total Reports', value: stats.total, color: 'text-foreground' },
          {
            label: 'AI Auto-Approved',
            value: stats.aiApproved,
            color: 'text-success',
          },
          {
            label: 'AI Auto-Rejected',
            value: stats.aiRejected,
            color: 'text-destructive',
          },
          {
            label: 'Resolved',
            value: stats.completed,
            color: 'text-primary',
          },
        ].map((stat) => (
          <Card key={stat.label} variant="elevated">
            <CardContent className="p-4 text-center">
              <p className={cn('text-2xl font-bold', stat.color)}>
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, description, category, location..."
          className="pl-9"
        />
      </div>

      {/* Autonomous AI Verdict Filter */}
      <div
        data-testid="ai-filter-bar"
        className="mb-4 flex flex-wrap gap-2"
      >
        {(
          [
            {
              k: 'all',
              label: 'All Reports',
              cls: 'bg-muted text-foreground',
              count: requests.length,
            },
            {
              k: 'valid',
              label: 'AI Auto-Approved (4 Classes)',
              cls: 'bg-success/15 text-success',
              count: stats.aiApproved,
            },
            {
              k: 'rejected',
              label: 'AI Auto-Rejected (Blurred / Unrelated)',
              cls: 'bg-destructive/15 text-destructive',
              count: stats.aiRejected,
            },
          ] as const
        ).map((f) => (
          <button
            key={f.k}
            type="button"
            data-testid={`ai-filter-${f.k}`}
            onClick={() => setAiFilter(f.k)}
            className={cn(
              'flex items-center gap-2 rounded-lg border-2 px-3 py-1.5 text-xs font-semibold transition-all',
              aiFilter === f.k
                ? 'border-primary shadow-sm'
                : 'border-transparent',
              f.cls
            )}
          >
            {f.label}
            <span className="rounded-md bg-background/70 px-1.5 text-[10px] font-bold">
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tabs and Requests */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4 grid w-full grid-cols-3 sm:grid-cols-6 h-auto gap-1 p-1">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Submitted</TabsTrigger>
              <TabsTrigger value="under_review">Under Review</TabsTrigger>
              <TabsTrigger value="in_progress">In Progress</TabsTrigger>
              <TabsTrigger value="completed">Resolved</TabsTrigger>
              <TabsTrigger value="rejected">Rejected</TabsTrigger>
            </TabsList>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto">
              {filteredRequests.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">
                  No reports found
                </p>
              ) : (
                filteredRequests.map((req) => {
                  const cfg =
                    statusConfig[req.status] ?? statusConfig.in_progress;
                  const StatusIcon = cfg.icon;
                  const isRejected =
                    req.ai_validation_status === 'rejected' ||
                    req.status === 'rejected';
                  const currentStatusValue: ServiceRequest['status'] =
                    req.status === 'assigned' ? 'in_progress' : req.status;

                  return (
                    <div
                      key={req.id}
                      data-testid="admin-report-item"
                      className="cursor-pointer space-y-3 rounded-xl border p-4 transition-colors hover:bg-muted/50"
                      onClick={() => openRequestDetails(req)}
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant="secondary" className="text-xs">
                              {req.category}
                            </Badge>
                            <Badge className={cn('text-xs', cfg.color)}>
                              <StatusIcon className="mr-1 h-3 w-3" />
                              {cfg.label}
                            </Badge>
                            <Badge
                              className={cn(
                                'text-xs',
                                isRejected
                                  ? 'bg-destructive/15 text-destructive'
                                  : 'bg-success/15 text-success'
                              )}
                            >
                              {isRejected
                                ? 'AI Auto-Rejected'
                                : 'AI Auto-Approved'}
                              {req.ai_validation_confidence != null
                                ? ` · ${Math.round(
                                    req.ai_validation_confidence <= 1
                                      ? req.ai_validation_confidence * 100
                                      : req.ai_validation_confidence
                                  )}%`
                                : ''}
                            </Badge>
                          </div>
                          <p className="line-clamp-1 text-sm font-medium">
                            {req.title}
                          </p>
                          {req.ai_validation_reason && (
                            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                              {req.ai_validation_reason}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {format(
                              new Date(req.created_at),
                              'MMM d, yyyy • h:mm a'
                            )}
                          </p>
                        </div>

                        <div
                          className="flex items-center gap-2.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center gap-1.5">
                            <label
                              htmlFor={`status-select-${req.id}`}
                              className="text-[11px] font-semibold text-muted-foreground whitespace-nowrap"
                            >
                              Status:
                            </label>
                            <select
                              id={`status-select-${req.id}`}
                              data-testid={`report-status-select-${req.id}`}
                              value={currentStatusValue}
                              disabled={isUpdating}
                              onChange={(e) =>
                                updateReportStatus(
                                  req.id,
                                  e.target.value as ServiceRequest['status']
                                )
                              }
                              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                            >
                              {REPORT_STATUS_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {req.photo_url && (
                            <div className="h-12 w-12 overflow-hidden rounded-lg shrink-0">
                              <img
                                src={req.photo_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                      {req.location && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {req.location}
                        </p>
                      )}
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
        <DialogContent className="max-h-[92vh] max-w-3xl gap-0 overflow-hidden p-0">
          {selectedRequest &&
            (() => {
              const req = selectedRequest;
              const cfg = statusConfig[req.status] ?? statusConfig.in_progress;
              const StatusIcon = cfg.icon;
              const refNum = `REQ-${req.id.slice(0, 8).toUpperCase()}`;
              const { fields, extras } = parseDescription(
                req.description || ''
              );
              const items: MediaItem[] =
                req.media_urls && req.media_urls.length > 0
                  ? req.media_urls.map((url, i) => ({
                      url,
                      type:
                        (req.media_types?.[i] as 'image' | 'video') ||
                        (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image'),
                    }))
                  : req.photo_url
                  ? [{ url: req.photo_url, type: 'image' as const }]
                  : [];
              const isRejected =
                req.ai_validation_status === 'rejected' ||
                req.status === 'rejected';
              const dialogStatusValue: ServiceRequest['status'] =
                req.status === 'assigned' ? 'in_progress' : req.status;
              const el = (req.ai_validation_elements ?? {}) as Record<
                string,
                unknown
              >;

              const InfoRow = ({
                icon: Icon,
                label,
                value,
              }: {
                icon: typeof User;
                label: string;
                value?: string | null;
              }) => (
                <div className="flex items-start gap-3 py-2">
                  <div className="mt-0.5 rounded-lg bg-muted p-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      {label}
                    </p>
                    <p className="break-words text-sm font-medium">
                      {value || '—'}
                    </p>
                  </div>
                </div>
              );

              const SectionCard = ({
                title,
                icon: Icon,
                children,
                testId,
              }: {
                title: string;
                icon: typeof User;
                children: React.ReactNode;
                testId?: string;
              }) => (
                <div
                  data-testid={testId}
                  className="rounded-xl border bg-card p-4"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <Icon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">{title}</h3>
                  </div>
                  {children}
                </div>
              );

              return (
                <>
                  {/* Sticky Header */}
                  <DialogHeader className="border-b bg-gradient-to-br from-primary/5 to-transparent px-6 pb-4 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                            <Hash className="h-3 w-3" /> {refNum}
                          </span>
                          <Badge variant="secondary" className="text-[11px]">
                            {req.category}
                          </Badge>
                          <Badge className={cn('text-[11px]', cfg.color)}>
                            <StatusIcon className="mr-1 h-3 w-3" />
                            {cfg.label}
                          </Badge>
                        </div>
                        <DialogTitle className="text-lg leading-tight">
                          {fields.fullName || req.title}
                        </DialogTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Submitted{' '}
                          {format(
                            new Date(req.created_at),
                            "MMM d, yyyy 'at' h:mm a"
                          )}
                        </p>
                      </div>
                    </div>
                  </DialogHeader>

                  {/* Scrollable body */}
                  <div
                    className="space-y-4 overflow-y-auto px-6 py-5"
                    style={{ maxHeight: 'calc(92vh - 200px)' }}
                  >
                    {/* Autonomous AI Verification Decision Card (No Human-in-the-Loop) */}
                    <SectionCard
                      title="Autonomous AI Verification & Auto-Decision (No Human-in-the-Loop)"
                      icon={ShieldCheck}
                      testId="autonomous-ai-decision-card"
                    >
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <Badge
                          data-testid="dialog-ai-verdict-badge"
                          className={cn(
                            'text-xs font-bold',
                            isRejected
                              ? 'bg-destructive text-destructive-foreground'
                              : 'bg-success text-success-foreground'
                          )}
                        >
                          {isRejected
                            ? 'AI AUTO-REJECTED'
                            : 'AI AUTO-APPROVED'}
                        </Badge>
                        {req.ai_validation_confidence != null && (
                          <Badge variant="secondary" className="text-xs">
                            AI Confidence{' '}
                            {Math.round(
                              req.ai_validation_confidence <= 1
                                ? req.ai_validation_confidence * 100
                                : req.ai_validation_confidence
                            )}
                            %
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {isRejected
                            ? 'Rejected Automatically (Blurred / Non-4-Class)'
                            : `Verified Class: ${
                                (el.matched_four_class as string) ||
                                req.ai_category ||
                                req.category.replace(/^Report:\s*/i, '')
                              }`}
                        </Badge>
                        {req.ai_validated_at && (
                          <span className="text-[11px] text-muted-foreground">
                            Processed{' '}
                            {format(
                              new Date(req.ai_validated_at),
                              'MMM d, h:mm a'
                            )}
                          </span>
                        )}
                      </div>

                      <div
                        className={cn(
                          'rounded-lg border p-3 text-sm',
                          isRejected
                            ? 'border-destructive/30 bg-destructive/10 text-destructive'
                            : 'border-success/30 bg-success/10 text-foreground'
                        )}
                      >
                        <p className="font-semibold">
                          {req.ai_validation_reason ||
                            (isRejected
                              ? 'Automatically rejected by AI: Blurred image or report does not match the 4 supported community concern classes.'
                              : 'Automatically approved by AI: Clear image verified under one of the 4 supported community concern classes.')}
                        </p>
                      </div>

                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                        <p>
                          <strong className="text-foreground">
                            Supported 4-Class Check:
                          </strong>{' '}
                          {isRejected
                            ? 'Failed (Outside 4 Classes or Unclear)'
                            : `Passed (${
                                (el.matched_four_class as string) ||
                                req.ai_category ||
                                req.category
                              })`}
                        </p>
                        <p>
                          <strong className="text-foreground">
                            Image Blur &amp; Clarity Check:
                          </strong>{' '}
                          {el.image_clarity === 'blurred_or_unreadable'
                            ? 'Failed — Very Blurred / Unreadable Photo'
                            : el.image_clarity === 'no_image'
                            ? 'Failed — No Photo Attached'
                            : 'Passed — Clear & Readable'}
                        </p>
                      </div>

                      {Array.isArray(el.recommended_actions) &&
                        el.recommended_actions.length > 0 && (
                          <div className="mt-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                            <p className="mb-1.5 text-xs font-semibold text-primary">
                              AI Dispatched Action Plan
                            </p>
                            <ol className="list-decimal space-y-1 pl-4 text-xs text-foreground">
                              {(el.recommended_actions as string[]).map(
                                (a, i) => (
                                  <li key={i}>{a}</li>
                                )
                              )}
                            </ol>
                          </div>
                        )}

                      <div className="mt-3 flex items-center justify-between border-t pt-3">
                        <span className="text-[11px] text-muted-foreground">
                          Autonomous Mode: AI automatically approves or rejects
                          reports without manual human-in-the-loop review.
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          data-testid="rerun-ai-decision-btn"
                          disabled={isUpdating}
                          onClick={() => handleRerunSingleAiDecision(req)}
                        >
                          <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                          Re-Run AI Auto-Decision
                        </Button>
                      </div>
                    </SectionCard>

                    {/* Two-column grid */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <SectionCard title="Reporter Information" icon={User}>
                        <div className="divide-y">
                          <InfoRow
                            icon={User}
                            label="Reporter Name"
                            value={fields.fullName || req.reporter_name}
                          />
                          <InfoRow
                            icon={Phone}
                            label="Contact Number"
                            value={fields.contact}
                          />
                          <InfoRow
                            icon={Home}
                            label="Barangay Location"
                            value={fields.address || req.location}
                          />
                        </div>
                      </SectionCard>

                      <SectionCard title="Report Information" icon={FileText}>
                        <div className="divide-y">
                          <InfoRow
                            icon={FileText}
                            label="Detected Category"
                            value={req.category}
                          />
                          <InfoRow
                            icon={FileText}
                            label="Title"
                            value={req.title}
                          />
                          <InfoRow
                            icon={Calendar}
                            label="Submitted"
                            value={format(
                              new Date(req.created_at),
                              'MMM d, yyyy h:mm a'
                            )}
                          />
                          <InfoRow
                            icon={MapPin}
                            label="Location"
                            value={req.location}
                          />
                        </div>
                      </SectionCard>
                    </div>

                    {extras.length > 0 && (
                      <SectionCard title="Report Details" icon={FileText}>
                        <ul className="space-y-1 text-sm text-muted-foreground">
                          {extras.map((e, i) => (
                            <li key={i} className="break-words">
                              • {e}
                            </li>
                          ))}
                        </ul>
                      </SectionCard>
                    )}

                    {/* Attached Media */}
                    {items.length > 0 && (
                      <SectionCard
                        title={`Attached Media (${items.length})`}
                        icon={FileText}
                      >
                        <MediaGallery items={items} />
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/30 p-3">
                          <span className="text-xs font-semibold text-foreground">
                            Adjust Report Status:
                          </span>
                          <select
                            data-testid="dialog-media-status-select"
                            value={dialogStatusValue}
                            disabled={isUpdating}
                            onChange={(e) =>
                              updateReportStatus(
                                req.id,
                                e.target.value as ServiceRequest['status']
                              )
                            }
                            className="h-9 min-w-[170px] rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          >
                            {REPORT_STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </SectionCard>
                    )}

                    {/* Map */}
                    {req.latitude != null && req.longitude != null && (
                      <SectionCard title="Pinned GPS Location" icon={MapPin}>
                        <LocationPicker
                          readOnly
                          value={{
                            lat: Number(req.latitude),
                            lng: Number(req.longitude),
                          }}
                          onChange={() => {}}
                          height="220px"
                        />
                      </SectionCard>
                    )}

                    {/* Admin Remarks */}
                    <SectionCard title="Field Action Remarks" icon={MessageSquare}>
                      <Textarea
                        value={adminNotes}
                        onChange={(e) => setAdminNotes(e.target.value)}
                        placeholder="Record field maintenance updates or resolution notes..."
                        rows={3}
                        className="resize-none"
                      />
                    </SectionCard>
                  </div>

                  {/* Sticky Action Bar */}
                  <div className="flex flex-wrap items-center justify-end gap-2 border-t bg-card/95 px-4 py-3 backdrop-blur sm:px-6">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mr-auto text-destructive hover:text-destructive"
                        >
                          <Trash2 className="mr-1 h-4 w-4" /> Delete
                        </Button>
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

                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-muted-foreground">
                        Status:
                      </span>
                      <select
                        data-testid="dialog-footer-status-select"
                        value={dialogStatusValue}
                        disabled={isUpdating}
                        onChange={(e) =>
                          updateReportStatus(
                            req.id,
                            e.target.value as ServiceRequest['status']
                          )
                        }
                        className="h-9 rounded-lg border border-input bg-background px-3 text-xs font-semibold text-foreground shadow-xs transition-colors hover:border-primary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {REPORT_STATUS_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedRequest(null)}
                    >
                      <X className="mr-1 h-4 w-4" /> Close
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={saveRemarksOnly}
                      disabled={isUpdating}
                    >
                      {isUpdating ? (
                        <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="mr-1 h-4 w-4" />
                      )}
                      Save Remarks
                    </Button>
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
