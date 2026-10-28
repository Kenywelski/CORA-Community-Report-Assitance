import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Loader2,
  MapPin,
  RefreshCw,
  X,
  Zap,
  ZapOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CapturedGpsReading } from '@/lib/mobilenetReportPipeline';

export interface CameraCapturePayload {
  blob: Blob;
  localPreviewUrl: string;
  capturedAtTimestamp: number;
  gpsReading: CapturedGpsReading | null;
  gpsError: string | null;
}

interface DirectCameraCaptureProps {
  onUsePhoto: (
    photo: Blob,
    payload?: CameraCapturePayload
  ) => void | Promise<void>;
  onCancel: () => void;
}

interface TorchCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
}

export const DirectCameraCapture = ({
  onUsePhoto,
  onCancel,
}: DirectCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>(
    'environment'
  );
  const [cameraError, setCameraError] = useState('');
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [starting, setStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  // GPS state requested automatically when the camera opens
  const [gpsReading, setGpsReading] = useState<CapturedGpsReading | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const requestGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(
        'Geolocation is not supported by this browser. Please enable location services.'
      );
      setGpsLoading(false);
      return;
    }

    setGpsLoading(true);
    setGpsError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const now = Date.now();
        setGpsReading({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          locationTimestamp: position.timestamp || now,
          capturedAtTimestamp: now,
        });
        setGpsLoading(false);
        setGpsError(null);
      },
      (err) => {
        setGpsLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setGpsError(
            'Location permission was denied. Please allow GPS access and tap Retry GPS.'
          );
        } else if (err.code === err.TIMEOUT) {
          setGpsError(
            'GPS signal timed out. Move to an area with a clear sky view and tap Retry GPS.'
          );
        } else {
          setGpsError(
            'Unable to acquire your current GPS coordinates. Please check device location settings and tap Retry GPS.'
          );
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  }, []);

  // Automatically request GPS location when camera interface opens
  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  useEffect(() => {
    let active = true;
    let currentStream: MediaStream | null = null;
    setStarting(true);
    setCameraError('');
    setHasTorch(false);
    setTorchOn(false);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access is not available in this browser. Please open CORA in a browser with camera support.'
      );
      setStarting(false);
      return;
    }

    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
      })
      .then((stream) => {
        currentStream = stream;
        if (!active) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        const track = stream.getVideoTracks()[0];
        setHasTorch(
          Boolean(
            (track?.getCapabilities() as TorchCapabilities | undefined)?.torch
          )
        );
        if (videoRef.current) videoRef.current.srcObject = stream;
        setStarting(false);
      })
      .catch((err: Error) => {
        if (!active) return;
        const isDenied =
          err?.name === 'NotAllowedError' ||
          err?.name === 'PermissionDeniedError';
        setCameraError(
          isDenied
            ? 'Camera permission was denied. Please allow camera access in your browser address bar or settings, then tap Retry Camera.'
            : 'Camera access is required to capture a photo of the community concern. Please ensure a camera is connected and not in use by another app.'
        );
        setStarting(false);
      });

    return () => {
      active = false;
      currentStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === currentStream) streamRef.current = null;
    };
  }, [facingMode, cameraAttempt]);

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight || capturing) return;

    setCapturing(true);

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      setCapturing(false);
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const capturedAt = Date.now();

    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setCapturing(false);
          return;
        }
        const localPreviewUrl = URL.createObjectURL(blob);
        await onUsePhoto(blob, {
          blob,
          localPreviewUrl,
          capturedAtTimestamp: capturedAt,
          gpsReading: gpsReading
            ? { ...gpsReading, capturedAtTimestamp: capturedAt }
            : null,
          gpsError,
        });
      },
      'image/jpeg',
      0.92
    );
  };

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const nextTorchState = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: nextTorchState } as MediaTrackConstraintSet],
      });
      setTorchOn(nextTorchState);
    } catch {
      setHasTorch(false);
    }
  };

  return (
    <main
      data-testid="direct-camera-capture"
      className="fixed inset-0 z-[70] flex min-h-[100dvh] flex-col bg-[#142B38] text-white"
    >
      {/* Top Header */}
      <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-[#142B38]/95 px-5 pb-3.5 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-1.5 rounded-md bg-[#177A73]/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#EAF6F4] ring-1 ring-white/15">
            <span>Barangay Purisima · Report an Issue</span>
          </div>
          <h1 className="mt-1.5 text-lg font-bold tracking-tight sm:text-xl">
            Capture Community Concern
          </h1>
          <p className="mt-0.5 max-w-md text-xs text-slate-300 sm:text-sm">
            Take a clear photo of the issue. AI will automatically identify the concern and prepare your report.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel report"
          onClick={onCancel}
          className="shrink-0 rounded-xl text-white hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      {/* GPS Status Bar inside Camera View */}
      <div className="mx-3 mt-2.5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3.5 py-2 text-xs sm:mx-6">
        <div className="flex min-w-0 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-[#EAF6F4]" />
          {gpsLoading ? (
            <span className="flex items-center gap-1.5 text-slate-200">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-[#EAF6F4]" />
              <span>Detecting GPS coordinates in Barangay Purisima...</span>
            </span>
          ) : gpsReading ? (
            <span className="truncate font-medium text-emerald-300">
              GPS Ready: {gpsReading.lat.toFixed(5)}, {gpsReading.lng.toFixed(5)}{' '}
              (±{Math.round(gpsReading.accuracyMeters)}m)
            </span>
          ) : (
            <span className="text-amber-300">
              {gpsError || 'GPS location permission is required for location verification.'}
            </span>
          )}
        </div>
        {(gpsError || !gpsReading) && !gpsLoading && (
          <button
            type="button"
            onClick={requestGpsLocation}
            data-testid="retry-gps-capture-btn"
            className="shrink-0 rounded-lg bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/25"
          >
            Retry GPS
          </button>
        )}
      </div>

      {/* Live Camera Viewfinder */}
      <div className="relative mx-3 my-2.5 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-white/15 bg-black sm:mx-6">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {starting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#142B38]/95">
            <Loader2 className="h-8 w-8 animate-spin text-[#EAF6F4]" />
            <p className="text-sm font-medium text-slate-200">
              Opening camera...
            </p>
          </div>
        )}
        {cameraError && (
          <div
            data-testid="camera-permission-error"
            className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#142B38]/95 px-6 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F36B3F]/20 text-[#F36B3F]">
              <AlertCircle className="h-8 w-8" />
            </div>
            <div className="max-w-md space-y-1.5">
              <h2 className="text-base font-bold text-white">
                Camera Permission Required
              </h2>
              <p className="text-xs leading-relaxed text-slate-300 sm:text-sm">
                {cameraError}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
              <Button
                type="button"
                data-testid="retry-camera-btn"
                onClick={() => setCameraAttempt((attempt) => attempt + 1)}
                className="rounded-xl bg-[#177A73] px-5 text-white hover:bg-[#12625D]"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Retry Camera Access
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                className="rounded-xl border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                Back
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Capture Bar */}
      <footer className="flex min-h-24 flex-col items-center justify-center gap-3 border-t border-white/10 bg-[#142B38] px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="flex w-full max-w-md items-center justify-between gap-4">
          <div className="flex w-12 justify-start">
            {hasTorch && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
                onClick={toggleTorch}
                className="h-11 w-11 rounded-xl text-white hover:bg-white/10 hover:text-white"
              >
                {torchOn ? (
                  <ZapOff className="h-5 w-5" />
                ) : (
                  <Zap className="h-5 w-5" />
                )}
              </Button>
            )}
          </div>

          <Button
            type="button"
            data-testid="capture-concern-btn"
            disabled={starting || !!cameraError || capturing}
            onClick={capturePhoto}
            className="h-14 flex-1 gap-2.5 rounded-2xl bg-[#F36B3F] px-6 text-base font-bold text-white shadow-lg transition-transform hover:bg-[#dc5a30] active:scale-[0.99] disabled:opacity-50"
          >
            {capturing ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Capturing...</span>
              </>
            ) : (
              <>
                <Camera className="h-5 w-5" />
                <span>Capture</span>
              </>
            )}
          </Button>

          <div className="flex w-12 justify-end">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Switch camera"
              onClick={() =>
                setFacingMode((mode) =>
                  mode === 'environment' ? 'user' : 'environment'
                )
              }
              className="h-11 w-11 rounded-xl text-white hover:bg-white/10 hover:text-white"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </footer>
    </main>
  );
};
