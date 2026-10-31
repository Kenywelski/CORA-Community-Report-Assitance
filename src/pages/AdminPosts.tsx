import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Building2,
  Clock,
  Edit2,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Plus,
  Search,
  Trash2,
  UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type BarangayOfficeItem,
  deleteBarangayOffice,
  loadBarangayOffices,
  saveBarangayOffice,
} from '@/lib/barangayContentStore';

const emptyOfficeForm = {
  id: '',
  name: '',
  head_or_role: '',
  phone: '',
  email: '',
  location: 'Barangay Hall, Barangay Purisima, Tago, Surigao del Sur',
  hours: 'Monday – Friday, 8:00 AM – 5:00 PM',
  services_offered: '',
  is_active: true,
};

const AdminPosts = () => {
  const [offices, setOffices] = useState<BarangayOfficeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOfficeForm);

  useEffect(() => {
    let mounted = true;
    loadBarangayOffices().then((data) => {
      if (!mounted) return;
      setOffices(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const handleOpenCreate = () => {
    setForm(emptyOfficeForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (office: BarangayOfficeItem) => {
    setForm({
      id: office.id,
      name: office.name,
      head_or_role: office.head_or_role,
      phone: office.phone,
      email: office.email,
      location: office.location,
      hours: office.hours,
      services_offered: office.services_offered,
      is_active: office.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.phone.trim() || !form.location.trim()) {
      toast.error('Please fill in the Office Name, Contact Number, and Location.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveBarangayOffice({
        id: form.id || undefined,
        name: form.name,
        head_or_role: form.head_or_role || 'Barangay Office',
        phone: form.phone,
        email: form.email || 'purisima@tago.gov.ph',
        location: form.location,
        hours: form.hours || 'Monday – Friday, 8:00 AM – 5:00 PM',
        services_offered: form.services_offered,
        is_active: form.is_active,
      });
      setOffices(updated);
      setDialogOpen(false);
      toast.success(form.id ? 'Barangay office updated' : 'Barangay office added');
    } catch {
      toast.error('Failed to save barangay office');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (office: BarangayOfficeItem) => {
    const updated = await saveBarangayOffice({
      ...office,
      is_active: !office.is_active,
    });
    setOffices(updated);
    toast.success(
      !office.is_active
        ? `${office.name} is now visible to residents`
        : `${office.name} hidden from directory`
    );
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const updated = await deleteBarangayOffice(deleteId);
    setOffices(updated);
    setDeleteId(null);
    toast.success('Barangay office deleted');
  };

  const filteredOffices = offices.filter((o) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${o.name} ${o.head_or_role} ${o.location} ${o.email} ${o.services_offered}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <AdminLayout
      title="Barangay Offices"
      subtitle="Manage official barangay offices, contact details, and operating hours for Barangay Purisima, Tago"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search office name, focal person, or services..."
              className="pl-9"
            />
          </div>

          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Barangay Office
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOffices.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <Building2 className="h-9 w-9 mx-auto mb-3 opacity-50" />
              No barangay offices found. Click &ldquo;Add Barangay Office&rdquo; to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredOffices.map((office) => (
              <Card key={office.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-base leading-snug">
                            {office.name}
                          </CardTitle>
                          <Badge variant={office.is_active ? 'default' : 'secondary'}>
                            {office.is_active ? 'Active' : 'Hidden'}
                          </Badge>
                        </div>
                        {office.head_or_role && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <UserCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                            <span>{office.head_or_role}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={office.is_active}
                        onCheckedChange={() => handleToggleActive(office)}
                        aria-label="Toggle active status"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(office)}
                        aria-label="Edit office"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(office.id)}
                        aria-label="Delete office"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2 text-sm">
                  {office.services_offered && (
                    <p className="text-xs text-muted-foreground leading-relaxed bg-muted/60 rounded-lg p-2.5">
                      {office.services_offered}
                    </p>
                  )}
                  <div className="space-y-1.5 pt-1 text-xs">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Phone className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{office.phone}</span>
                    </p>
                    {office.email && (
                      <p className="flex items-center gap-2 text-muted-foreground break-all">
                        <Mail className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span>{office.email}</span>
                      </p>
                    )}
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span>{office.location}</span>
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>{office.hours}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {form.id ? 'Edit Barangay Office' : 'Add Barangay Office'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="office-name">Office Name *</Label>
                <Input
                  id="office-name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g., Office of the Punong Barangay"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="office-head">Office Head / Focal Person</Label>
                <Input
                  id="office-head"
                  value={form.head_or_role}
                  onChange={(e) =>
                    setForm({ ...form, head_or_role: e.target.value })
                  }
                  placeholder="e.g., Barangay Secretary / BDRRMC Focal Person"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="office-phone">Contact Number *</Label>
                  <Input
                    id="office-phone"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="e.g., 0917-550-0101"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="office-email">Email Address</Label>
                  <Input
                    id="office-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="purisima@tago.gov.ph"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="office-location">Location / Purok *</Label>
                <Input
                  id="office-location"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="e.g., Barangay Hall, Purok Citrus I, Barangay Purisima"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="office-hours">Operating Hours</Label>
                <Input
                  id="office-hours"
                  value={form.hours}
                  onChange={(e) => setForm({ ...form, hours: e.target.value })}
                  placeholder="Monday – Friday, 8:00 AM – 5:00 PM"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="office-services">Services Offered</Label>
                <Textarea
                  id="office-services"
                  value={form.services_offered}
                  onChange={(e) =>
                    setForm({ ...form, services_offered: e.target.value })
                  }
                  placeholder="Describe certificates, assistance, or services handled by this office..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">
                  Visible in Resident Barangay Directory
                </span>
                <Switch
                  checked={form.is_active}
                  onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : form.id ? (
                    'Update Office'
                  ) : (
                    'Add Office'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Barangay Office?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the office from the Barangay Purisima directory.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPosts;
