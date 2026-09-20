import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/admin/AdminLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { BookOpen, Plus, Loader2, Search, Trash2, Pencil } from 'lucide-react';
import type { Tables } from '@/integrations/supabase/types';

type Knowledge = Tables<'municipal_knowledge'>;

const emptyForm = { id: '', title: '', category: '', content: '', tags: '', is_active: true };

const AdminKnowledge = () => {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchItems = async () => {
    const { data, error } = await supabase
      .from('municipal_knowledge')
      .select('*')
      .order('category', { ascending: true })
      .order('title', { ascending: true });
    if (error) toast.error('Failed to load knowledge entries');
    setItems(data ?? []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (k: Knowledge) => {
    setForm({
      id: k.id, title: k.title, category: k.category, content: k.content,
      tags: (k.tags ?? []).join(', '), is_active: k.is_active,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title.trim() || !form.category.trim() || !form.content.trim()) {
      toast.error('Title, category and content are required');
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      category: form.category.trim(),
      content: form.content.trim(),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      is_active: form.is_active,
    };
    const { error } = form.id
      ? await supabase.from('municipal_knowledge').update(payload).eq('id', form.id)
      : await supabase.from('municipal_knowledge').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(form.id ? 'Entry updated' : 'Entry added');
    setOpen(false);
    fetchItems();
  };

  const toggleActive = async (k: Knowledge) => {
    const { error } = await supabase.from('municipal_knowledge').update({ is_active: !k.is_active }).eq('id', k.id);
    if (error) toast.error('Failed to update'); else fetchItems();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('municipal_knowledge').delete().eq('id', id);
    if (error) toast.error('Failed to delete');
    else { toast.success('Entry deleted'); fetchItems(); }
  };

  const filtered = items.filter((k) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return k.title.toLowerCase().includes(q) || k.category.toLowerCase().includes(q) ||
      k.content.toLowerCase().includes(q) || (k.tags ?? []).some((t) => t.toLowerCase().includes(q));
  });

  return (
    <AdminLayout title="Knowledge Base" subtitle="Approved municipal information used by the AI agent">
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search entries..." className="pl-9" />
        </div>
        <Button onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Add Entry</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card variant="elevated"><CardContent className="p-10 text-center text-muted-foreground">
          <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-50" />
          No knowledge entries yet.
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((k) => (
            <Card key={k.id} variant="elevated">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-sm truncate">{k.title}</p>
                    <Badge variant="secondary" className="mt-1 text-[11px]">{k.category}</Badge>
                  </div>
                  <Switch checked={k.is_active} onCheckedChange={() => toggleActive(k)} />
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{k.content}</p>
                {(k.tags ?? []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {k.tags.map((t) => <span key={t} className="text-[10px] px-2 py-0.5 rounded bg-muted">{t}</span>)}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" size="sm" onClick={() => openEdit(k)}>
                    <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
                        <AlertDialogDescription>The AI agent will stop using this information.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => remove(k.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader><DialogTitle>{form.id ? 'Edit Entry' : 'Add Knowledge Entry'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Title" maxLength={150} />
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="Category (e.g. Road Damage, Process)" maxLength={80} />
            <Textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Official information, rules or requirements..." rows={8} />
            <Input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="Tags, comma separated" />
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              Active (used by the AI agent)
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminKnowledge;
