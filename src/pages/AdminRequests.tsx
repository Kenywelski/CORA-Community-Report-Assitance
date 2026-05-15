import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  CheckCircle, Clock, XCircle, MapPin, 
  MessageSquare, RefreshCw, Loader2, Trash2,
  User, FileText, Calendar, Hash, Phone, Home, Cake, Users as UsersIcon, Briefcase, Save, X
} from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { ImageAnalysis } from '@/components/ImageAnalysis';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { MediaGallery, MediaItem } from '@/components/MediaUpload';
import { LocationPicker } from '@/components/LocationPicker';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type ServiceRequest = Tables<'service_requests'>;

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-warning text-warning-foreground', icon: Clock },
  in_progress: { label: 'Processing', color: 'bg-primary text-primary-foreground', icon: RefreshCw },
  completed: { label: 'Completed', color: 'bg-success text-success-foreground', icon: CheckCircle },
  rejected: { label: 'Rejected', color: 'bg-destructive text-destructive-foreground', icon: XCircle },
};

// Parse "Label: value" description blocks (mixed Tagalog/English)
const FIELD_MAP: Record<string, { key: string; icon: any }> = {
  'buong pangalan': { key: 'fullName', icon: User },
  'full name': { key: 'fullName', icon: User },
  'petsa ng kapanganakan': { key: 'birthDate', icon: Cake },
  'date of birth': { key: 'birthDate', icon: Cake },
  'edad': { key: 'age', icon: Cake },
  'age': { key: 'age', icon: Cake },
  'kasarian': { key: 'gender', icon: UsersIcon },
  'gender': { key: 'gender', icon: UsersIcon },
  'katayuang sibil': { key: 'civilStatus', icon: UsersIcon },
  'civil status': { key: 'civilStatus', icon: UsersIcon },
  'tirahan': { key: 'address', icon: Home },
  'address': { key: 'address', icon: Home },
  'trabaho': { key: 'occupation', icon: Briefcase },
  'occupation': { key: 'occupation', icon: Briefcase },
  'contact number': { key: 'contact', icon: Phone },
  'contact': { key: 'contact', icon: Phone },
  'layunin': { key: 'purpose', icon: FileText },
  'purpose': { key: 'purpose', icon: FileText },
  'taunang kita': { key: 'income', icon: Briefcase },
};

