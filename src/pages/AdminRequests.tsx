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

      {/* Request Details Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              {(() => {
                const items: MediaItem[] = (selectedRequest.media_urls && selectedRequest.media_urls.length > 0)
                  ? selectedRequest.media_urls.map((url, i) => ({
                      url,
                      type: ((selectedRequest.media_types?.[i] as 'image' | 'video') || (url.match(/\.(mp4|webm|mov)$/i) ? 'video' : 'image')),
                    }))
                  : selectedRequest.photo_url
                    ? [{ url: selectedRequest.photo_url, type: 'image' as const }]
                    : [];
                const firstImage = items.find((i) => i.type === 'image')?.url;
                return (
                  <>
                    {items.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground">Attached Media ({items.length})</p>
                        <MediaGallery items={items} />
                        {firstImage && <ImageAnalysis imageUrl={firstImage} />}
                      </div>
                    )}
                  </>
                );
              })()}

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-muted-foreground">Category</p>
                  <p className="font-medium">{selectedRequest.category}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Title</p>
                  <p className="font-medium">{selectedRequest.title}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Description</p>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
                {selectedRequest.location && (
                  <div>
                    <p className="text-xs text-muted-foreground">Location</p>
                    <p className="text-sm flex items-center gap-1">
                      <MapPin className="h-4 w-4 text-primary" />
                      {selectedRequest.location}
                    </p>
                  </div>
                )}
                {selectedRequest.latitude != null && selectedRequest.longitude != null && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Pinned Map Location</p>
                    <LocationPicker
                      readOnly
                      value={{ lat: Number(selectedRequest.latitude), lng: Number(selectedRequest.longitude) }}
                      onChange={() => {}}
                      height="220px"
                    />
                  </div>
                )}
                <div>
                  <p className="text-xs text-muted-foreground">Current Status</p>
                  <Badge className={cn("mt-1", statusConfig[selectedRequest.status].color)}>
                    {statusConfig[selectedRequest.status].label}
                  </Badge>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Admin Remarks
                </label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes or remarks for this request..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium">Update Status</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['pending', 'in_progress', 'completed', 'rejected'] as const).map((status) => {
                    const config = statusConfig[status];
                    const StatusIcon = config.icon;
                    return (
                      <Button
                        key={status}
                        variant={selectedRequest.status === status ? 'default' : 'outline'}
                        size="sm"
                        className={selectedRequest.status === status ? config.color : ''}
                        onClick={() => updateStatus(selectedRequest.id, status, adminNotes)}
                        disabled={isUpdating}
                      >
                        <StatusIcon className="h-4 w-4 mr-1" />
                        {config.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            {selectedRequest && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1" /> Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this request?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteRequest(selectedRequest.id)}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            <Button variant="outline" onClick={() => setSelectedRequest(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminRequests;
