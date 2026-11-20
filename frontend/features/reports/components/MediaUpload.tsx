import { useRef, useState, type ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Upload, Loader2, X, Image as ImageIcon, Video as VideoIcon, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const MAX_BYTES = 50 * 1024 * 1024;

export interface MediaItem {
  url: string;
  type: 'image' | 'video';
}

interface Props {
  folder?: string; // 'reports' | 'announcements'
  bucket?: string;
  value: MediaItem[];
  onChange: (items: MediaItem[]) => void;
  max?: number;
  accept?: string;
  label?: string;
}

export const MediaUpload = ({
  folder = 'reports',
  bucket = 'public-media',
  value,
  onChange,
  max = 6,
  accept = 'image/*,video/*',
  label = 'Photos & Videos',
}: Props) => {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const next = [...value];
    for (const file of Array.from(files)) {
      if (next.length >= max) {
        toast.error(`Maximum ${max} files`);
        break;
      }
      if (file.size > MAX_BYTES) {
        toast.error(`${file.name} exceeds 50MB`);
        continue;
      }
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) {
        toast.error(`${file.name} is not image or video`);
        continue;
      }
      try {
        const ext = file.name.split('.').pop();
        const { data: { user } } = await supabase.auth.getUser();
        const owner = user?.id ?? 'guest';
        if (!user && folder !== 'reports') {
          toast.error('Please sign in to upload files');
          break;
        }
        const path = `${folder}/${owner}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        const { error } = await supabase.storage.from(bucket).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from(bucket).getPublicUrl(path);
        next.push({ url: publicUrl, type: isImage ? 'image' : 'video' });
      } catch (e) {
        console.error(e);
        toast.error(`Failed to upload ${file.name}`);
      }
    }
    onChange(next);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">{label}</label>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={uploading || value.length >= max}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || value.length >= max}
        className="w-full border-2 border-dashed border-border rounded-xl p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        ) : (
          <>
            <Upload className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
            <p className="text-sm text-muted-foreground">Tap to add photos or videos</p>
            <p className="text-xs text-muted-foreground mt-1">Up to {max} files, 50MB each</p>
          </>
        )}
      </button>

      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {value.map((m, idx) => (
            <div key={idx} className="relative group rounded-lg overflow-hidden border border-border aspect-square bg-muted">
              {m.type === 'image' ? (
                <img src={m.url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full relative">
                  <video src={m.url} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <VideoIcon className="h-6 w-6 text-white" />
                  </div>
                </div>
              )}
              <Button
                type="button"
                size="icon"
                variant="destructive"
                className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={() => remove(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const ImagePreview = ({
  src,
  alt,
  className,
  children,
  fullScreenOnMobile = false,
}: {
  src: string;
  alt: string;
  className?: string;
  children?: ReactNode;
  fullScreenOnMobile?: boolean;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-label={alt ? `View full-size image: ${alt}` : 'View full-size image'}
        className={cn(
          'group relative block w-full cursor-zoom-in overflow-hidden p-0 text-left',
          className
        )}
        onClick={() => setOpen(true)}
      >
        {children ?? <img src={src} alt={alt} className="h-full w-full object-cover" />}
        <span
          aria-hidden="true"
          className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-black/55 text-white backdrop-blur transition-colors group-hover:bg-black/70"
        >
          <Maximize2 className="h-4 w-4" />
        </span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          overlayClassName="bg-black/20 backdrop-blur-md"
          closeButtonClassName="right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-full border-0 bg-background/95 p-0 text-foreground opacity-100 shadow-md hover:bg-background hover:opacity-100 focus:outline-none focus:ring-0 focus:ring-offset-0"
          className={cn(
            '!flex items-center justify-center border-0 p-0 !shadow-none',
            fullScreenOnMobile
              ? '!fixed !left-0 !top-0 !h-[100dvh] !max-h-none !w-screen !max-w-none !translate-x-0 !translate-y-0 overflow-hidden rounded-none !bg-black lg:!left-[50%] lg:!top-[50%] lg:!h-auto lg:!max-h-[92dvh] lg:!w-auto lg:!max-w-[96vw] lg:!-translate-x-1/2 lg:!-translate-y-1/2 lg:!rounded-2xl'
              : 'h-auto max-h-[92dvh] w-auto max-w-[96vw] overflow-visible !bg-transparent'
          )}
        >
          <DialogTitle className="sr-only">{alt || 'Image preview'}</DialogTitle>
          <img
            src={src}
            alt={alt}
            className={
              fullScreenOnMobile
                ? 'h-full w-full max-h-[100dvh] max-w-[100vw] object-contain lg:h-auto lg:w-auto lg:max-h-[88dvh] lg:max-w-[96vw]'
                : 'max-h-[88dvh] max-w-full rounded object-contain'
            }
          />
        </DialogContent>
      </Dialog>
    </>
  );
};

export const MediaGallery = ({ items }: { items: MediaItem[] }) => {
  if (!items || items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {items.map((m, idx) =>
        m.type === 'image' ? (
          <ImagePreview
            key={idx}
            src={m.url}
            alt="Report attachment"
            className="rounded-lg border border-border"
          >
            <img src={m.url} alt="" className="h-32 w-full object-cover" />
          </ImagePreview>
        ) : (
          <video key={idx} src={m.url} controls className="w-full h-32 object-cover rounded-lg border border-border bg-black" />
        )
      )}
    </div>
  );
};