function parseDescription(desc: string) {
  const fields: Record<string, string> = {};
  const extras: string[] = [];
  if (!desc) return { fields, extras };
  // Split on newlines, fall back to splitting on " <Label>:" pattern
  const lines = desc.includes('\n') ? desc.split('\n') : desc.split(/(?=\s[A-ZÀ-ÿ][a-zà-ÿ ]+:\s)/);
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
  const [selectedRequest, setSelectedRequest] = useState<ServiceRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [pendingStatus, setPendingStatus] = useState<null | 'pending' | 'in_progress' | 'completed' | 'rejected'>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchRequests();
    const channel = supabase
      .channel('admin-requests-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => fetchRequests())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchRequests = async () => {
    const { data } = await supabase
      .from('service_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setRequests(data);
    setIsLoading(false);
  };

  const updateStatus = async (id: string, status: 'pending' | 'in_progress' | 'completed' | 'rejected', notes?: string, keepOpen = false) => {
    setIsUpdating(true);
    const updateData: any = { status };
    if (notes !== undefined) updateData.admin_notes = notes;

    const { error } = await supabase
      .from('service_requests')
      .update(updateData)
      .eq('id', id);

    if (!error) {
      const refNum = `REQ-${id.slice(0, 8).toUpperCase()}`;
      if (status === 'completed') toast.success(`Request approved • Ref ${refNum}`);
      else if (status === 'rejected') toast.success('Request rejected');
      else toast.success('Request updated successfully');
      await fetchRequests();
      if (!keepOpen) {
        setSelectedRequest(null);
        setAdminNotes('');
      } else {
        setSelectedRequest((prev) => prev ? { ...prev, status, admin_notes: notes ?? prev.admin_notes } : prev);
      }
    } else {
      toast.error('Failed to update request');
    }
    setIsUpdating(false);
    setPendingStatus(null);
    setRejectReason('');
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
    const { error } = await supabase.from('service_requests').delete().eq('id', id);
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
    pending: requests.filter(r => r.status === 'pending').length,
    in_progress: requests.filter(r => r.status === 'in_progress').length,
    completed: requests.filter(r => r.status === 'completed').length,
  };

  const filteredRequests = requests
    .filter(r => activeTab === 'all' || r.status === activeTab)
    .filter(r => {
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
      <AdminLayout title="Service Requests" subtitle="Manage all requests">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Service Requests" subtitle={`${stats.total} total requests`}>
      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Pending', value: stats.pending, color: 'text-warning' },
          { label: 'Processing', value: stats.in_progress, color: 'text-primary' },
          { label: 'Completed', value: stats.completed, color: 'text-success' },
        ].map((stat) => (
          <Card key={stat.label} variant="elevated">
            <CardContent className="p-4 text-center">
              <p className={cn("text-2xl font-bold", stat.color)}>{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title, description, category, location..."
          className="pl-9"
        />
      </div>

      {/* Tabs and Requests */}
      <Card variant="elevated">
        <CardContent className="p-4">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 mb-4">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
              <TabsTrigger value="in_progress">Processing</TabsTrigger>
              <TabsTrigger value="completed">Completed</TabsTrigger>
            </TabsList>

            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {filteredRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No requests found</p>
              ) : (
                filteredRequests.map((req) => {
                  const StatusIcon = statusConfig[req.status].icon;
                  return (
                    <div 
                      key={req.id} 
                      className="p-4 border rounded-xl space-y-3 cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => openRequestDetails(req)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="secondary" className="text-xs">{req.category}</Badge>
                            <Badge className={cn("text-xs", statusConfig[req.status].color)}>
                              <StatusIcon className="h-3 w-3 mr-1" />
                              {statusConfig[req.status].label}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm line-clamp-1">{req.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(req.created_at), 'MMM d, yyyy • h:mm a')}
                          </p>
                        </div>
                        {req.photo_url && (
                          <div className="w-12 h-12 rounded-lg overflow-hidden ml-3">
                            <img src={req.photo_url} alt="" className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                      {req.location && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
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

      {/* Request Details Dialog — redesigned */}
      <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <DialogContent className="max-w-3xl max-h-[92vh] p-0 gap-0 overflow-hidden">
          {selectedRequest && (() => {
            const req = selectedRequest;
            const cfg = statusConfig[req.status];
            const StatusIcon = cfg.icon;
            const refNum = `REQ-${req.id.slice(0, 8).toUpperCase()}`;
            const { fields, extras } = parseDescription(req.description || '');
            const items: MediaItem[] = (req.media_urls && req.media_urls.length > 0)
              ? req.media_urls.map((url, i) => ({
                  url,
                  type: ((req.media_types?.[i] as 'image' | 'video') || (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image')),
                }))
              : req.photo_url ? [{ url: req.photo_url, type: 'image' as const }] : [];
            const firstImage = items.find((i) => i.type === 'image')?.url;

            const InfoRow = ({ icon: Icon, label, value }: any) => (
              <div className="flex items-start gap-3 py-2">
                <div className="mt-0.5 p-2 rounded-lg bg-muted">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="text-sm font-medium break-words">{value || '—'}</p>
                </div>
              </div>
            );

            const SectionCard = ({ title, icon: Icon, children }: any) => (
              <div className="rounded-xl border bg-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold">{title}</h3>
                </div>
                {children}
              </div>
            );

            return (
              <>
                {/* Sticky Header */}
                <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 to-transparent">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground">
                          <Hash className="h-3 w-3" /> {refNum}
                        </span>
                        <Badge variant="secondary" className="text-[11px]">{req.category}</Badge>
                        <Badge className={cn("text-[11px]", cfg.color)}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <DialogTitle className="text-lg leading-tight">
                        {fields.fullName || req.title}
                      </DialogTitle>
                      <p className="text-xs text-muted-foreground mt-1">
                        Submitted {format(new Date(req.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                </DialogHeader>

                {/* Scrollable body */}
                <div className="overflow-y-auto px-6 py-5 space-y-4" style={{ maxHeight: 'calc(92vh - 200px)' }}>
                  {/* Status timeline */}
                  <div className="flex items-center gap-1 sm:gap-2">
                    {(['pending', 'in_progress', 'completed'] as const).map((s, idx) => {
                      const order = { pending: 0, in_progress: 1, completed: 2, rejected: -1 };
                      const current = order[req.status];
                      const isDone = req.status !== 'rejected' && idx <= current;
                      const cfg2 = statusConfig[s];
                      return (
                        <div key={s} className="flex items-center gap-1 sm:gap-2 flex-1">
                          <div className={cn(
                            "h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-semibold transition-colors",
                            isDone ? cfg2.color : 'bg-muted text-muted-foreground'
                          )}>
                            {idx + 1}
                          </div>
                          <span className={cn("text-[11px] font-medium hidden sm:inline", isDone ? 'text-foreground' : 'text-muted-foreground')}>
                            {cfg2.label}
                          </span>
                          {idx < 2 && <div className={cn("flex-1 h-0.5 rounded", isDone && idx < current ? 'bg-success' : 'bg-muted')} />}
                        </div>
                      );
                    })}
                    {req.status === 'rejected' && (
                      <Badge className={cn("ml-2", statusConfig.rejected.color)}>Rejected</Badge>
                    )}
                  </div>

                  {/* Two-column grid */}
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Applicant Info */}
                    <SectionCard title="Applicant Information" icon={User}>
                      <div className="divide-y">
                        <InfoRow icon={User} label="Full Name" value={fields.fullName} />
                        <InfoRow icon={Cake} label="Birth Date" value={fields.birthDate} />
                        <InfoRow icon={Cake} label="Age" value={fields.age} />
                        <InfoRow icon={UsersIcon} label="Gender" value={fields.gender} />
                        <InfoRow icon={UsersIcon} label="Civil Status" value={fields.civilStatus} />
                        <InfoRow icon={Phone} label="Contact Number" value={fields.contact} />
                        <InfoRow icon={Home} label="Address / Barangay" value={fields.address || req.location} />
                      </div>
                    </SectionCard>

                    {/* Request Info */}
                    <SectionCard title="Request Information" icon={FileText}>
                      <div className="divide-y">
                        <InfoRow icon={FileText} label="Request Type" value={req.category} />
                        <InfoRow icon={FileText} label="Title" value={req.title} />
                        <InfoRow icon={FileText} label="Purpose" value={fields.purpose} />
                        <InfoRow icon={Briefcase} label="Occupation" value={fields.occupation} />
                        <InfoRow icon={Calendar} label="Submitted" value={format(new Date(req.created_at), 'MMM d, yyyy h:mm a')} />
                        <InfoRow icon={MapPin} label="Location" value={req.location} />
                      </div>
                    </SectionCard>
                  </div>

                  {/* Extras / raw description */}
                  {extras.length > 0 && (
                    <SectionCard title="Additional Details" icon={FileText}>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        {extras.map((e, i) => <li key={i} className="break-words">• {e}</li>)}
                      </ul>
                    </SectionCard>
                  )}

                  {/* Media */}
                  {items.length > 0 && (
                    <SectionCard title={`Attached Media (${items.length})`} icon={FileText}>
                      <MediaGallery items={items} />
                      {firstImage && <div className="mt-3"><ImageAnalysis imageUrl={firstImage} /></div>}
                    </SectionCard>
                  )}

                  {/* Map */}
                  {req.latitude != null && req.longitude != null && (
                    <SectionCard title="Pinned Location" icon={MapPin}>
                      <LocationPicker
                        readOnly
                        value={{ lat: Number(req.latitude), lng: Number(req.longitude) }}
                        onChange={() => {}}
                        height="220px"
                      />
                    </SectionCard>
                  )}

                  {/* Status update */}
                  <SectionCard title="Update Status" icon={RefreshCw}>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {(['pending', 'in_progress', 'completed', 'rejected'] as const).map((status) => {
                        const c = statusConfig[status];
                        const Icon = c.icon;
                        const active = req.status === status;
                        return (
                          <button
                            key={status}
                            disabled={isUpdating || active}
                            onClick={() => setPendingStatus(status)}
                            className={cn(
                              "relative flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed",
                              active ? `${c.color} border-transparent shadow-md` : 'border-border bg-card hover:border-primary/40'
                            )}
                          >
                            <Icon className={cn("h-5 w-5", active ? '' : 'text-muted-foreground')} />
                            <span className="text-xs font-semibold">{c.label}</span>
                            {active && <span className="absolute top-1 right-1 text-[9px]">●</span>}
                          </button>
                        );
                      })}
                    </div>
                  </SectionCard>

                  {/* Admin Remarks */}
                  <SectionCard title="Admin Remarks" icon={MessageSquare}>
                    <Textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="Write notes, instructions, or rejection reason for this request..."
                      rows={4}
                      className="resize-none"
                    />
                    {req.admin_notes && req.admin_notes !== adminNotes && (
                      <p className="text-[11px] text-muted-foreground mt-2">
                        Previous: <span className="italic">"{req.admin_notes}"</span>
                      </p>
                    )}
                  </SectionCard>
                </div>

                {/* Sticky Action Bar */}
                <div className="border-t bg-card/95 backdrop-blur px-4 sm:px-6 py-3 flex flex-wrap items-center gap-2 justify-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive mr-auto">
                        <Trash2 className="h-4 w-4 mr-1" /> Delete
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this request?</AlertDialogTitle>
                        <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteRequest(req.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>

                  <Button variant="outline" size="sm" onClick={() => setSelectedRequest(null)}>
                    <X className="h-4 w-4 mr-1" /> Close
                  </Button>
                  <Button variant="secondary" size="sm" onClick={saveRemarksOnly} disabled={isUpdating}>
                    {isUpdating ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                    Save Remarks
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setPendingStatus('rejected')}
                    disabled={isUpdating || req.status === 'rejected'}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                  <Button
                    size="sm"
                    className="bg-success hover:bg-success/90 text-success-foreground"
                    onClick={() => setPendingStatus('completed')}
                    disabled={isUpdating || req.status === 'completed'}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Approve
                  </Button>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Status change confirmation */}
      <AlertDialog open={!!pendingStatus} onOpenChange={(o) => { if (!o) { setPendingStatus(null); setRejectReason(''); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingStatus === 'completed' && 'Approve this request?'}
              {pendingStatus === 'rejected' && 'Reject this request?'}
              {pendingStatus === 'in_progress' && 'Mark as processing?'}
              {pendingStatus === 'pending' && 'Set status to pending?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingStatus === 'completed' && 'The applicant will be notified that their request has been approved. A reference number will be generated.'}
              {pendingStatus === 'rejected' && 'Please provide a reason. This will be saved as the admin remark and visible to the applicant.'}
              {(pendingStatus === 'pending' || pendingStatus === 'in_progress') && 'The status of this request will be updated immediately.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {pendingStatus === 'rejected' && (
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)..."
              rows={3}
              className="mt-2"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isUpdating}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isUpdating || (pendingStatus === 'rejected' && !rejectReason.trim())}
              onClick={() => {
                if (!selectedRequest || !pendingStatus) return;
                const notes = pendingStatus === 'rejected'
                  ? (adminNotes ? `${adminNotes}\n\nRejection reason: ${rejectReason}` : `Rejection reason: ${rejectReason}`)
                  : adminNotes;
                if (pendingStatus === 'rejected') setAdminNotes(notes);
                updateStatus(selectedRequest.id, pendingStatus, notes, true);
              }}
            >
              {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirm'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminRequests;
