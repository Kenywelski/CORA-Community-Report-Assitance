import type { TablesUpdate } from '@/integrations/supabase/types';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AdminLayout } from '@/features/admin/components/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Pencil,
  Trash2,
  Megaphone,
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  LayoutGrid,
  Search,
  X,
} from 'lucide-react';
import { AdminActionButton } from '@/features/admin/components/AdminActionButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type Announcement = Database['public']['Tables']['announcements']['Row'];
type AnnouncementType = Database['public']['Enums']['announcement_type'];

const announcementSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  excerpt: z.string().optional(),
  content: z.string().min(1, 'Content is required'),
  type: z.enum(['general', 'urgent', 'event']),
  is_active: z.boolean(),
});

type AnnouncementFormData = z.infer<typeof announcementSchema>;
type AnnouncementStatusFilter = 'all' | 'active' | 'inactive';

const ANNOUNCEMENTS_PER_PAGE = 5;

const typeConfig = {
  general: { icon: Megaphone, color: 'bg-secondary text-secondary-foreground', label: 'General' },
  urgent: { icon: AlertTriangle, color: 'bg-emergency/10 text-emergency', label: 'Urgent' },
  event: { icon: Calendar, color: 'bg-success/10 text-success', label: 'Event' },
};

const AdminAnnouncements = () => {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [announcementSearch, setAnnouncementSearch] = useState('');
  const [announcementStatus, setAnnouncementStatus] =
    useState<AnnouncementStatusFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AnnouncementFormData>({
    resolver: zodResolver(announcementSchema),
    defaultValues: {
      title: '',
      excerpt: '',
      content: '',
      type: 'general',
      is_active: true,
    },
  });

  const { data: announcements, isLoading } = useQuery({
    queryKey: ['admin-announcements'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const filteredAnnouncements = useMemo(() => {
    const searchTerm = announcementSearch.trim().toLowerCase();
    return (announcements ?? []).filter((announcement) => {
      if (announcementStatus === 'active' && !announcement.is_active) return false;
      if (announcementStatus === 'inactive' && announcement.is_active) return false;
      if (!searchTerm) return true;

      return [
        announcement.title,
        announcement.excerpt ?? '',
        announcement.content,
      ]
        .join(' ')
        .toLowerCase()
        .includes(searchTerm);
    });
  }, [announcementSearch, announcementStatus, announcements]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredAnnouncements.length / ANNOUNCEMENTS_PER_PAGE),
  );
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * ANNOUNCEMENTS_PER_PAGE;
  const paginatedAnnouncements = filteredAnnouncements.slice(
    startIndex,
    startIndex + ANNOUNCEMENTS_PER_PAGE,
  );

  useEffect(() => {
    const channel = supabase
      .channel('admin-announcements-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'announcements' },
        () => void queryClient.invalidateQueries({ queryKey: ['admin-announcements'] }),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const uploadImage = async (file: File, userId: string): Promise<string> => {
    const extensionByContentType: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
    };
    const extension = extensionByContentType[file.type];
    if (!extension) {
      throw new Error('Use a JPG, PNG, WEBP, or GIF image.');
    }

    const filePath = `announcements/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from('public-media')
      .upload(filePath, file, {
        contentType: file.type,
        upsert: false,
      });
    if (error) throw error;
    const { data: urlData } = supabase.storage
      .from('public-media')
      .getPublicUrl(filePath);
    return urlData.publicUrl;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const createMutation = useMutation({
    mutationFn: async (data: AnnouncementFormData) => {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!authData.user) throw new Error('Sign in before creating an announcement.');

      let image_url: string | null = null;
      if (imageFile) {
        image_url = await uploadImage(imageFile, authData.user.id);
      }
      const { error } = await supabase
        .from('announcements')
        .insert({
          title: data.title,
          excerpt: data.excerpt || null,
          content: data.content,
          type: data.type,
          is_active: data.is_active,
          created_by: authData.user.id,
          image_url,
        })
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement created successfully');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('Failed to create announcement:', error);
      toast.error(
        error instanceof Error
          ? `Failed to create announcement: ${error.message}`
          : 'Failed to create announcement',
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AnnouncementFormData }) => {
      let image_url: string | undefined = undefined;
      if (imageFile) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!authData.user) throw new Error('Sign in before uploading an announcement image.');
        image_url = await uploadImage(imageFile, authData.user.id);
      }
      const updateData: TablesUpdate<'announcements'> = {
        title: data.title,
        excerpt: data.excerpt || null,
        content: data.content,
        type: data.type,
        is_active: data.is_active,
      };
      if (image_url !== undefined) updateData.image_url = image_url;
      // If user cleared existing image
      if (!imagePreview && editingAnnouncement?.image_url) {
        updateData.image_url = null;
      }
      const { error } = await supabase
        .from('announcements')
        .update(updateData)
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement updated successfully');
      handleCloseDialog();
    },
    onError: (error) => {
      console.error('Failed to update announcement:', error);
      toast.error(
        error instanceof Error
          ? `Failed to update announcement: ${error.message}`
          : 'Failed to update announcement',
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id)
        .select('id')
        .single();
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-announcements'] });
      toast.success('Announcement deleted successfully');
    },
    onError: () => toast.error('Failed to delete announcement'),
  });

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingAnnouncement(null);
    clearImage();
    form.reset({
      title: '',
      excerpt: '',
      content: '',
      type: 'general',
      is_active: true,
    });
  };

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setImagePreview(announcement.image_url || null);
    setImageFile(null);
    form.reset({
      title: announcement.title,
      excerpt: announcement.excerpt || '',
      content: announcement.content,
      type: announcement.type,
      is_active: announcement.is_active,
    });
    setIsDialogOpen(true);
  };

  const onSubmit = (data: AnnouncementFormData) => {
    if (editingAnnouncement) {
      updateMutation.mutate({ id: editingAnnouncement.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <AdminLayout title="Announcements" subtitle="Create and manage community announcements">
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-[minmax(0,1fr)_180px_auto]">
          <div className="relative col-span-2 min-w-0 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={announcementSearch}
              onChange={(event) => {
                setAnnouncementSearch(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search announcement..."
              aria-label="Search announcements"
              className="h-10 rounded-xl border-border bg-card pl-10 text-xs shadow-sm placeholder:text-muted-foreground"
            />
          </div>
          <Select
            value={announcementStatus}
            onValueChange={(value) => {
              setAnnouncementStatus(value as AnnouncementStatusFilter);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="h-10 min-w-0 rounded-xl border-border bg-card px-3 text-xs font-semibold shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <LayoutGrid className="h-4 w-4 shrink-0 text-foreground" />
                <SelectValue aria-label="Announcement status filter" />
              </div>
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <Dialog open={isDialogOpen} onOpenChange={(open) => open ? setIsDialogOpen(true) : handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="h-10 w-full min-w-0 gap-1 whitespace-nowrap rounded-xl px-2 text-xs font-bold shadow-[0_6px_14px_rgba(15,128,111,0.22)] lg:w-auto lg:gap-2 lg:px-5"
              >
                <Plus className="h-4 w-4" />
                <span className="sm:hidden">Add Announcement</span>
                <span className="hidden sm:inline">New Announcement</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="flex max-h-[calc(100dvh-1rem)] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-h-[calc(100dvh-2rem)] sm:w-full">
              <DialogHeader className="shrink-0 border-b border-border/70 px-4 pb-4 pt-5 sm:px-6 sm:pt-6">
                <DialogTitle>
                  {editingAnnouncement ? 'Edit Announcement' : 'Create Announcement'}
                </DialogTitle>
              </DialogHeader>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="flex min-h-0 flex-1 flex-col overflow-hidden"
                >
                  <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl>
                          <Input placeholder="Announcement title" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="general">General</SelectItem>
                            <SelectItem value="urgent">Urgent</SelectItem>
                            <SelectItem value="event">Event</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="excerpt"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Excerpt (Optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="Brief summary" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="content"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Content</FormLabel>
                        <FormControl>
                          <Textarea placeholder="Full announcement content" rows={4} {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                   />
                  {/* Image Upload */}
                  <div className="space-y-2">
                    <FormLabel>Image (Optional)</FormLabel>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="hidden"
                      onChange={handleImageSelect}
                    />
                    {imagePreview ? (
                      <div className="relative overflow-hidden rounded-lg border border-border bg-muted/30">
                        <img
                          src={imagePreview}
                          alt="Announcement image preview"
                          className="mx-auto block max-h-[60vh] w-full object-contain"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7"
                          onClick={clearImage}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full gap-2"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <ImagePlus className="h-4 w-4" />
                        Choose Image
                      </Button>
                    )}
                  </div>
                  <FormField
                    control={form.control}
                    name="is_active"
                    render={({ field }) => (
                      <FormItem className="flex items-center justify-between rounded-lg border p-3">
                        <FormLabel className="text-sm font-medium">Active</FormLabel>
                        <FormControl>
                          <Switch checked={field.value} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  </div>
                  <div className="flex shrink-0 justify-end gap-2 border-t border-border/70 bg-background px-4 py-4 sm:px-6">
                    <Button type="button" variant="outline" onClick={handleCloseDialog}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                      {editingAnnouncement ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div role="status" className="flex justify-center py-14 text-sm text-muted-foreground">
            Loading announcements...
          </div>
        ) : (
          <section aria-label="Announcements">
              <div className="hidden grid-cols-[minmax(0,1fr)_150px_100px_92px] items-center gap-4 border-y border-border/70 bg-muted/35 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground lg:grid">
                <span>Announcement</span>
                <span>Date</span>
                <span>Status</span>
                <span className="text-center">Actions</span>
              </div>

              {paginatedAnnouncements.length === 0 ? (
                <div className="flex min-h-48 flex-col items-center justify-center border-y border-border/70 py-10 text-center text-sm text-muted-foreground">
                  {announcements?.length
                    ? 'No announcements match your search or status filter.'
                    : 'No announcements yet. Create your first one!'}
                </div>
              ) : (
                <div className="divide-y divide-border/70 border-b border-border/70">
                  {paginatedAnnouncements.map((announcement) => {
                    const config = typeConfig[announcement.type];
                    const Icon = config.icon;

                    return (
                      <div
                        key={announcement.id}
                        className="grid grid-cols-2 gap-3 px-4 py-4 transition-colors hover:bg-muted/20 lg:grid-cols-[minmax(0,1fr)_150px_100px_92px] lg:items-center lg:gap-4"
                      >
                        <div className="col-span-2 flex min-w-0 items-center gap-3 lg:col-span-1">
                          {announcement.image_url ? (
                            <img
                              src={announcement.image_url}
                              alt=""
                              loading="lazy"
                              className="h-12 w-20 shrink-0 rounded-lg border border-border/60 object-cover"
                            />
                          ) : (
                            <span className={`flex h-12 w-20 shrink-0 items-center justify-center rounded-lg ${config.color}`}>
                              <Icon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          )}
                          <span aria-hidden="true" className="h-9 border-l border-border/70" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-foreground">
                              {announcement.title}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {announcement.excerpt || announcement.content}
                            </p>
                          </div>
                        </div>

                        <div className="flex min-w-0 items-center justify-between gap-2 text-xs text-muted-foreground lg:justify-start">
                          <span className="font-medium lg:hidden">Date</span>
                          <span className="inline-flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            {format(new Date(announcement.created_at), 'MMM d, yyyy')}
                          </span>
                        </div>

                        <div className="flex items-center justify-between lg:justify-start">
                          <span className="font-medium text-xs text-muted-foreground lg:hidden">
                            Status
                          </span>
                          <Badge
                            className={`inline-flex items-center gap-1.5 rounded-full border-0 px-2.5 py-1 text-[10px] font-semibold ${
                              announcement.is_active
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-900/50 dark:text-emerald-200'
                                : 'bg-muted text-muted-foreground hover:bg-muted'
                            }`}
                          >
                            <span className={`h-1.5 w-1.5 rounded-full ${
                              announcement.is_active ? 'bg-emerald-600' : 'bg-muted-foreground'
                            }`} />
                            {announcement.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-2 lg:col-span-1">
                          <AdminActionButton
                            action="edit"
                            icon={Pencil}
                            onClick={() => handleEdit(announcement)}
                            aria-label={`Edit ${announcement.title}`}
                          />
                          <AdminActionButton
                            action="delete"
                            icon={Trash2}
                            onClick={() => deleteMutation.mutate(announcement.id)}
                            aria-label={`Delete ${announcement.title}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {totalPages > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 px-4 py-3 text-xs font-medium text-muted-foreground">
                  <p>
                    Showing {startIndex + 1}–
                    {Math.min(startIndex + ANNOUNCEMENTS_PER_PAGE, filteredAnnouncements.length)} of{' '}
                    {filteredAnnouncements.length} announcements
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      disabled={safeCurrentPage === 1}
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span
                      aria-label={`Page ${safeCurrentPage} of ${totalPages}`}
                      className="grid h-8 min-w-8 place-items-center rounded-lg bg-emerald-700 px-2.5 font-bold text-white"
                    >
                      {safeCurrentPage}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8 rounded-lg"
                      disabled={safeCurrentPage === totalPages}
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
          </section>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminAnnouncements;
