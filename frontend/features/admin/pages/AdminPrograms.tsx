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
  CalendarDays,
  Clock,
  LayoutGrid,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { getProgramAppearance } from '@/features/barangay-programs/programAppearance';
import { toast } from 'sonner';
import {
  BARANGAY_PROGRAM_GROUPS,
  type BarangayProgramGroup,
  type BarangayProgramItem,
  deleteBarangayProgram,
  loadBarangayPrograms,
  saveBarangayProgram,
} from '@/lib/barangayContentStore';
import { supabase } from '@/integrations/supabase/client';

const PROGRAM_STATUSES: Exclude<BarangayProgramItem['status'], 'Not set'>[] = [
  'Upcoming',
  'Ongoing',
  'For Verification',
  'Completed',
  'Cancelled',
];

const emptyProgramForm: {
  id: string;
  title: string;
  description: string;
  schedule: string;
  location: string;
  program_group: BarangayProgramGroup | '';
  status: BarangayProgramItem['status'] | '';
  is_active: boolean;
} = {
  id: '',
  title: '',
  description: '',
  schedule: '',
  location: '',
  program_group: '',
  status: '',
  is_active: true,
};

const AdminPrograms = () => {
  const [programs, setPrograms] = useState<BarangayProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState<
    | 'all'
    | 'upcoming'
    | 'ongoing'
    | 'for verification'
    | 'completed'
    | 'cancelled'
    | 'hidden'
  >('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProgramForm);

  useEffect(() => {
    let mounted = true;
    const refresh = async () => {
      try {
        const data = await loadBarangayPrograms();
        if (mounted) setPrograms(data);
      } catch (error) {
        console.error('Failed to load barangay programs:', error);
        if (mounted) toast.error('Failed to load barangay programs');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void refresh();
    const channel = supabase
      .channel('admin-programs-sync')
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
    setForm(emptyProgramForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (program: BarangayProgramItem) => {
    setForm({
      id: program.id,
      title: program.title,
      description: program.description,
      schedule: program.schedule,
      location: program.location,
      program_group: program.program_group ?? '',
      status: program.status === 'Not set' ? '' : program.status,
      is_active: program.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !form.title.trim() ||
      !form.schedule.trim() ||
      !form.description.trim()
    ) {
      toast.error('Please fill in the Program Title, Schedule, and Description.');
      return;
    }

    if (!form.status || form.status === 'Not set') {
      toast.error('Please select the program status.');
      return;
    }

    if (!form.program_group) {
      toast.error('Please select a Program Group.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveBarangayProgram({
        id: form.id || undefined,
        title: form.title,
        description: form.description,
        schedule: form.schedule,
        location: form.location,
        program_group: form.program_group,
        status: form.status,
        is_active: form.is_active,
      });
      setPrograms(updated);
      setDialogOpen(false);
      toast.success(
        form.id ? 'Barangay program updated' : 'Barangay program added'
      );
    } catch {
      toast.error('Failed to save barangay program');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (program: BarangayProgramItem) => {
    try {
      const updated = await saveBarangayProgram({
        ...program,
        is_active: !program.is_active,
      });
      setPrograms(updated);
      toast.success(
        !program.is_active
          ? `${program.title} is now visible to residents`
          : `${program.title} hidden from residents`
      );
    } catch (error) {
      console.error('Failed to update barangay program visibility:', error);
      toast.error('Failed to update barangay program');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const updated = await deleteBarangayProgram(deleteId);
      setPrograms(updated);
      setDeleteId(null);
      toast.success('Barangay program deleted');
    } catch (error) {
      console.error('Failed to delete barangay program:', error);
      toast.error('Failed to delete barangay program');
    }
  };

  const filteredPrograms = programs.filter((p) => {
    if (programFilter === 'hidden' && p.is_active) return false;
    if (programFilter !== 'all' && programFilter !== 'hidden') {
      if (!p.is_active || p.status.toLowerCase() !== programFilter) return false;
    }

    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.title} ${p.description} ${p.schedule} ${p.location} ${p.status} ${p.program_group ?? ''}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <AdminLayout
      title="Barangay Programs"
      subtitle="Manage community programs and initiatives."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs by title, schedule, or area..."
              className="h-10 rounded-xl border-border bg-card pl-10 text-xs shadow-sm placeholder:text-muted-foreground"
            />
          </div>

          <Select
            value={programFilter}
            onValueChange={(value) =>
              setProgramFilter(
                value as
                  | 'all'
                  | 'upcoming'
                  | 'ongoing'
                  | 'for verification'
                  | 'completed'
                  | 'cancelled'
                  | 'hidden'
              )
            }
          >
            <SelectTrigger className="h-10 min-w-0 rounded-xl border-border bg-card px-3 text-xs font-semibold shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <LayoutGrid className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue className="truncate" />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Programs</SelectItem>
              <SelectItem value="upcoming">Upcoming</SelectItem>
              <SelectItem value="ongoing">Ongoing</SelectItem>
              <SelectItem value="for verification">For Verification</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="hidden">Hidden</SelectItem>
            </SelectContent>
          </Select>

          <Button
            onClick={handleOpenCreate}
            className="h-10 w-full min-w-0 gap-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold shadow-[0_6px_14px_rgba(15,128,111,0.22)] lg:w-auto lg:gap-2 lg:px-5"
          >
            <Plus className="h-4 w-4" />
            Add Barangay Program
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredPrograms.length === 0 ? (
          <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-muted-foreground">
            <CalendarDays className="mb-3 h-10 w-10 opacity-50" />
            <p className="font-semibold">No barangay programs found</p>
            <p className="mt-1 text-sm">
              Try a different search or filter, or add a new program.
            </p>
          </div>
        ) : (
          <section aria-label="Barangay programs">
            <div className="hidden grid-cols-[minmax(0,1.35fr)_minmax(150px,1fr)_minmax(140px,1fr)_110px_76px_88px] items-center gap-3 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
              <span>Program</span>
              <span>Schedule</span>
              <span>Area covered</span>
              <span>Status</span>
              <span className="text-center">Show</span>
              <span className="text-center">Actions</span>
            </div>
            <div className="divide-y divide-border/70 border-b border-border/70">
              {filteredPrograms.map((program) => {
                const statusLabel =
                  program.status === 'Not set' ? 'Status not set' : program.status;
                const statusClass = program.status === 'Not set'
                  ? 'bg-muted text-muted-foreground hover:bg-muted'
                  : program.status === 'Ongoing'
                    ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                    : program.status === 'Upcoming'
                      ? 'bg-amber-100 text-amber-700 hover:bg-amber-100'
                      : program.status === 'For Verification'
                        ? 'bg-violet-100 text-violet-700 hover:bg-violet-100'
                        : program.status === 'Completed'
                          ? 'bg-sky-100 text-sky-700 hover:bg-sky-100'
                          : 'bg-rose-100 text-rose-700 hover:bg-rose-100';
                const appearance = getProgramAppearance(program.program_group);
                const Icon = appearance.icon;

                return (
                  <div
                    key={program.id}
                    className="grid gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1.35fr)_minmax(150px,1fr)_minmax(140px,1fr)_110px_76px_88px] lg:items-center"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${appearance.iconClass}`}>
                        <Icon className="h-5 w-5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0">
                        <p className="break-words text-sm font-bold leading-snug text-foreground">
                          {program.title}
                        </p>
                        <p className="mt-1 text-[11px] font-semibold text-primary">
                          {program.program_group ?? 'Program Group not set'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                          {program.description}
                        </p>
                      </div>
                    </div>

                    <div className="min-w-0 space-y-1.5 text-xs text-foreground">
                      <p className="flex items-start gap-2">
                        <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                        <span className="break-words">
                          {program.schedule || 'Schedule not provided'}
                        </span>
                      </p>
                    </div>

                    <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                      <span className="break-words">
                        {program.location || 'Area not provided'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-start">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Status
                      </span>
                      <Badge className={`rounded-full border-0 px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                        {statusLabel}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between gap-3 lg:justify-center">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Visible to residents
                      </span>
                      <Switch
                        checked={program.is_active}
                        onCheckedChange={() => handleToggleActive(program)}
                        aria-label={`Toggle visibility for ${program.title}`}
                      />
                    </div>

                    <div className="flex items-center justify-end gap-2">
                      <span className="mr-auto text-[11px] font-semibold uppercase tracking-wide text-muted-foreground lg:hidden">
                        Actions
                      </span>
                      <AdminActionButton
                        action="edit"
                        icon={Pencil}
                        onClick={() => handleOpenEdit(program)}
                        aria-label={`Edit ${program.title}`}
                      />
                      <AdminActionButton
                        action="delete"
                        icon={Trash2}
                        onClick={() => setDeleteId(program.id)}
                        aria-label={`Delete ${program.title}`}
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
                {form.id ? 'Edit Barangay Program' : 'Add Barangay Program'}
              </DialogTitle>
            </DialogHeader>
            <form
              onSubmit={handleSubmit}
              className="flex min-h-0 flex-1 flex-col overflow-hidden"
            >
              <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-4 py-4 sm:px-6">
                <div className="space-y-1.5">
                  <Label htmlFor="prog-title">Program Title *</Label>
                  <Input
                    id="prog-title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="Enter the program title"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prog-group">Program Group *</Label>
                  <Select
                    value={form.program_group}
                    onValueChange={(value) =>
                      setForm({
                        ...form,
                        program_group: value as BarangayProgramGroup,
                      })
                    }
                  >
                    <SelectTrigger id="prog-group">
                      <SelectValue placeholder="Select a program group" />
                    </SelectTrigger>
                    <SelectContent>
                      {BARANGAY_PROGRAM_GROUPS.map((group) => (
                        <SelectItem key={group} value={group}>
                          {group}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prog-schedule">Schedule *</Label>
                  <Input
                    id="prog-schedule"
                    value={form.schedule}
                    onChange={(e) =>
                      setForm({ ...form, schedule: e.target.value })
                    }
                    placeholder="Enter the program dates and times"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prog-area">Area Covered</Label>
                  <Input
                    id="prog-area"
                    value={form.location}
                    onChange={(e) =>
                      setForm({ ...form, location: e.target.value })
                    }
                    placeholder="Enter the purok or area covered"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prog-desc">Program Description *</Label>
                  <Textarea
                    id="prog-desc"
                    value={form.description}
                    onChange={(e) =>
                      setForm({ ...form, description: e.target.value })
                    }
                    placeholder="Describe the program and its activities"
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="prog-status">Program Status *</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        status: v as BarangayProgramItem['status'],
                      })
                    }
                  >
                    <SelectTrigger id="prog-status">
                      <SelectValue placeholder="Select current status" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRAM_STATUSES.map((st) => (
                        <SelectItem key={st} value={st}>
                          {st}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <Label htmlFor="prog-visible" className="text-sm font-medium">
                  Show in Barangay Programs
                </Label>
                <Switch
                  id="prog-visible"
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
                    'Save Program'
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Barangay Program?</AlertDialogTitle>
              <AlertDialogDescription>
                This will remove the program from the Barangay Purisima programs list.
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

export default AdminPrograms;
