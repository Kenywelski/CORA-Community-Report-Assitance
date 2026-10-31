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
  Edit2,
  Loader2,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  type BarangayProgramItem,
  deleteBarangayProgram,
  loadBarangayPrograms,
  saveBarangayProgram,
} from '@/lib/barangayContentStore';

const PROGRAM_CATEGORIES: BarangayProgramItem['category'][] = [
  'Health & Wellness',
  'Youth & Education',
  'Livelihood & Agriculture',
  'Environment & Sanitation',
  'Senior Citizens & Social Welfare',
  'Peace & Disaster Preparedness',
];

const PROGRAM_STATUSES: BarangayProgramItem['status'][] = [
  'Active',
  'Upcoming',
  'Completed',
];

const emptyProgramForm: {
  id: string;
  title: string;
  category: BarangayProgramItem['category'];
  description: string;
  schedule: string;
  location: string;
  target_participants: string;
  coordinator: string;
  status: BarangayProgramItem['status'];
  is_active: boolean;
} = {
  id: '',
  title: '',
  category: 'Health & Wellness',
  description: '',
  schedule: '',
  location: 'Barangay Purisima, Tago, Surigao del Sur',
  target_participants: 'All Barangay Purisima Residents',
  coordinator: 'Barangay Purisima Council',
  status: 'Active',
  is_active: true,
};

const AdminPrograms = () => {
  const [programs, setPrograms] = useState<BarangayProgramItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProgramForm);

  useEffect(() => {
    let mounted = true;
    loadBarangayPrograms().then((data) => {
      if (!mounted) return;
      setPrograms(data);
      setLoading(false);
    });
    return () => {
      mounted = false;
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
      category: program.category,
      description: program.description,
      schedule: program.schedule,
      location: program.location,
      target_participants: program.target_participants,
      coordinator: program.coordinator,
      status: program.status,
      is_active: program.is_active,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim() || !form.schedule.trim()) {
      toast.error('Please fill in the Program Title, Description, and Schedule.');
      return;
    }

    setSaving(true);
    try {
      const updated = await saveBarangayProgram({
        id: form.id || undefined,
        title: form.title,
        category: form.category,
        description: form.description,
        schedule: form.schedule,
        location: form.location || 'Barangay Purisima, Tago',
        target_participants: form.target_participants || 'All Residents',
        coordinator: form.coordinator || 'Barangay Purisima Council',
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
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const updated = await deleteBarangayProgram(deleteId);
    setPrograms(updated);
    setDeleteId(null);
    toast.success('Barangay program deleted');
  };

  const filteredPrograms = programs.filter((p) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return `${p.title} ${p.category} ${p.description} ${p.location} ${p.coordinator}`
      .toLowerCase()
      .includes(q);
  });

  return (
    <AdminLayout
      title="Barangay Programs"
      subtitle="Manage community programs, livelihood initiatives, and health outreach for Barangay Purisima, Tago"
    >
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search programs by title, category, or venue..."
              className="pl-9"
            />
          </div>

          <Button onClick={handleOpenCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Barangay Program
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-14">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredPrograms.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground">
              <CalendarDays className="h-9 w-9 mx-auto mb-3 opacity-50" />
              No barangay programs found. Click &ldquo;Add Barangay Program&rdquo; to create one.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filteredPrograms.map((program) => (
              <Card key={program.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                        <CalendarDays className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {program.category}
                          </Badge>
                          <Badge
                            variant={program.is_active ? 'default' : 'outline'}
                            className="text-xs"
                          >
                            {program.status}
                          </Badge>
                        </div>
                        <CardTitle className="text-base leading-snug pt-0.5">
                          {program.title}
                        </CardTitle>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Switch
                        checked={program.is_active}
                        onCheckedChange={() => handleToggleActive(program)}
                        aria-label="Toggle active status"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleOpenEdit(program)}
                        aria-label="Edit program"
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteId(program.id)}
                        aria-label="Delete program"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2.5 text-sm">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {program.description}
                  </p>
                  <div className="space-y-1.5 pt-1 text-xs border-t border-border">
                    <p className="flex items-center gap-2 font-medium text-foreground">
                      <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>Schedule: {program.schedule}</span>
                    </p>
                    <p className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                      <span>Venue: {program.location}</span>
                    </p>
                    <p className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span>
                        Participants: {program.target_participants} ·{' '}
                        {program.coordinator}
                      </span>
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
                {form.id ? 'Edit Barangay Program' : 'Add Barangay Program'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3.5">
              <div className="space-y-1.5">
                <Label htmlFor="prog-title">Program Title *</Label>
                <Input
                  id="prog-title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g., Linis Purok & Solid Waste Segregation Drive"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        category: v as BarangayProgramItem['category'],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROGRAM_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label>Program Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        status: v as BarangayProgramItem['status'],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
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
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prog-schedule">Schedule *</Label>
                <Input
                  id="prog-schedule"
                  value={form.schedule}
                  onChange={(e) =>
                    setForm({ ...form, schedule: e.target.value })
                  }
                  placeholder="e.g., Every Saturday, 6:00 AM – 9:00 AM"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prog-location">Venue / Purok Location</Label>
                <Input
                  id="prog-location"
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  placeholder="e.g., Barangay Purisima Covered Court"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="prog-participants">Target Participants</Label>
                  <Input
                    id="prog-participants"
                    value={form.target_participants}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        target_participants: e.target.value,
                      })
                    }
                    placeholder="e.g., All households / Youth ages 15–30"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prog-coordinator">Lead Office / Committee</Label>
                  <Input
                    id="prog-coordinator"
                    value={form.coordinator}
                    onChange={(e) =>
                      setForm({ ...form, coordinator: e.target.value })
                    }
                    placeholder="e.g., Committee on Health"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="prog-desc">Program Description *</Label>
                <Textarea
                  id="prog-desc"
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Describe the program objectives, activities, and how residents can join..."
                  rows={3}
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border p-3">
                <span className="text-sm font-medium">
                  Visible in Resident Barangay Programs
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
                    'Update Program'
                  ) : (
                    'Add Program'
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
