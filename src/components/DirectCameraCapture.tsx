import { useEffect, useRef, useState } from 'react';
import { Camera, Check, Loader2, RotateCcw, X, Zap, ZapOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DirectCameraCaptureProps {
  onUsePhoto: (photo: Blob) => void | Promise<void>;
  onCancel: () => void;
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export const DirectCameraCapture = ({ onUsePhoto, onCancel }: DirectCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [starting, setStarting] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  useEffect(() => {
    let active = true;
    let currentStream: MediaStream | null = null;
    setStarting(true);
    setCameraError('');
    setHasTorch(false);
    setTorchOn(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not available in this browser.');
      setStarting(false);
      return;
    }

    navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 960 },
      },
    }).then((stream) => {
      currentStream = stream;
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      setHasTorch(Boolean((track?.getCapabilities() as TorchCapabilities | undefined)?.torch));
      if (videoRef.current) videoRef.current.srcObject = stream;
      setStarting(false);
    }).catch(() => {
      if (!active) return;
      setCameraError('Camera access is required to capture a photo for your report.');
      setStarting(false);
    });

    return () => {
      active = false;
      currentStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === currentStream) streamRef.current = null;
    };
  }, [facingMode, cameraAttempt]);

  useEffect(() => () => {
    if (photo) URL.revokeObjectURL(photo.url);
  }, [photo]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (blob) setPhoto({ blob, url: URL.createObjectURL(blob) });
    }, 'image/jpeg', 0.9);
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: nextTorchState } as MediaTrackConstraintSet] });
      setTorchOn(nextTorchState);
    } catch {
      setHasTorch(false);
    }
  };

  const continueWithPhoto = async () => {
    if (!photo || saving) return;
    setSaving(true);
    await onUsePhoto(photo.blob);
    setSaving(false);
  };

  return (
    <main className="fixed inset-0 z-[70] flex min-h-[100dvh] flex-col bg-neutral-950 text-white">
      <header className="flex items-start justify-between gap-4 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <div>
          <h1 className="text-xl font-semibold">{photo ? 'Review Your Photo' : 'Capture Community Issue'}</h1>
          <p className="mt-1 max-w-sm text-sm text-white/70">
            {photo
              ? 'Make sure the community concern is clearly visible before continuing.'
              : 'Take a clear photo showing the issue you want to report.'}
          </p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Cancel report" onClick={onCancel} className="shrink-0 text-white hover:bg-white/10 hover:text-white">
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div className="relative mx-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl bg-black sm:mx-6">
        {photo ? (
          <img src={photo.url} alt="Captured community concern" className="h-full w-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            {starting && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950">
                <Loader2 className="h-8 w-8 animate-spin" />
                <p className="text-sm text-white/70">Opening camera...</p>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-neutral-950 px-8 text-center">
                <Camera className="h-10 w-10 text-white/70" />
                <p className="max-w-sm text-sm text-white/80">{cameraError}</p>
                <Button type="button" onClick={() => setCameraAttempt((attempt) => attempt + 1)}>
                  Allow Camera Access
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <footer className="flex min-h-28 items-center justify-center gap-5 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
        {photo ? (
          <>
            <Button type="button" variant="outline" size="lg" onClick={() => setPhoto(null)} className="min-h-12 border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white">
              <RotateCcw className="mr-2 h-4 w-4" /> Retake
            </Button>
            <Button type="button" size="lg" onClick={continueWithPhoto} disabled={saving} className="min-h-12">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
              Use Photo
            </Button>
          </>
        ) : (
          <>
            {hasTorch && (
              <Button type="button" variant="ghost" size="icon" aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'} onClick={toggleTorch} className="h-12 w-12 text-white hover:bg-white/10 hover:text-white">
                {torchOn ? <ZapOff className="h-5 w-5" /> : <Zap className="h-5 w-5" />}
              </Button>
            )}
            <Button
              type="button"
              aria-label="Take photo"
              disabled={starting || !!cameraError}
              onClick={capturePhoto}
              className="h-[4.5rem] w-[4.5rem] rounded-full border-[5px] border-white bg-primary p-0 shadow-lg hover:bg-primary/90"
            >
              <span className="sr-only">Capture photo</span>
              <Camera className="h-7 w-7" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Switch camera"
              onClick={() => setFacingMode((mode) => mode === 'environment' ? 'user' : 'environment')}
              className="h-12 w-12 text-white hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </>
        )}
      </footer>
    </main>
  );
};
