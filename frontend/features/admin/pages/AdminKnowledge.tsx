import { useEffect, useId, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Download,
  FileText,
  FolderOpen,
  Grid2X2,
  Image as ImageIcon,
  List,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Knowledge = Tables<'knowledge_base'>;
type ReportImageRow = Pick<
  Tables<'community_reports'>,
  'id' | 'title' | 'description' | 'category' | 'ai_category' | 'photo_url' | 'media_urls'
>;

interface FolderDefinition {
  title: string;
  description: string;
}

const categoryFolders: FolderDefinition[] = [
  {
    title: 'Improper Waste Disposal',
    description: 'Reported images repository',
  },
  {
    title: 'Streetlight Problem',
    description: 'AI training/report image library',
  },
  {
    title: 'Drainage/Flooding Concern',
    description: 'Reported images repository',
  },
  {
    title: 'Road Damage',
    description: 'AI training/report image library',
  },
];

const emptyForm = {
  id: '',
  title: '',
  category: '',
  content: '',
  tags: '',
  is_active: true,
};

const normalizeCategory = (value: string | null | undefined) =>
  (value || '').replace(/^Report:\s*/i, '').trim().toLowerCase();

const getReportImages = (report: ReportImageRow) =>
  [...new Set([report.photo_url, ...(report.media_urls || [])].filter(Boolean))] as string[];

const AdminKnowledge = () => {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [reports, setReports] = useState<ReportImageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [form, setForm] = useState(emptyForm);
  const [formOpen, setFormOpen] = useState(false);
  const [activeFolder, setActiveFolder] = useState<FolderDefinition | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [downloadingImages, setDownloadingImages] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchKnowledge = async () => {
    const { data, error } = await supabase
      .from('knowledge_base')
      .select('*')
      .order('category', { ascending: true })
      .order('title', { ascending: true });

    if (error) {
      toast.error('Failed to load knowledge entries');
      return;
    }
    setItems(data ?? []);
  };

  const fetchReportImages = async () => {
    const { data, error } = await supabase
      .from('community_reports')
      .select('id, title, description, category, ai_category, photo_url, media_urls')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load reported images');
      return;
    }
    setReports((data || []) as ReportImageRow[]);
  };

  useEffect(() => {
    const load = async () => {
      await Promise.all([fetchKnowledge(), fetchReportImages()]);
      setLoading(false);
    };
    void load();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin-knowledge-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'knowledge_base' },
        () => void fetchKnowledge(),
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'community_reports' },
        () => void fetchReportImages(),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const imagesByFolder = useMemo(() => {
    return Object.fromEntries(
      categoryFolders.map((folder) => {
        const normalizedFolder = normalizeCategory(folder.title);
        const images = reports.flatMap((report) => {
          const matches = [report.category, report.ai_category].some(
            (category) => normalizeCategory(category) === normalizedFolder,
          );
          return matches ? getReportImages(report) : [];
        });
        return [folder.title, [...new Set(images)]];
      }),
    ) as Record<string, string[]>;
  }, [reports]);

  const filteredFolders = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return categoryFolders;

    return categoryFolders.filter((folder) => {
      if (
        folder.title.toLowerCase().includes(query) ||
        folder.description.toLowerCase().includes(query)
      ) {
        return true;
      }

      const normalizedFolder = normalizeCategory(folder.title);
      return reports.some(
        (report) =>
          [report.category, report.ai_category].some(
            (category) => normalizeCategory(category) === normalizedFolder,
          ) &&
          [report.title, report.description].some((value) =>
            value.toLowerCase().includes(query),
          ),
      );
    });
  }, [reports, search]);

  const openNew = () => {
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (knowledge: Knowledge) => {
    setForm({
      id: knowledge.id,
      title: knowledge.title,
      category: knowledge.category,
      content: knowledge.content,
      tags: (knowledge.tags ?? []).join(', '),
      is_active: knowledge.is_active,
    });
    setFormOpen(true);
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
      tags: form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };
    const { error } = form.id
      ? await supabase
          .from('knowledge_base')
          .update(payload)
          .eq('id', form.id)
          .select('id')
          .single()
      : await supabase.from('knowledge_base').insert(payload).select('id').single();
    setSaving(false);

    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(form.id ? 'Entry updated' : 'Entry added');
    setFormOpen(false);
    await fetchKnowledge();
  };

  const toggleActive = async (knowledge: Knowledge) => {
    const { error } = await supabase
      .from('knowledge_base')
      .update({ is_active: !knowledge.is_active })
      .eq('id', knowledge.id)
      .select('id')
      .single();

    if (error) toast.error('Failed to update');
    else await fetchKnowledge();
  };

  const remove = async (id: string) => {
    const { error } = await supabase
      .from('knowledge_base')
      .delete()
      .eq('id', id)
      .select('id')
      .single();
    if (error) {
      toast.error('Failed to delete');
      return;
    }
    toast.success('Entry deleted');
    await fetchKnowledge();
  };

  const activeFolderImages = activeFolder ? imagesByFolder[activeFolder.title] || [] : [];
  const allFolderImagesSelected =
    activeFolderImages.length > 0 &&
    activeFolderImages.every((image) => selectedImages.has(image));

  const openFolder = (folder: FolderDefinition) => {
    setSelectedImages(new Set());
    setActiveFolder(folder);
  };

  const closeFolder = () => {
    setSelectedImages(new Set());
    setActiveFolder(null);
  };

  const toggleImageSelection = (image: string) => {
    setSelectedImages((current) => {
      const next = new Set(current);
      if (next.has(image)) next.delete(image);
      else next.add(image);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedImages(
      allFolderImagesSelected ? new Set() : new Set(activeFolderImages),
    );
  };

  const downloadImage = async (image: string, index: number) => {
    const folderSlug = (activeFolder?.title || 'knowledge-image')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    try {
      const response = await fetch(image);
      if (!response.ok) throw new Error('Image download failed');

      const blob = await response.blob();
      const extension = blob.type.split('/')[1]?.split('+')[0] || 'jpg';
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `${folderSlug}-${index + 1}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      const link = document.createElement('a');
      link.href = image;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.download = `${folderSlug}-${index + 1}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const downloadSelectedImages = async () => {
    const imagesToDownload = activeFolderImages.filter((image) =>
      selectedImages.has(image),
    );
    if (imagesToDownload.length === 0) return;

    setDownloadingImages(true);
    try {
      for (const image of imagesToDownload) {
        await downloadImage(image, activeFolderImages.indexOf(image));
      }
      toast.success(
        `${imagesToDownload.length} ${imagesToDownload.length === 1 ? 'image' : 'images'} downloaded`,
      );
    } finally {
      setDownloadingImages(false);
    }
  };

  return (
    <AdminLayout
      title="Knowledge Base"
      subtitle="Repository of reported images organized by concern category"
    >
      <div className="space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search folders..."
              aria-label="Search knowledge folders"
              className="h-11 rounded-xl border-border/70 bg-card pl-11 text-sm shadow-none"
            />
          </div>
          <div className="flex h-11 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-card">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex w-12 items-center justify-center outline-none transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                viewMode === 'grid'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              aria-label="Grid view"
              aria-pressed={viewMode === 'grid'}
            >
              <Grid2X2 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cn(
                'flex w-12 items-center justify-center border-l border-border/70 outline-none transition-colors focus:outline-none focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary',
                viewMode === 'list'
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              )}
              aria-label="List view"
              aria-pressed={viewMode === 'list'}
            >
              <List className="h-4 w-4" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filteredFolders.length === 0 ? (
          <Card variant="default" className="rounded-[22px] border-border/70 bg-card shadow-soft">
            <CardContent className="flex flex-col items-center p-12 text-center text-muted-foreground">
              <FolderOpen className="mb-3 h-10 w-10 opacity-50" />
              <p className="font-semibold text-foreground">No matching folders found</p>
              <p className="mt-1 text-sm">Try another search term.</p>
            </CardContent>
          </Card>
        ) : (
          <div
            className={cn(
              'grid gap-2 sm:gap-3 md:gap-4',
              viewMode === 'grid'
                ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
                : 'grid-cols-1',
            )}
          >
            {filteredFolders.map((folder) => {
              const images = imagesByFolder[folder.title] || [];

              return (
                <Card
                  key={folder.title}
                  variant="flat"
                  className={cn(
                    'relative bg-card',
                    viewMode === 'grid'
                      ? 'w-full rounded-[18px] border border-border/55 sm:rounded-[22px]'
                      : 'rounded-[22px] border border-border/55 transition-colors hover:border-primary/25',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openFolder(folder)}
                    className={cn(
                      'relative z-10 w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                      viewMode === 'grid'
                        ? 'flex flex-col items-center gap-3 px-3 py-4 text-center sm:px-4 sm:py-5 xl:gap-4'
                        : 'flex min-h-[92px] items-center gap-3.5 px-4 py-3 text-left',
                    )}
                  >
                    <FolderArtwork compact={viewMode === 'list'} />
                    {viewMode === 'grid' ? (
                      <div className="w-full">
                        <h2
                          className={cn(
                            'font-extrabold tracking-tight text-foreground',
                            'text-xs leading-tight sm:text-sm sm:leading-[1.15]'
                          )}
                        >
                          {folder.title}
                        </h2>
                        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                          <ImageIcon className="h-3 w-3" />
                          {images.length} {images.length === 1 ? 'Image' : 'Images'}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1">
                          <h2
                            className={cn(
                              'font-extrabold tracking-tight text-foreground',
                              'truncate text-lg sm:text-xl',
                            )}
                          >
                            {folder.title}
                          </h2>
                          <p className="mt-1 truncate text-sm text-muted-foreground">
                            {folder.description}
                          </p>
                        </div>
                        <span className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1.5 text-sm font-bold text-primary">
                          <ImageIcon className="h-4 w-4" />
                          {images.length} {images.length === 1 ? 'Image' : 'Images'}
                        </span>
                      </>
                    )}
                  </button>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Dialog open={Boolean(activeFolder)} onOpenChange={(open) => !open && closeFolder()}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-2rem)] max-w-3xl overflow-y-auto p-3 sm:w-full sm:p-6">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-7 sm:gap-4 sm:pr-8">
              <DialogTitle className="flex min-w-0 items-center gap-2 sm:gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:h-11 sm:w-11">
                  <FolderOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                </span>
                <span className="truncate text-sm sm:text-base">{activeFolder?.title}</span>
              </DialogTitle>
            </div>
          </DialogHeader>

          {activeFolderImages.length > 0 ? (
            <div className="space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border/70 bg-muted/30 p-2.5 sm:gap-3 sm:p-3">
                <p className="text-xs font-semibold text-muted-foreground sm:text-sm">
                  <span className="text-foreground">{selectedImages.size}</span> of{' '}
                  {activeFolderImages.length} selected
                </p>
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button variant="outline" size="sm" className="h-8 px-2.5 text-xs sm:px-3 sm:text-sm" onClick={toggleSelectAll}>
                    <Check className="h-4 w-4" />
                    {allFolderImagesSelected ? 'Clear Selection' : 'Select All'}
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 px-2.5 text-xs sm:px-3 sm:text-sm"
                    onClick={() => void downloadSelectedImages()}
                    disabled={selectedImages.size === 0 || downloadingImages}
                  >
                    {downloadingImages ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download Selected
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3">
                {activeFolderImages.map((image, index) => {
                  const isSelected = selectedImages.has(image);

                  return (
                    <div
                      key={`${image}-${index}`}
                      className={cn(
                        'group relative aspect-[4/3] overflow-hidden rounded-2xl border bg-muted transition-all',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border/70 hover:border-primary/50',
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => toggleImageSelection(image)}
                        className="h-full w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                        aria-label={`${isSelected ? 'Deselect' : 'Select'} image ${index + 1}`}
                        aria-pressed={isSelected}
                      >
                        <img
                          src={image}
                          alt={`${activeFolder?.title} reported image ${index + 1}`}
                          className="h-full w-full object-cover"
                        />
                        <span
                          className={cn(
                            'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-sm transition-colors',
                            isSelected
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-white bg-background/80 text-transparent backdrop-blur-sm',
                          )}
                          aria-hidden="true"
                        >
                          <Check className="h-4 w-4" strokeWidth={3} />
                        </span>
                      </button>
                      <Button
                        type="button"
                        variant="secondary"
                        size="icon-sm"
                        className="absolute right-2 top-2 border border-border/50 bg-background/90 shadow-sm backdrop-blur-sm hover:bg-background"
                        onClick={() => void downloadImage(image, index)}
                        aria-label={`Download image ${index + 1}`}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/25 px-4 py-6 text-center sm:px-6 sm:py-12">
              <p className="font-bold">No reported images in this folder yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                New validated report images will appear here automatically.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="w-[calc(100vw-1rem)] max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto p-4 sm:w-full sm:p-6">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Entry' : 'Add Knowledge Entry'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
              placeholder="Title"
              maxLength={150}
            />
            <Input
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
              placeholder="Category (e.g. Road Damage, Process)"
              maxLength={80}
            />
            <Textarea
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
              placeholder="Official information, rules or requirements..."
              rows={8}
            />
            <Input
              value={form.tags}
              onChange={(event) => setForm({ ...form, tags: event.target.value })}
              placeholder="Tags, comma separated"
            />
            <label className="flex items-center gap-3 text-sm">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm({ ...form, is_active: checked })}
              />
              Active (used by the AI agent)
            </label>
          </div>
          <DialogFooter className="flex-row gap-2 sm:space-x-0">
            <Button variant="ghost" className="flex-1" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={() => void save()} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

const FolderArtwork = ({ compact = false }: { compact?: boolean }) => {
  const gradientId = `folder-gradient-${useId().replace(/:/g, '')}`;

  return (
    <div
      className={cn(
        'relative shrink-0',
        compact
          ? 'h-[58px] w-[82px]'
          : 'h-[120px] w-full max-w-[180px] sm:h-[140px] sm:max-w-[210px] xl:h-[160px] xl:max-w-[240px]',
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 210 145"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={gradientId} x1="20" y1="6" x2="190" y2="130" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="hsl(var(--primary) / 0.85)" />
            <stop offset="1" stopColor="hsl(var(--primary) / 0.95)" />
          </linearGradient>
        </defs>

        {/* Main folder body - clean and simple */}
        <path
          d="M0 22C0 9.85 9.85 0 22 0H76C85.5 0 91.5 3.5 98 10.5L109.5 23H188C200.15 23 210 32.85 210 45V123C210 135.15 200.15 145 188 145H22C9.85 145 0 135.15 0 123V22Z"
          fill={`url(#${gradientId})`}
        />
      </svg>

      {/* Content area - simple flat design */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-10 flex items-center justify-center bg-gradient-to-br from-[#e5faf7] to-[#d0f0ec]',
          compact
            ? 'top-[18px] rounded-t-[14px] rounded-b-[9px]'
            : 'top-[29px] rounded-t-[19px] rounded-b-[16px]',
        )}
      >
        <FolderImageGlyph className={compact ? 'h-8 w-8' : 'h-14 w-14 sm:h-16 sm:w-16 xl:h-20 xl:w-20'} />
      </div>
    </div>
  );
};

const FolderImageGlyph = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 56 56"
    className={cn('text-primary/80', className)}
    fill="currentColor"
    aria-hidden="true"
  >
    {/* Simple filled image icon - no outlines */}
    <rect x="8" y="10" width="40" height="36" rx="4" fill="currentColor" />
    <circle cx="20" cy="22" r="4" fill="white" />
    <path
      d="M10 40L21 29L28 35L34 27L46 40V42C46 43.1 45.1 44 44 44H12C10.9 44 10 43.1 10 42V40Z"
      fill="white"
    />
  </svg>
);

export default AdminKnowledge;
