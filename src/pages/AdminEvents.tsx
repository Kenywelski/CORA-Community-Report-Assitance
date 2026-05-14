import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, CalendarDays, MapPin, Users, Target, User } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

type EventRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  event_date: string;
  end_date: string | null;
  is_active: boolean;
  purpose: string | null;
  objective: string | null;
  target_participants: string | null;
  organizer_name: string | null;
  organizer_contact: string | null;
  status: string;
  schedule_details: string | null;
};

const STATUS = ['upcoming', 'ongoing', 'completed', 'cancelled', 'postponed'];
const statusColor: Record<string, string> = {
  upcoming: 'bg-primary/10 text-primary',
  ongoing: 'bg-success/10 text-success',
  completed: 'bg-muted text-muted-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  postponed: 'bg-warning/10 text-warning',
};

const empty = {
  title: '', description: '', location: '', event_date: '', end_date: '',
  purpose: '', objective: '', target_participants: '', organizer_name: '',
  organizer_contact: '', status: 'upcoming', schedule_details: '', is_active: true,
};

const AdminEvents = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [form, setForm] = useState({ ...empty });

  const { data: events, isLoading } = useQuery({
    queryKey: ['admin-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events').select('*').order('event_date', { ascending: false });
      if (error) throw error;
      return data as unknown as EventRow[];
    },
  });

  useEffect(() => {
    const channel = supabase.channel('admin-events-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'events' },
        () => qc.invalidateQueries({ queryKey: ['admin-events'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const close = () => {
    setOpen(false); setEditing(null); setForm({ ...empty });
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title required');
      if (!form.event_date) throw new Error('Event date required');
      const payload = {
        title: form.title,
        description: form.description || null,
        location: form.location || null,
        event_date: new Date(form.event_date).toISOString(),
        end_date: form.end_date ? new Date(form.end_date).toISOString() : null,
        purpose: form.purpose || null,
        objective: form.objective || null,
        target_participants: form.target_participants || null,
        organizer_name: form.organizer_name || null,
        organizer_contact: form.organizer_contact || null,
        status: form.status,
        schedule_details: form.schedule_details || null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('events').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase.from('events').insert({ ...payload, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? 'Event updated' : 'Event created'); close(); },
    onError: (e: Error) => toast.error(e.message || 'Failed to save event'),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('events').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Event deleted'),
    onError: () => toast.error('Failed to delete'),
  });

  const edit = (ev: EventRow) => {
    setEditing(ev);
    setForm({
      title: ev.title,
      description: ev.description || '',
      location: ev.location || '',
      event_date: ev.event_date ? new Date(ev.event_date).toISOString().slice(0, 16) : '',
      end_date: ev.end_date ? new Date(ev.end_date).toISOString().slice(0, 16) : '',
      purpose: ev.purpose || '',
      objective: ev.objective || '',
      target_participants: ev.target_participants || '',
      organizer_name: ev.organizer_name || '',
      organizer_contact: ev.organizer_contact || '',
      status: ev.status || 'upcoming',
      schedule_details: ev.schedule_details || '',
      is_active: ev.is_active,
    });
    setOpen(true);
  };

  return (
    <AdminLayout title="Events" subtitle="Manage municipal events with full details">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : close()}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Event</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editing ? 'Edit Event' : 'Create Event'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title *</label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Start Date *</label>
                    <Input type="datetime-local" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <Input type="datetime-local" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Location</label>
                  <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g., Municipal Plaza, Cortes" />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Event Purpose</label>
                  <Textarea rows={2} value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="Why is this event being held?" />
                </div>
                <div>
                  <label className="text-sm font-medium">Function / Objective</label>
                  <Textarea rows={2} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} placeholder="What this event aims to achieve" />
                </div>
                <div>
                  <label className="text-sm font-medium">Target Participants</label>
                  <Input value={form.target_participants} onChange={(e) => setForm({ ...form, target_participants: e.target.value })} placeholder="e.g., Youth, Senior Citizens, Barangay Officials" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Organizer Name</label>
                    <Input value={form.organizer_name} onChange={(e) => setForm({ ...form, organizer_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Organizer Contact</label>
                    <Input value={form.organizer_contact} onChange={(e) => setForm({ ...form, organizer_contact: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">Schedule Details</label>
                  <Textarea rows={2} value={form.schedule_details} onChange={(e) => setForm({ ...form, schedule_details: e.target.value })} placeholder="e.g., 8:00 AM Registration, 9:00 AM Opening..." />
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-sm font-medium">Status</label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">Active</span>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button type="button" variant="outline" onClick={close}>Cancel</Button>
                  <Button type="submit" disabled={save.isPending}>{editing ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : !events?.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No events yet.</CardContent></Card>
        ) : (
          <div className="grid gap-4">
            {events.map((ev) => (
              <Card key={ev.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-accent/10 text-accent">
                        <CalendarDays className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{ev.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(ev.event_date), 'PPP p')}
                          {ev.end_date && ` → ${format(new Date(ev.end_date), 'PPP p')}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={statusColor[ev.status] || ''}>{ev.status}</Badge>
                      <Badge variant={ev.is_active ? 'default' : 'secondary'}>{ev.is_active ? 'Active' : 'Inactive'}</Badge>
                      <Button variant="ghost" size="icon-sm" onClick={() => edit(ev)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => del.mutate(ev.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  {ev.location && <p className="flex items-center gap-2"><MapPin className="h-3 w-3" /> {ev.location}</p>}
                  {ev.purpose && <p><span className="font-medium">Purpose:</span> {ev.purpose}</p>}
                  {ev.objective && <p className="flex items-start gap-2"><Target className="h-3 w-3 mt-1" /> {ev.objective}</p>}
                  {ev.target_participants && <p className="flex items-center gap-2"><Users className="h-3 w-3" /> {ev.target_participants}</p>}
                  {ev.organizer_name && <p className="flex items-center gap-2"><User className="h-3 w-3" /> {ev.organizer_name}{ev.organizer_contact && ` • ${ev.organizer_contact}`}</p>}
                  {ev.schedule_details && <p className="text-muted-foreground whitespace-pre-line">{ev.schedule_details}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEvents;
