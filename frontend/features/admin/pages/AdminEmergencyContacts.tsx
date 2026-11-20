import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Pencil, Trash2, Phone, MapPin, Clock, X, Search, LayoutGrid } from 'lucide-react';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { parseEmergencyContactNumbers } from '@/features/emergency-contacts/contactNumbers';
import { getEmergencyContactAppearance } from '@/features/emergency-contacts/contactAppearance';
import { emergencyContactQueryKeys } from '@/features/emergency-contacts/queryKeys';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tables } from '@/integrations/supabase/types';

type Contact = Tables<'emergency_contacts'>;

const SERVICE_TYPES = ['Police', 'Fire', 'Disaster/Rescue', 'Health/Hospital', 'Barangay', 'Government', 'Maritime', 'Other'];
const empty = { department_name: '', contactNumbers: [''], address: '', availability: '24/7', service_type: 'Police', is_active: true, sort_order: 0 };

const AdminEmergencyContacts = () => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [form, setForm] = useState({ ...empty });
  const [search, setSearch] = useState('');
  const [contactFilter, setContactFilter] = useState<'all' | 'active' | 'inactive'>('all');

  const { data: contacts, isLoading } = useQuery({
    queryKey: emergencyContactQueryKeys.admin,
    queryFn: async () => {
      const { data, error } = await supabase
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
        () => {
          void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.admin });
          void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.resident });
          void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.landing });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const close = () => { setOpen(false); setEditing(null); setForm({ ...empty }); };

  const updateContactNumber = (index: number, value: string) => {
    setForm((current) => ({
      ...current,
      contactNumbers: current.contactNumbers.map((number, numberIndex) =>
        numberIndex === index ? value : number,
      ),
    }));
  };

  const addContactNumber = () => {
    setForm((current) => ({ ...current, contactNumbers: [...current.contactNumbers, ''] }));
  };

  const removeContactNumber = (index: number) => {
    setForm((current) => ({
      ...current,
      contactNumbers: current.contactNumbers.length === 1
        ? ['']
        : current.contactNumbers.filter((_, numberIndex) => numberIndex !== index),
    }));
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!form.department_name.trim()) throw new Error('Department name is required');
      const payload = {
        department_name: form.department_name.trim(),
        contact_number: form.contactNumbers.map((number) => number.trim()).filter(Boolean).join('\n'),
        address: form.address.trim() || null,
        availability: form.availability,
        service_type: form.service_type,
        is_active: form.is_active,
        sort_order: form.sort_order,
      };
      if (editing) {
        const { error } = await supabase
          .from('emergency_contacts')
          .update(payload)
          .eq('id', editing.id)
          .select('id')
          .single();
        if (error) throw error;
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('emergency_contacts')
          .insert({ ...payload, created_by: u.user?.id })
          .select('id')
          .single();
        if (error) throw error;
      }
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.admin });
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.resident });
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.landing });
      toast.success(editing ? 'Contact updated' : 'Contact added');
      close();
    },
    onError: (e: Error) => toast.error(e.message || 'Failed to save'),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('emergency_contacts')
        .delete()
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.admin });
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.resident });
      void qc.invalidateQueries({ queryKey: emergencyContactQueryKeys.landing });
      toast.success('Contact deleted');
    },
    onError: () => toast.error('Failed to delete'),
  });

  const edit = (c: Contact) => {
    const contactNumbers = parseEmergencyContactNumbers(c.contact_number);
    setEditing(c);
    setForm({
      department_name: c.department_name,
      contactNumbers: contactNumbers.length ? contactNumbers : [''],
      address: c.address || '', availability: c.availability,
      service_type: c.service_type, is_active: c.is_active, sort_order: c.sort_order,
    });
    setOpen(true);
  };

  const filteredContacts = (contacts ?? []).filter((contact) => {
    if (contactFilter === 'active' && !contact.is_active) return false;
    if (contactFilter === 'inactive' && contact.is_active) return false;

    const searchTerm = search.trim().toLowerCase();
    if (!searchTerm) return true;
    return [
      contact.department_name,
      contact.service_type,
      contact.contact_number,
      contact.address ?? '',
      contact.availability,
    ]
      .join(' ')
      .toLowerCase()
      .includes(searchTerm);
  });

  return (
    <AdminLayout title="Emergency Contacts" subtitle="Manage emergency contacts for Barangay Purisima, Tago">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search service, number, or location..."
              aria-label="Search emergency contacts"
              className="h-10 rounded-xl border-border bg-card pl-10 text-xs shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          <Select
            value={contactFilter}
            onValueChange={(value) => setContactFilter(value as 'all' | 'active' | 'inactive')}
          >
            <SelectTrigger className="h-10 min-w-0 rounded-xl border-border bg-card px-3 text-xs font-semibold shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <LayoutGrid className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue aria-label="Emergency contact status filter" />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Contacts</SelectItem>
              <SelectItem value="active">Active Contacts</SelectItem>
              <SelectItem value="inactive">Inactive Contacts</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={open} onOpenChange={(o) => o ? setOpen(true) : close()}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setOpen(true)}
                className="h-10 w-full min-w-0 gap-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold shadow-[0_6px_14px_rgba(15,128,111,0.22)] lg:w-auto lg:gap-2 lg:px-5"
              >
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Add Contact</span>
                <span className="hidden sm:inline">New Contact</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg overflow-y-auto sm:max-h-[calc(100dvh-2rem)] sm:w-full">
              <DialogHeader><DialogTitle>{editing ? 'Edit Contact' : 'Add Contact'}</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Department Name *</label>
                  <Input value={form.department_name} onChange={(e) => setForm({ ...form, department_name: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">Phone Numbers</span>
                    <Button type="button" variant="outline" size="sm" onClick={addContactNumber}>
                      <Plus className="mr-1 h-4 w-4" />
                      Add number
                    </Button>
                  </div>
                  {form.contactNumbers.map((number, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        id={`emergency-contact-number-${index}`}
                        value={number}
                        onChange={(event) => updateContactNumber(index, event.target.value)}
                        aria-label={`Phone number ${index + 1}`}
                        placeholder="e.g. 0912 345 6789"
                      />
                      {form.contactNumbers.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeContactNumber(index)}
                          aria-label={`Remove phone number ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <div>
                  <label className="text-sm font-medium">Address / Location</label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
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
                <div className="grid grid-cols-2 items-end gap-2 sm:gap-3">
                  <div>
                    <label className="text-sm font-medium">Sort Order</label>
                    <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <span className="text-sm font-medium">Active</span>
                    <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                  </div>
                </div>
                <div className="flex flex-col-reverse justify-end gap-2 pt-2 sm:flex-row sm:gap-2">
                  <Button type="button" variant="ghost" className="flex-1" onClick={close}>Cancel</Button>
                  <Button type="submit" className="flex-1" disabled={save.isPending}>{editing ? 'Update' : 'Create'}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div role="status" className="flex justify-center py-14 text-sm text-muted-foreground">Loading...</div>
        ) : filteredContacts.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-sm text-muted-foreground">
            {contacts?.length
              ? 'No emergency contacts match your search or status filter.'
              : 'No emergency contacts yet.'}
          </div>
        ) : (
          <section aria-label="Emergency contacts">
              <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(120px,1fr)_minmax(0,1.2fr)_64px_88px] items-center gap-3 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Service</span>
                <span>Phone numbers</span>
                <span>Location &amp; hours</span>
                <span className="text-center">Status</span>
                <span className="text-center">Actions</span>
              </div>
              <div className="divide-y divide-border/70 border-b border-border/70">
                {filteredContacts.map((c) => {
                  const appearance = getEmergencyContactAppearance(c.department_name, c.service_type);
                  const Icon = appearance.icon;
                  const contactNumbers = parseEmergencyContactNumbers(c.contact_number);
                  return (
                    <div
                      key={c.id}
                      className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.3fr)_minmax(120px,1fr)_minmax(0,1.2fr)_64px_88px] lg:items-center"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${appearance.iconClass}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <h2 className="break-words text-sm font-bold leading-snug text-foreground">
                            {c.department_name}
                          </h2>
                          <Badge variant="secondary" className="mt-1">{c.service_type}</Badge>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Phone numbers
                        </p>
                        <div className="space-y-1 text-sm">
                          {contactNumbers.length ? (
                            contactNumbers.map((number, index) => (
                              <p key={`${number}-${index}`} className="flex min-w-0 items-center gap-2 font-semibold">
                                <Phone className="h-3.5 w-3.5 shrink-0 text-primary" />
                                <span className="break-all">{number}</span>
                              </p>
                            ))
                          ) : (
                            <p className="text-muted-foreground">No number available</p>
                          )}
                        </div>
                      </div>

                      <div className="min-w-0 text-xs text-muted-foreground">
                        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide lg:hidden">
                          Location &amp; hours
                        </p>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 lg:flex-col lg:gap-1">
                          {c.address && (
                            <span className="inline-flex min-w-0 items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 shrink-0" />
                              <span className="break-words">{c.address}</span>
                            </span>
                          )}
                          <span className="inline-flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {c.availability}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between gap-3 lg:justify-center">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Status
                        </span>
                        <Badge
                          className={`rounded-full border-0 px-2.5 py-1 text-xs font-bold ${
                            c.is_active
                              ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                              : 'bg-muted text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          {c.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-end gap-2">
                        <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                          Actions
                        </span>
                        <AdminActionButton
                          action="edit"
                          icon={Pencil}
                          onClick={() => edit(c)}
                          aria-label={`Edit ${c.department_name}`}
                        />
                        <AdminActionButton
                          action="delete"
                          icon={Trash2}
                          onClick={() => del.mutate(c.id)}
                          aria-label={`Delete ${c.department_name}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
          </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminEmergencyContacts;
