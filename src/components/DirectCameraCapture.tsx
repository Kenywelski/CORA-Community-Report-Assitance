import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Camera,
  Loader2,
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

  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);

  // Silent background GPS acquisition when camera opens
  const [gpsReading, setGpsReading] = useState<CapturedGpsReading | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);

  const requestGpsLocation = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsError(
        'Geolocation is not supported by this browser. Please enable location services.'
      );
      return;
    }

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
        setGpsError(null);
      },
      (err) => {
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

  useEffect(() => {
    requestGpsLocation();
  }, [requestGpsLocation]);

  useEffect(() => {
    let active = true;
    let currentStream: MediaStream | null = null;
    let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
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

    const isVideoFrameCompletelyBlack = (videoEl: HTMLVideoElement): boolean => {
      try {
        if (!videoEl.videoWidth || !videoEl.videoHeight) return true;
        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = 16;
        sampleCanvas.height = 16;
        const ctx = sampleCanvas.getContext('2d');
        if (!ctx) return false;
        ctx.drawImage(videoEl, 0, 0, 16, 16);
        const data = ctx.getImageData(0, 0, 16, 16).data;
        let maxChannel = 0;
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (r > maxChannel) maxChannel = r;
          if (g > maxChannel) maxChannel = g;
          if (b > maxChannel) maxChannel = b;
        }
        return maxChannel < 3;
      } catch {
        return false;
      }
    };

    const attachAndPlayStream = async (stream: MediaStream) => {
      if (currentStream && currentStream !== stream) {
        currentStream.getTracks().forEach((t) => t.stop());
      }
      currentStream = stream;
      if (!active) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;

      if (navigator.mediaDevices?.enumerateDevices) {
        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => {
            if (!active) return;
            const inputs = devices.filter((d) => d.kind === 'videoinput');
            setVideoDevices(inputs);
          })
          .catch(() => {});
      }

      const track = stream.getVideoTracks()[0];
      try {
        setHasTorch(
          Boolean(
            (track?.getCapabilities?.() as TorchCapabilities | undefined)?.torch
          )
        );
      } catch {
        setHasTorch(false);
      }

      const videoEl = videoRef.current;
      if (videoEl) {
        videoEl.srcObject = stream;
        videoEl.muted = true;
        videoEl.playsInline = true;
        videoEl.setAttribute('playsinline', 'true');
        videoEl.setAttribute('webkit-playsinline', 'true');
        try {
          await videoEl.play();
        } catch {
          // Playback will also be triggered by onLoadedMetadata / onCanPlay
        }
      }
      setStarting(false);
    };

    const startCameraStream = async () => {
      const constraintCandidates: MediaStreamConstraints[] = [];

      if (selectedDeviceId) {
        constraintCandidates.push({
          audio: false,
          video: {
            deviceId: { exact: selectedDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      }

      constraintCandidates.push(
        {
          audio: false,
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        {
          audio: false,
          video: {
            facingMode: facingMode,
          },
        },
        {
          audio: false,
          video: true,
        }
      );

      let lastErr: Error | null = null;
      for (const constraints of constraintCandidates) {
        if (!active) return;
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          await attachAndPlayStream(stream);

          // Watchdog: if camera track opened but is paused, 0x0, or an inactive black virtual camera, try recovering
          watchdogTimer = setTimeout(async () => {
            if (!active) return;
            const v = videoRef.current;
            if (!v) return;
            if (v.paused) {
              try {
                await v.play();
              } catch {
                // ignore
              }
            }
            if (v.videoWidth === 0 || isVideoFrameCompletelyBlack(v)) {
              try {
                const devices =
                  await navigator.mediaDevices.enumerateDevices();
                const inputs = devices.filter((d) => d.kind === 'videoinput');
                const activeDeviceId = stream
                  .getVideoTracks()[0]
                  ?.getSettings?.()?.deviceId;
                const alternative = inputs.find(
                  (d) =>
                    d.deviceId &&
                    d.deviceId !== activeDeviceId &&
                    !/virtual|obs|ir camera/i.test(d.label)
                );
                if (alternative) {
                  const altStream = await navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: { deviceId: { exact: alternative.deviceId } },
                  });
                  await attachAndPlayStream(altStream);
                } else if (v.videoWidth === 0) {
                  const fallbackStream =
                    await navigator.mediaDevices.getUserMedia({
                      audio: false,
                      video: true,
                    });
                  await attachAndPlayStream(fallbackStream);
                }
              } catch {
                // keep existing stream if fallback fails
              }
            }
          }, 1800);

          return;
        } catch (err) {
          lastErr = err as Error;
        }
      }

      if (!active) return;
      const isDenied =
        lastErr?.name === 'NotAllowedError' ||
        lastErr?.name === 'PermissionDeniedError';
      setCameraError(
        isDenied
          ? 'Camera permission was denied. Please allow camera access in your browser address bar or settings, then tap Retry Camera.'
          : 'Camera access is required to capture a photo of the community concern. Please ensure a camera is connected and not in use by another app.'
      );
      setStarting(false);
    };

    void startCameraStream();

    return () => {
      active = false;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      currentStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === currentStream) streamRef.current = null;
    };
  }, [facingMode, selectedDeviceId, cameraAttempt]);

  const handleSwitchCamera = () => {
    if (videoDevices.length > 1) {
      const currentTrackId = streamRef.current
        ?.getVideoTracks()[0]
        ?.getSettings?.()?.deviceId;
      const currentIndex = videoDevices.findIndex(
        (d) => d.deviceId === (selectedDeviceId || currentTrackId)
      );
      const nextIndex = (currentIndex + 1) % videoDevices.length;
      const nextDevice = videoDevices[nextIndex];
      if (nextDevice?.deviceId) {
        setSelectedDeviceId(nextDevice.deviceId);
        return;
      }
    }
    setSelectedDeviceId(null);
    setFacingMode((mode) => (mode === 'environment' ? 'user' : 'environment'));
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || capturing) return;

    const width = video.videoWidth || video.clientWidth || 1280;
    const height = video.videoHeight || video.clientHeight || 720;
    if (!width || !height) return;

    setCapturing(true);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
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
      className="fixed inset-0 z-[70] h-screen h-[100dvh] w-full overflow-hidden bg-black text-white select-none"
    >
      {/* Full-Screen Live Camera Viewfinder */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        onLoadedMetadata={(e) => {
          const el = e.currentTarget;
          void el.play().catch(() => {});
          setStarting(false);
        }}
        onCanPlay={(e) => {
          void e.currentTarget.play().catch(() => {});
          setStarting(false);
        }}
        onPlaying={() => {
          setStarting(false);
        }}
        onClick={(e) => {
          void e.currentTarget.play().catch(() => {});
        }}
        className="absolute inset-0 block h-full w-full object-cover"
      />

      {/* Floating Top Bar (Close & Flash only, like a native phone camera) */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="pointer-events-auto">
          {hasTorch && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={torchOn ? 'Turn flash off' : 'Turn flash on'}
              onClick={toggleTorch}
              className="h-11 w-11 rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
            >
              {torchOn ? (
                <ZapOff className="h-5 w-5 text-amber-400" />
              ) : (
                <Zap className="h-5 w-5" />
              )}
            </Button>
          )}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Cancel report"
          onClick={onCancel}
          className="pointer-events-auto h-11 w-11 rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Camera Starting Indicator */}
      {starting && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/90">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Camera Permission Error Overlay */}
      {cameraError && (
        <div
          data-testid="camera-permission-error"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/95 px-6 text-center"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#F36B3F]/20 text-[#F36B3F]">
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
              className="rounded-full bg-[#177A73] px-5 text-white hover:bg-[#12625D]"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry Camera Access
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="rounded-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
            >
              Back
            </Button>
          </div>
        </div>
      )}

      {/* Native Phone Camera Bottom Control Bar */}
      <footer className="absolute inset-x-0 bottom-0 z-20 flex items-center justify-center bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-[max(2rem,env(safe-area-inset-bottom))] pt-8">
        <div className="flex w-full max-w-sm items-center justify-between">
          <div className="h-12 w-12" />

          <button
            type="button"
            data-testid="capture-concern-btn"
            aria-label="Capture photo"
            disabled={starting || !!cameraError || capturing}
            onClick={capturePhoto}
            className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white bg-white/15 p-1.5 shadow-2xl backdrop-blur-sm transition-transform active:scale-95 disabled:opacity-40"
          >
            <span className="flex h-full w-full items-center justify-center rounded-full bg-white text-slate-900 transition-transform group-hover:scale-95">
              {capturing ? (
                <Loader2 className="h-7 w-7 animate-spin text-[#177A73]" />
              ) : (
                <Camera className="h-7 w-7 text-slate-900" />
              )}
            </span>
          </button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Switch camera"
            onClick={handleSwitchCamera}
            className="h-12 w-12 rounded-full bg-black/45 text-white backdrop-blur-md hover:bg-black/65 hover:text-white"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </footer>
    </main>
  );
};

