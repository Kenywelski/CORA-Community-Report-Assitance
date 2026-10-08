import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Phone, MapPin, Clock, Siren } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Contact = {
  id: string;
  department_name: string;
  contact_number: string;
  address: string | null;
  availability: string;
  service_type: string;
  is_active: boolean;
  sort_order: number;
};

const SERVICE_TYPES = ['Police', 'Fire', 'Disaster/Rescue', 'Health/Hospital', 'Barangay', 'Government', 'Maritime', 'Other'];
const empty = { department_name: '', contact_number: '', address: '', availability: '24/7', service_type: 'Police', is_active: true, sort_order: 0 };

const AdminEmergencyContacts = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...empty });

  const { data: contacts, isLoading } = useQuery({
    queryKey: ['admin-emergency-contacts'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('emergency_contacts').select('*')
        .order('sort_order', { ascending: true })
        .order('department_name', { ascending: true });
      if (error) throw error;
      return data as Contact[];
    },
  });

  useEffect(() => {
    const channel = supabase.channel('admin-ec-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergency_contacts' },
        () => qc.invalidateQueries({ queryKey: ['admin-emergency-contacts'] }))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const close = () => { setOpen(false); setEditing(null); setForm({ ...empty }); };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.department_name.trim() || !form.contact_number.trim()) throw new Error('Name & contact required');
      const payload = { ...form, address: form.address || null };
      if (editing) {
        const { error } = await (supabase as any).from('emergency_contacts').update(payload).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await (supabase as any).from('emergency_contacts').insert({ ...payload, created_by: u.user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(editing ? 'Contact updated' : 'Contact added'); close(); },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from('emergency_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => toast.success('Contact deleted'),
    onError: () => toast.error('Failed to delete'),
  });

  const edit = (c: Contact) => {
    setEditing(c);
    setForm({
      department_name: c.department_name, contact_number: c.contact_number,
      address: c.address || '', availability: c.availability,
      service_type: c.service_type, is_active: c.is_active, sort_order: c.sort_order,
    });
    setOpen(true);
  };

  return (
    <AdminLayout title="Emergency Contacts" subtitle="Manage emergency contacts for Barangay Purisima, Tago">
      <div className="space-y-6">
        <div className="flex justify-end">
          <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : close()}>
            <DialogTrigger asChild>
              <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-2" />New Contact</Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader><DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Department Name *</label>
                  <Input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium">Contact Number *</label>
                  <Input value={form.contact_number} onChange={(e) => setForm({ ...form, contact_number: e.target.value })} placeholder="e.g., 117 or (086) 000-0000" />
                </div>
                <div>
                  <label className="text-sm font-medium">Address / Location</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Service Type</label>
                    <Select value={form.service_type} onValueChange={(v) => setForm({ ...form, service_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Availability</label>
                    <Input value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} placeholder="24/7" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 items-end">
                  <div>
                    <label className="text-sm font-medium">Sort Order</label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
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
        ) : !contacts?.length ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">No emergency contacts yet.</CardContent></Card>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {contacts.map((c) => (
              <Card key={c.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-xl bg-destructive/10 text-destructive">
                        <Siren className="h-4 w-4" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{c.department_name}</CardTitle>
                        <Badge variant="secondary" className="mt-1">{c.service_type}</Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={c.is_active ? 'default' : 'secondary'}>{c.is_active ? 'On' : 'Off'}</Badge>
                      <Button variant="ghost" size="icon-sm" onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon-sm" className="text-destructive" onClick={() => del.mutate(c.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <p className="flex items-center gap-2 font-semibold"><Phone className="h-3 w-3" />{c.contact_number}</p>
                  {c.address && <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3 w-3" />{c.address}</p>}
                  <p className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3 w-3" />{c.availability}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEmergencyContacts;
