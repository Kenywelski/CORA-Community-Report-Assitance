import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Camera,
  ImagePlus,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import {
  DesktopWorkflowActions,
  ReportWorkflowSteps,
} from '@/features/residents/components/ReportWorkflowSteps';
import { CapturedGpsReading } from '@/lib/reportAnalysis';

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

export const DirectCameraCapture = ({
  onUsePhoto,
  onCancel,
}: DirectCameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraAttempt, setCameraAttempt] = useState(0);
  const [cameraError, setCameraError] = useState('');
  const [starting, setStarting] = useState(true);
  const [capturing, setCapturing] = useState(false);
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
          // Treat this maximumAge: 0 response as a newly captured reading.
          // DevTools custom locations otherwise keep their original timestamp.
          locationTimestamp: now,
          capturedAtTimestamp: now,
        });
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setGpsError('Location permission was denied. Please allow GPS access.');
        } else if (error.code === error.TIMEOUT) {
          setGpsError('GPS signal timed out. Please try again in an open area.');
        } else {
          setGpsError('Unable to acquire your current GPS coordinates.');
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

    setStarting(true);
    setCapturing(false);
    setCameraError('');

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError(
        'Camera access is not available in this browser. Open CORA in a browser with camera support.'
      );
      setStarting(false);
      return;
    }

    const startCamera = async () => {
      const candidates: MediaStreamConstraints[] = [
        {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        },
        { audio: false, video: true },
      ];

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        devices
          .filter(
            (device) =>
              device.kind === 'videoinput' &&
              device.deviceId &&
              !/virtual|obs|ir camera/i.test(device.label)
          )
          .forEach((device) => {
            candidates.push({
              audio: false,
              video: { deviceId: { exact: device.deviceId } },
            });
          });
      } catch {
        // The general camera constraints above remain available as fallbacks.
      }

      let lastError: Error | null = null;

      for (const constraints of candidates) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (!active) {
            stream.getTracks().forEach((track) => track.stop());
            return;
          }

          currentStream = stream;
          streamRef.current = stream;
          const video = videoRef.current;
          if (video) {
            video.srcObject = stream;
            video.muted = true;
            video.playsInline = true;
            await video.play().catch(() => undefined);
          }

          const track = stream.getVideoTracks()[0];
          track?.addEventListener(
            'ended',
            () => {
              if (!active) return;
              setStarting(false);
              setCapturing(false);
              setCameraError(
                'The camera connection stopped. Tap Retry Camera to reconnect.'
              );
            },
            { once: true }
          );

          if (video?.readyState && video.videoWidth && video.videoHeight) {
            setStarting(false);
          }
          return;
        } catch (error) {
          lastError = error as Error;
        }
      }

      if (!active) return;
      const permissionDenied =
        lastError?.name === 'NotAllowedError' ||
        lastError?.name === 'PermissionDeniedError';
      setCameraError(
        permissionDenied
          ? 'Camera permission was denied. Allow camera access in your browser settings, then tap Retry Camera.'
          : 'Camera access is unavailable. Check that a camera is connected and not being used by another app.'
      );
      setStarting(false);
    };

    void startCamera();

    return () => {
      active = false;
      currentStream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === currentStream) streamRef.current = null;
    };
  }, [cameraAttempt]);

  const retryCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCapturing(false);
    setCameraError('');
    setStarting(true);
    requestGpsLocation();
    setCameraAttempt((attempt) => attempt + 1);
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || starting || cameraError || capturing) return;

    const activeTrack = streamRef.current?.getVideoTracks()[0];
    if (!activeTrack || activeTrack.readyState !== 'live') {
      setCameraError(
        'The camera is not connected. Tap Retry Camera to reconnect.'
      );
      return;
    }

    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) {
      setCameraError('The camera is still starting. Tap Retry Camera and try again.');
      return;
    }

    setCapturing(true);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      setCapturing(false);
      setCameraError('The photo could not be captured. Please retry the camera.');
      return;
    }

    context.drawImage(video, 0, 0, width, height);
    const capturedAt = Date.now();
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          setCapturing(false);
          setCameraError('The photo could not be captured. Please try again.');
          return;
        }

        const localPreviewUrl = URL.createObjectURL(blob);
        try {
          await onUsePhoto(blob, {
            blob,
            localPreviewUrl,
            capturedAtTimestamp: capturedAt,
            gpsReading: gpsReading
              ? { ...gpsReading, capturedAtTimestamp: capturedAt }
              : null,
            gpsError,
          });
        } catch {
          setCapturing(false);
          setCameraError('The photo could not be processed. Please try again.');
        }
      },
      'image/jpeg',
      0.92
    );
  };

  const uploadTestPhoto = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file || capturing) return;

    setCapturing(true);
    setCameraError('');
    const capturedAt = Date.now();
    const localPreviewUrl = URL.createObjectURL(file);

    try {
      await onUsePhoto(file, {
        blob: file,
        localPreviewUrl,
        capturedAtTimestamp: capturedAt,
        gpsReading: gpsReading
          ? { ...gpsReading, capturedAtTimestamp: capturedAt }
          : null,
        gpsError,
      });
    } catch {
      URL.revokeObjectURL(localPreviewUrl);
      setCapturing(false);
      setCameraError('The test photo could not be processed. Please try again.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <>
      <main
        data-testid="direct-camera-capture"
        className="min-h-screen bg-background py-4 text-[#0E1F2C] dark:text-foreground"
      >
        <section className="app-container px-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            data-testid="temporary-upload-input"
            aria-label="Upload a temporary test photo"
            onChange={uploadTestPhoto}
            className="sr-only"
          />

          <ResidentPageHeader
            title="Report an Issue"
            subtitle="Submit a barangay concern in Barangay Purisima."
          />

          <div className="mt-5">
            <ReportWorkflowSteps currentStep={1} />
          </div>

          <div className="mt-5 rounded-2xl border border-[#DCE6EB] bg-card p-3 shadow-sm">
            <div className="flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-dashed border-[#C8D6DF] px-5 py-7 text-center dark:border-border">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                onLoadedMetadata={(event) => {
                  void event.currentTarget.play().catch(() => undefined);
                  setStarting(false);
                }}
                onCanPlay={(event) => {
                  void event.currentTarget.play().catch(() => undefined);
                  setStarting(false);
                }}
                onPlaying={() => setStarting(false)}
                className="pointer-events-none absolute h-px w-px opacity-0"
                aria-hidden="true"
              />

              <Camera className="h-14 w-14 text-primary" strokeWidth={2} />
              <h2 className="mt-2 text-2xl font-extrabold tracking-[-0.035em] text-[#07121F] dark:text-foreground">
                Take a Photo
              </h2>
              <p className="mt-1 max-w-sm text-sm leading-relaxed text-[#263D50] dark:text-muted-foreground">
                You must take a clear live photo of the issue using your device camera.
              </p>

              {cameraError && (
                <p
                  role="alert"
                  className="mt-3 flex max-w-md items-start justify-center gap-2 text-xs font-medium text-amber-700 dark:text-amber-300"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{cameraError}</span>
                </p>
              )}

              <div className="mt-6 w-full max-w-[345px] space-y-3">
                <Button
                  type="button"
                  data-testid="capture-concern-btn"
                  onClick={capturePhoto}
                  disabled={starting || !!cameraError || capturing}
                  className="h-11 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground shadow-sm hover:bg-primary/90"
                >
                  {capturing ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-5 w-5" />
                  )}
                  Take Photo
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="retry-camera-btn"
                  onClick={retryCamera}
                  className="h-11 w-full rounded-xl border-primary bg-card text-base font-bold text-primary opacity-100 shadow-sm hover:bg-primary/10 hover:text-primary dark:bg-card"
                >
                  <RefreshCw className="mr-2 h-5 w-5 text-primary" />
                  Retry Camera
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  data-testid="temporary-upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={capturing}
                  className="h-11 w-full rounded-xl border-dashed border-amber-500 bg-amber-50 text-sm font-bold text-amber-800 shadow-none hover:bg-amber-100 hover:text-amber-900 dark:bg-amber-500/10 dark:text-amber-200 dark:hover:bg-amber-500/20"
                >
                  <ImagePlus className="mr-2 h-5 w-5" />
                  Upload Test Photo (Temporary)
                </Button>
              </div>
            </div>
          </div>

          <DesktopWorkflowActions
            onBack={onCancel}
            onCancel={onCancel}
            continueDisabled
            showBack={false}
            className="mt-3"
          />

          <div className="mt-2 flex justify-end lg:hidden">
            <Button
              type="button"
              disabled
              className="h-10 rounded-xl bg-[#E4E8EA] px-6 font-bold text-[#A0AAB1] opacity-100 dark:bg-muted dark:text-muted-foreground"
            >
              Next
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </section>
      </main>
      <BottomNav currentPath="/report-issue" hideMobile />
    </>
  );
};
