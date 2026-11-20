import { useEffect, useState } from 'react';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { getOfficeAppearance } from '@/features/barangay-offices/officeAppearance';
import { toast } from 'sonner';
import {
  BARANGAY_OFFICE_NAMES,
  type BarangayOfficeOfficial,
  type BarangayOfficeItem,
  deleteBarangayOffice,
  loadBarangayOffices,
  normalizeBarangayOfficeName,
  saveBarangayOffice,
} from '@/lib/barangayContentStore';
import { supabase } from '@/integrations/supabase/client';

interface OfficeFormOfficial extends BarangayOfficeOfficial {
  key: string;
}

let nextOfficialKey = 0;

const createOfficeFormOfficial = (): OfficeFormOfficial => ({
  key: `office-official-${Date.now()}-${nextOfficialKey++}`,
  name: '',
  position: '',
});

const emptyOfficeForm = {
  id: '',
  name: '',
  nameMode: 'standard' as 'standard' | 'custom',
  customName: '',
  officials: [] as OfficeFormOfficial[],
  responsibilities: '',
  phone: '',
  email: '',
  location: '',
  hours: '',
  is_active: true,
};

const AdminOffices = () => {
  const [offices, setOffices] = useState<BarangayOfficeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [officeFilter, setOfficeFilter] = useState<'all' | 'active' | 'hidden'>(
    'all'
  );
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyOfficeForm);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const data = await loadBarangayOffices();
        if (mounted) setOffices(data);
      } catch (error) {
        console.error('Failed to load barangay offices:', error);
        if (mounted) toast.error('Failed to load barangay offices');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void refresh();
    const channel = supabase
      .channel('admin-offices-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'knowledge_base' },
        () => void refresh(),
      )
      .subscribe();

    return () => {
      mounted = false;
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleOpenCreate = () => {
    setForm(emptyOfficeForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (office: BarangayOfficeItem) => {
    const standardName = BARANGAY_OFFICE_NAMES.find(
      (name) =>
        normalizeBarangayOfficeName(name) ===
        normalizeBarangayOfficeName(office.name),
    );
    setForm({
      id: office.id,
      name: standardName ?? '',
      nameMode: standardName ? 'standard' : 'custom',
      customName: standardName ? '' : office.name,
      officials: office.officials.map((official, index) => ({
        ...official,
        key: `${office.id}-official-${index}`,
      })),
      responsibilities: office.responsibilities,
      phone: office.phone,
      email: office.email,
      location: office.location,
      hours: office.hours,
      is_active: office.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const officeName =
      form.nameMode === 'custom' ? form.customName.trim() : form.name.trim();
    if (!officeName) {
      toast.error('Please fill in the Office Name.');
      return;
    }

    if (
      form.officials.some(
        (official) => !official.name.trim() || !official.position.trim(),
      )
    ) {
      toast.error('Complete each official name and position, or remove the row.');
      return;
    }

    const enteredOfficials = form.officials.map(({ name, position }) => ({
      name,
      position,
    }));

    setSaving(true);
    try {
      const updated = await saveBarangayOffice({
        id: form.id || undefined,
        name: officeName,
        officials: enteredOfficials.map(({ name, position }) => ({
          name,
          position,
        })),
        responsibilities: form.responsibilities,
        phone: form.phone,
        email: form.email,
        location: form.location,
        hours: form.hours,
        is_active: form.is_active,
      });
      setOffices(updated);
      setDialogOpen(false);
      toast.success(form.id ? 'Barangay office updated' : 'Barangay office added');
    } catch (error) {
      console.error('Failed to save barangay office:', error);
      toast.error(
        error instanceof Error ? error.message : 'Failed to save barangay office',
      );
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (office: BarangayOfficeItem) => {
    try {
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
    } catch (error) {
      console.error('Failed to update barangay office visibility:', error);
      toast.error('Failed to update barangay office');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const updated = await deleteBarangayOffice(deleteId);
      setOffices(updated);
      setDeleteId(null);
      toast.success('Barangay office deleted');
    } catch (error) {
      console.error('Failed to delete barangay office:', error);
      toast.error('Failed to delete barangay office');
    }
  };

  const filteredOffices = offices.filter((o) => {
    if (officeFilter === 'active' && !o.is_active) return false;
    if (officeFilter === 'hidden' && o.is_active) return false;

    const q = search.trim().toLowerCase();
    if (!q) return true;
    const officialDetails = o.officials
      .map((official) => `${official.name} ${official.position}`)
      .join(' ');
    return `${o.name} ${officialDetails} ${o.responsibilities}`
      .toLowerCase()
      .includes(q);
  });

  const isOfficeNameTaken = (name: string) =>
    offices.some(
      (office) =>
        office.id !== form.id &&
        normalizeBarangayOfficeName(office.name) ===
          normalizeBarangayOfficeName(name),
    );

  return (
    <AdminLayout
      title="Barangay Offices"
      subtitle="Manage office names, assigned officials, responsibilities, and directory visibility."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search office, official, or responsibility..."
              className="h-10 rounded-xl border-border bg-card pl-10 text-xs shadow-sm placeholder:text-muted-foreground"
            />
          </div>

          <Select
            value={officeFilter}
            onValueChange={(value) =>
              setOfficeFilter(value as 'all' | 'active' | 'hidden')
            }
          >
            <SelectTrigger className="h-10 min-w-0 rounded-xl border-border bg-card px-3 text-xs font-semibold shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <LayoutGrid className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue className="truncate" />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Offices</SelectItem>
              <SelectItem value="active">Active Offices</SelectItem>
              <SelectItem value="hidden">Hidden Offices</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleOpenCreate}
            className="h-10 w-full min-w-0 gap-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold shadow-[0_6px_14px_rgba(15,128,111,0.22)] lg:w-auto lg:gap-2 lg:px-5"
          >
            <Plus className="h-4 w-4" />
            <span className="sm:hidden">Add Office</span>
            <span className="hidden sm:inline">Add Barangay Office</span>
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredOffices.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-muted-foreground">
            <Building2 className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-semibold">No barangay offices found</p>
            <p className="mt-1 text-sm">
              Try a different search or filter, or add a new office.
            </p>
          </div>
        ) : (
          <section aria-label="Barangay offices">
            <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_86px_76px_88px] items-center gap-3 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Office</span>
              <span>Barangay Officials</span>
              <span>Office Responsibilities</span>
              <span>Status</span>
              <span className="text-center">Visible</span>
              <span className="text-center">Actions</span>
            </div>
            <div className="divide-y divide-border/70 border-b border-border/70">
              {filteredOffices.map((office) => {
                const appearance = getOfficeAppearance(office.name);
                const Icon = appearance.icon;
                return (
                  <div
                    key={office.id}
                    className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,1.8fr)_86px_76px_88px] lg:items-center"
                  >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${appearance.iconClass}`}>
                      <Icon className="h-5 w-5" strokeWidth={2.2} />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-bold leading-snug text-foreground">
                        {office.name}
                      </p>
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Barangay Officials
                    </p>
                    {office.officials.length ? (
                      <div className="space-y-1.5 text-xs leading-relaxed">
                        {office.officials.slice(0, 3).map((official) => (
                          <p key={`${official.name}-${official.position}`} className="break-words">
                            <span className="font-semibold text-foreground">{official.name}</span>
                            <span className="text-muted-foreground"> · {official.position}</span>
                          </p>
                        ))}
                        {office.officials.length > 3 && (
                          <p className="text-muted-foreground">
                            +{office.officials.length - 3} more
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">No officials assigned.</p>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Office Responsibilities
                    </p>
                    <p className="line-clamp-3 break-words text-xs leading-relaxed text-foreground">
                      {office.responsibilities || 'No responsibilities listed.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-start">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Status
                    </span>
                    <Badge
                      className={`rounded-full border-0 px-2.5 py-1 text-xs font-bold ${
                        office.is_active
                          ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                          : 'bg-muted text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      {office.is_active ? 'Active' : 'Hidden'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between gap-3 lg:justify-center">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Visible to residents
                    </span>
                    <Switch
                      checked={office.is_active}
                      onCheckedChange={() => handleToggleActive(office)}
                      aria-label={`Toggle visibility for ${office.name}`}
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                      Actions
                    </span>
                    <AdminActionButton
                      action="edit"
                      icon={Pencil}
                      onClick={() => handleOpenEdit(office)}
                      aria-label={`Edit ${office.name}`}
                    />
                    <AdminActionButton
                      action="delete"
                      icon={Trash2}
                      onClick={() => setDeleteId(office.id)}
                      aria-label={`Delete ${office.name}`}
                    />
                  </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="flex max-h-[calc(100dvh-2rem)] max-w-lg flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="shrink-0 border-b px-4 pb-4 pt-5 text-left sm:px-6 sm:pt-6">
              <DialogTitle>
                {form.id ? 'Edit Barangay Office' : 'Add Barangay Office'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="space-y-1.5">
                  <Label htmlFor="office-name">Office Name *</Label>
                  <Select
                    value={form.nameMode === 'custom' ? 'custom-office' : form.name}
                    onValueChange={(value) => {
                      if (value === 'custom-office') {
                        setForm({
                          ...form,
                          name: '',
                          nameMode: 'custom',
                          customName: '',
                        });
                      } else {
                        setForm({
                          ...form,
                          name: value,
                          nameMode: 'standard',
                          customName: '',
                        });
                      }
                    }}
                  >
                    <SelectTrigger id="office-name" className="w-full">
                      <SelectValue placeholder="Select an office" />
                    </SelectTrigger>
                    <SelectContent>
                      {BARANGAY_OFFICE_NAMES.map((name) => {
                        const alreadyAssigned = isOfficeNameTaken(name);
                        return (
                          <SelectItem
                            key={name}
                            value={name}
                            disabled={alreadyAssigned}
                          >
                            {name}
                            {alreadyAssigned ? ' — already added' : ''}
                          </SelectItem>
                        );
                      })}
                      <SelectItem value="custom-office">Other Office</SelectItem>
                    </SelectContent>
                  </Select>
                  {form.nameMode === 'custom' && (
                    <Input
                      id="office-name-custom"
                      value={form.customName}
                      onChange={(event) =>
                        setForm({ ...form, customName: event.target.value })
                      }
                      placeholder="Enter the barangay office name"
                    />
                  )}
                  <p className="text-xs text-muted-foreground">
                    Choose one office so its officials are kept separate from the others.
                  </p>
                </div>

                <section className="space-y-3 rounded-xl border border-border/50 p-3.5">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      Barangay Officials
                    </h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5"
                      onClick={() =>
                        setForm({
                          ...form,
                          officials: [
                            ...form.officials,
                            createOfficeFormOfficial(),
                          ],
                        })
                      }
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add Official
                    </Button>
                  </div>

                  {form.officials.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      No officials added.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {form.officials.map((official, index) => (
                        <div
                          key={official.key}
                          className="grid gap-3 rounded-lg bg-muted/25 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                        >
                          <div className="space-y-1.5">
                            <Label htmlFor={`${official.key}-name`}>
                              Official Name
                            </Label>
                            <Input
                              id={`${official.key}-name`}
                              value={official.name}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  officials: form.officials.map((item) =>
                                    item.key === official.key
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="Enter official's full name"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor={`${official.key}-position`}>
                              Official Position
                            </Label>
                            <Input
                              id={`${official.key}-position`}
                              value={official.position}
                              onChange={(event) =>
                                setForm({
                                  ...form,
                                  officials: form.officials.map((item) =>
                                    item.key === official.key
                                      ? {
                                          ...item,
                                          position: event.target.value,
                                        }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="Enter actual position"
                            />
                          </div>
                          <div className="flex items-end sm:pb-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              aria-label={`Remove official ${index + 1}`}
                              onClick={() =>
                                setForm({
                                  ...form,
                                  officials: form.officials.filter(
                                    (item) => item.key !== official.key,
                                  ),
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="space-y-1.5">
                  <Label htmlFor="office-responsibilities">
                    Office Responsibilities
                  </Label>
                  <Textarea
                    id="office-responsibilities"
                    value={form.responsibilities}
                    onChange={(e) =>
                      setForm({ ...form, responsibilities: e.target.value })
                    }
                    placeholder="Describe the office's duties and services"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border p-3">
                  <Label htmlFor="office-visible" className="text-sm font-medium">
                    Show in Barangay Directory
                  </Label>
                  <Switch
                    id="office-visible"
                    checked={form.is_active}
                    onCheckedChange={(v) => setForm({ ...form, is_active: v })}
                  />
                </div>
              </div>

              <DialogFooter className="shrink-0 border-t bg-background px-6 py-4 gap-2 sm:space-x-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    'Save Office'
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

export default AdminOffices;
