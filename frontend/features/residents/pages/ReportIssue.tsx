import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  type TouchEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import { LocationPicker } from '@/features/reports/components/LocationPicker';
import { CancelReportButton } from '@/features/residents/components/ReportWorkflowSteps';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/features/auth/useAuth';
import {
  APPROVED_CONCERN_CATEGORIES,
  type ApprovedConcernCategoryKey,
  type CapturedGpsReading,
  type GpsValidationResult,
  resolveApprovedCategory,
  validateCapturedGpsLocation,
} from '@/lib/reportAnalysis';
import { cn } from '@/lib/utils';
import { useAppPreferences } from '@/lib/preferences';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  CameraOff,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FilePenLine,
  ImagePlus,
  ImageOff,
  Layers3,
  Loader2,
  LocateFixed,
  MapPin,
  MessageSquare,
  Phone,
  RefreshCw,
  Send,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';

type ReportStage = 'capture' | 'review' | 'submitted';

const reportDraftValues = new Map<string, unknown>();
const reportDraftListeners = new Set<() => void>();

function subscribeToReportDraft(listener: () => void) {
  reportDraftListeners.add(listener);
  return () => {
    reportDraftListeners.delete(listener);
  };
}

function useReportDraftState<T>(
  scope: string,
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const storageKey = `${scope}:${key}`;
  const getSnapshot = useCallback(
    () => reportDraftValues.has(storageKey)
      ? reportDraftValues.get(storageKey) as T
      : initialValue,
    [initialValue, storageKey],
  );
  const value = useSyncExternalStore(
    subscribeToReportDraft,
    getSnapshot,
    getSnapshot,
  );
  const setValue = useCallback<Dispatch<SetStateAction<T>>>(
    (action) => {
      const previousValue = reportDraftValues.has(storageKey)
        ? reportDraftValues.get(storageKey) as T
        : initialValue;
      const nextValue = typeof action === 'function'
        ? (action as (previousValue: T) => T)(previousValue)
        : action;
      if (Object.is(previousValue, nextValue)) return;

      reportDraftValues.set(storageKey, nextValue);
      reportDraftListeners.forEach((listener) => listener());
    },
    [initialValue, storageKey],
  );

  return [value, setValue];
}

interface ReportPalette {
  page: string;
  card: string;
  panel: string;
  border: string;
  text: string;
  mutedText: string;
  primary: string;
  primaryText: string;
  soft: string;
  softText: string;
  input: string;
  camera: string;
  shadow: string;
}

const REPORT_PALETTES: Record<'light' | 'dark', ReportPalette> = {
  light: {
    page: 'hsl(var(--card))',
    card: '#FFFFFF',
    panel: '#FFFFFF',
    border: '#D9E4E4',
    text: '#0C1B38',
    mutedText: '#4A6077',
    primary: '#087E70',
    primaryText: '#FFFFFF',
    soft: '#E8F8F4',
    softText: '#204A48',
    input: '#FFFFFF',
    camera: '#102E2B',
    shadow: '0 14px 40px rgba(26, 60, 72, 0.08)',
  },
  dark: {
    page: 'hsl(var(--background))',
    card: '#0D1D24',
    panel: '#101F27',
    border: '#273e49',
    text: '#F1F5F9',
    mutedText: '#CBD5E1',
    primary: '#34D399',
    primaryText: '#052E2B',
    soft: 'rgba(52, 211, 153, 0.10)',
    softText: '#D1FAE5',
    input: '#0B1920',
    camera: '#073B36',
    shadow: '0 14px 40px rgba(0, 0, 0, 0.28)',
  },
};

const PURISIMA_PUROKS = [
  'Purok Avocado Evergreen',
  'Purok Avocado Maroon',
  'Purok Calamansi',
  'Purok Citrus I',
  'Purok Citrus II',
  'Purok Grapes',
  'Purok Mangga I',
  'Purok Mangga II',
  'Purok Tambis',
];

const formatCapturedDate = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'Not captured yet';

type AnalysisStatus =
  | 'idle'
  | 'checking'
  | 'accepted'
  | 'blurry'
  | 'rejected'
  | 'recapture_required'
  | 'duplicate'
  | 'gps_retry'
  | 'outside'
  | 'error';

interface ReportWorkflowResponse {
  status: string;
  message: string;
  analysisId?: string;
  reportId?: string;
  category?: string;
  title?: string;
  description?: string;
  possibleDuplicate?: boolean;
}

class ReportWorkflowError extends Error {
  constructor(
    message: string,
    readonly status: AnalysisStatus,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function readWorkflowProgress(
  response: Response,
  onProgress: (message: string) => void,
): Promise<{
  payload: Record<string, unknown>;
  httpStatus: number;
  isError: boolean;
}> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Report processing ended before a result was received.');

  const decoder = new TextDecoder();
  let buffer = '';
  let outcome: Record<string, unknown> | null = null;
  const processEvent = (block: string) => {
    const dataLine = block.split('\n').find((line) => line.startsWith('data:'));
    if (!dataLine) return;
    const event: unknown = JSON.parse(dataLine.slice(5).trim());
    if (!isRecord(event) || typeof event.type !== 'string') {
      throw new Error('Report processing returned an invalid progress event.');
    }
    if (event.type === 'progress') {
      if (typeof event.message !== 'string') {
        throw new Error('Report processing returned an invalid progress message.');
      }
      onProgress(event.message);
      return;
    }
    if (event.type === 'result' || event.type === 'error') {
      outcome = event;
      return;
    }
    throw new Error('Report processing returned an unknown progress event.');
  };

  while (true) {
    const { done, value } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');
    let boundary = buffer.indexOf('\n\n');
    while (boundary >= 0) {
      processEvent(buffer.slice(0, boundary));
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf('\n\n');
    }
    if (done) {
      buffer += decoder.decode();
      if (buffer.trim()) processEvent(buffer);
      break;
    }
  }

  if (!outcome || typeof outcome.status !== 'string' || typeof outcome.message !== 'string') {
    throw new Error('Report processing ended before a result was received.');
  }
  return {
    payload: outcome,
    httpStatus: typeof outcome.httpStatus === 'number' ? outcome.httpStatus : response.status,
    isError: outcome.type === 'error',
  };
}

async function callReportWorkflow(
  path: string,
  form: FormData,
  onProgress?: (message: string) => void,
): Promise<ReportWorkflowResponse> {
  const apiUrl = import.meta.env.VITE_CORA_API_URL?.trim();
  if (!apiUrl) throw new Error('Report processing is temporarily unavailable.');

  const { data: { session } } = await supabase.auth.getSession();
  const headers: Record<string, string> = {};
  if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
  if (onProgress) headers.Accept = 'text/event-stream';
  const response = await fetch(`${apiUrl.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: Object.keys(headers).length ? headers : undefined,
    body: form,
    signal: AbortSignal.timeout(600_000),
  });
  let payload: unknown;
  let httpStatus = response.status;
  let isStreamError = false;
  if (response.headers.get('content-type')?.includes('text/event-stream')) {
    const outcome = await readWorkflowProgress(response, onProgress ?? (() => undefined));
    payload = outcome.payload;
    httpStatus = outcome.httpStatus;
    isStreamError = outcome.isError;
  } else {
    payload = await response.json().catch(() => null);
  }
  if (
    !isRecord(payload) ||
    typeof payload.status !== 'string' ||
    typeof payload.message !== 'string'
  ) {
    throw new Error('Report processing is temporarily unavailable.');
  }
  if (!response.ok || httpStatus >= 400 || isStreamError) {
    const status: AnalysisStatus = [
      'blurry',
      'rejected',
      'recapture_required',
      'duplicate',
      'gps_retry',
      'outside',
    ].includes(payload.status)
      ? payload.status as AnalysisStatus
      : 'error';
    throw new ReportWorkflowError(payload.message, status);
  }
  return {
    status: payload.status,
    message: payload.message,
    analysisId: typeof payload.analysisId === 'string' ? payload.analysisId : undefined,
    reportId: typeof payload.reportId === 'string' ? payload.reportId : undefined,
    category: typeof payload.category === 'string' ? payload.category : undefined,
    title: typeof payload.title === 'string' ? payload.title : undefined,
    description: typeof payload.description === 'string' ? payload.description : undefined,
    possibleDuplicate: payload.possibleDuplicate === true,
  };
}

const MobileReportProgress = ({ step }: { step: 1 | 2 | 3 }) => {
  const steps = ['Photo', 'Details', 'Submit'] as const;

  return (
    <div
      className="grid grid-cols-3 px-5 pb-3 pt-2"
      aria-label={`Report step ${step} of 3`}
    >
      {steps.map((label, index) => {
        const number = (index + 1) as 1 | 2 | 3;
        const complete = number < step;
        const active = number === step;
        return (
          <div
            key={label}
            className="relative flex min-w-0 flex-col items-center"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className={cn(
                  'absolute right-1/2 top-[11px] h-px w-full',
                  number <= step
                    ? 'bg-[#39A77A]'
                    : 'bg-[#D7E1E8] dark:bg-[#35534f]',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold',
                complete && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary bg-primary text-primary-foreground',
                !complete &&
                  !active &&
                  'border-[#CBD8E2] bg-white text-[#425B6B] dark:border-[#52706a] dark:bg-[#0B1920] dark:text-slate-200',
              )}
            >
              {complete ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : number}
            </span>
            <span
              className={cn(
                'relative z-10 mt-1 text-[10px] leading-none',
                active
                  ? 'font-bold text-primary dark:text-teal-300'
                  : 'font-medium text-muted-foreground dark:text-slate-300',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
};

const ReportIssue = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const isGuestMode = searchParams.get('mode') === 'guest';
  const reportDraftScope = `resident:${user?.id ?? 'anonymous'}`;
  const { theme } = useAppPreferences();
  const palette = REPORT_PALETTES[theme];

  const [stage, setStage] = useReportDraftState<ReportStage>(reportDraftScope, 'stage', 'capture');
  const [cameraStarting, setCameraStarting] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useReportDraftState<Blob | null>(reportDraftScope, 'photoBlob', null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useReportDraftState<string | null>(reportDraftScope, 'photoPreviewUrl', null);
  const [capturedAt, setCapturedAt] = useReportDraftState<string | null>(reportDraftScope, 'capturedAt', null);
  const [selectedCategory, setSelectedCategory] = useReportDraftState<ApprovedConcernCategoryKey | ''>(
    reportDraftScope,
    'selectedCategory',
    '',
  );
  const [reportTitle, setReportTitle] = useReportDraftState(reportDraftScope, 'reportTitle', '');
  const [description, setDescription] = useReportDraftState(reportDraftScope, 'description', '');
  const [reporterName, setReporterName] = useReportDraftState(reportDraftScope, 'reporterName', '');
  const [reporterContact, setReporterContact] = useReportDraftState(reportDraftScope, 'reporterContact', '');
  const [purok, setPurok] = useReportDraftState(reportDraftScope, 'purok', '');
  const [gpsReading, setGpsReading] = useReportDraftState<CapturedGpsReading | null>(
    reportDraftScope,
    'gpsReading',
    null,
  );
  const [gpsValidation, setGpsValidation] =
    useReportDraftState<GpsValidationResult | null>(reportDraftScope, 'gpsValidation', null);
  const [gpsLoading, setGpsLoading] = useReportDraftState(reportDraftScope, 'gpsLoading', false);
  const [gpsError, setGpsError] = useReportDraftState<string | null>(reportDraftScope, 'gpsError', null);
  const [isSubmitting, setIsSubmitting] = useReportDraftState(reportDraftScope, 'isSubmitting', false);
  const [submittedReportId, setSubmittedReportId] = useReportDraftState<string | null>(
    reportDraftScope,
    'submittedReportId',
    null,
  );
  const [isTestAccount, setIsTestAccount] = useState(false);
  const [analysisStatus, setAnalysisStatus] = useReportDraftState<AnalysisStatus>(
    reportDraftScope,
    'analysisStatus',
    'idle',
  );
  const [analysisMessage, setAnalysisMessage] = useReportDraftState(reportDraftScope, 'analysisMessage', '');
  const [analysisId, setAnalysisId] = useReportDraftState<string | null>(
    reportDraftScope,
    'analysisId',
    null,
  );
  const [possibleDuplicate, setPossibleDuplicate] = useReportDraftState(
    reportDraftScope,
    'possibleDuplicate',
    false,
  );
  const [captureMode, setCaptureMode] = useReportDraftState<'camera' | 'upload'>(
    reportDraftScope,
    'captureMode',
    'camera',
  );
  const [submissionFailed, setSubmissionFailed] = useReportDraftState(
    reportDraftScope,
    'submissionFailed',
    false,
  );
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const analysisInFlight = useRef(false);

  useLayoutEffect(() => {
    const root = document.getElementById('root');
    const previousRootBackground = root?.style.backgroundColor ?? '';
    const previousBodyBackground = document.body.style.backgroundColor;
    const previousDocumentBackground = document.documentElement.style.backgroundColor;
    const previousRootOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    const previousRootOverscroll = document.documentElement.style.overscrollBehavior;
    const previousBodyOverscroll = document.body.style.overscrollBehavior;
    const existingThemeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const previousThemeColor = existingThemeColor?.content;
    const createdThemeColor = stage === 'capture' && !existingThemeColor;
    const themeColor = existingThemeColor ?? (createdThemeColor ? document.createElement('meta') : null);
    const pageBackground = stage === 'capture' ? '#ffffff' : palette.page;

    if (root) root.style.backgroundColor = pageBackground;
    document.body.style.backgroundColor = pageBackground;
    document.documentElement.style.backgroundColor = pageBackground;
    if (stage === 'capture') {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overscrollBehavior = 'none';
      document.body.style.overscrollBehavior = 'none';
      if (themeColor) {
        themeColor.name = 'theme-color';
        themeColor.content = '#ffffff';
        if (createdThemeColor) document.head.append(themeColor);
      }
    }

    return () => {
      if (root) root.style.backgroundColor = previousRootBackground;
      document.body.style.backgroundColor = previousBodyBackground;
      document.documentElement.style.backgroundColor = previousDocumentBackground;
      document.documentElement.style.overflow = previousRootOverflow;
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overscrollBehavior = previousRootOverscroll;
      document.body.style.overscrollBehavior = previousBodyOverscroll;
      if (themeColor && stage === 'capture') {
        if (createdThemeColor) themeColor.remove();
        else if (previousThemeColor !== undefined) themeColor.content = previousThemeColor;
      }
    };
  }, [palette.page, stage]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const mobileVideoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const cameraRefreshTouchRef = useRef<{ x: number; y: number } | null>(null);

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setTorchEnabled(false);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (mobileVideoRef.current) mobileVideoRef.current.srcObject = null;
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) {
      toast.error('Camera torch is unavailable.');
      return;
    }

    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & {
      torch?: boolean;
    };
    if (!torchSupported && !capabilities?.torch) {
      toast.error('Torch is not supported by this camera.');
      return;
    }

    const nextEnabled = !torchEnabled;
    try {
      const torchConstraint: MediaTrackConstraintSet & { torch: boolean } = {
        torch: nextEnabled,
      };
      await track.applyConstraints({
        advanced: [torchConstraint],
      });
      setTorchEnabled(nextEnabled);
    } catch {
      toast.error('Unable to change the camera torch.');
    }
  }, [torchEnabled, torchSupported]);

  const startCamera = useCallback(async () => {
    stopCamera();
    setCameraStarting(true);
    setCameraError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraStarting(false);
      setCameraError(
        'Direct camera capture is not available in this browser. Use a browser or device with camera support to report an issue.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      streamRef.current = stream;
      setTorchEnabled(false);
      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.() as MediaTrackCapabilities & {
        torch?: boolean;
      };
      setTorchSupported(capabilities?.torch === true);
      const videos = [videoRef.current, mobileVideoRef.current].filter(
        (video): video is HTMLVideoElement => video !== null,
      );
      await Promise.all(
        videos.map(async (video) => {
          video.srcObject = stream;
          await video.play();
        }),
      );
      if (videos.length === 0) {
        throw new Error('The camera preview is unavailable.');
      }
    } catch {
      setCameraError(
        'Camera access was blocked or unavailable. Allow camera permission, then try again.',
      );
    } finally {
      setCameraStarting(false);
    }
  }, [stopCamera]);

  const handleCameraTouchStart = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const target = event.target;
      if (
        cameraStarting ||
        (target instanceof Element &&
          target.closest('button, input, textarea, select, a, [data-camera-controls]'))
      ) {
        cameraRefreshTouchRef.current = null;
        return;
      }

      const touch = event.touches[0];
      cameraRefreshTouchRef.current = touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
    },
    [cameraStarting],
  );

  const handleCameraTouchEnd = useCallback(
    (event: TouchEvent<HTMLElement>) => {
      const start = cameraRefreshTouchRef.current;
      cameraRefreshTouchRef.current = null;
      const touch = event.changedTouches[0];
      if (!start || !touch || cameraStarting) return;

      const deltaY = touch.clientY - start.y;
      const deltaX = Math.abs(touch.clientX - start.x);
      if (deltaY >= 80 && deltaX < 80) void startCamera();
    },
    [cameraStarting, startCamera],
  );

  const requestFreshGps = useCallback((): Promise<CapturedGpsReading | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        setGpsError('This browser does not support device location.');
        setGpsValidation(validateCapturedGpsLocation(null));
        resolve(null);
        return;
      }

      setGpsLoading(true);
      setGpsError(null);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const now = Date.now();
          const reading: CapturedGpsReading = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            // Timestamp when CORA receives this maximumAge: 0 reading. Chrome
            // DevTools reuses the time when its custom location was created,
            // even when getCurrentPosition is requested again.
            locationTimestamp: now,
            capturedAtTimestamp: now,
          };
          setGpsReading(reading);
          setGpsValidation(validateCapturedGpsLocation(reading, now));
          setGpsLoading(false);
          resolve(reading);
        },
        (error) => {
          const message =
            error.code === error.PERMISSION_DENIED
              ? 'Location permission is required to verify that the issue is inside Barangay Purisima.'
              : 'Unable to get an accurate location. Turn on GPS and try again.';
          setGpsError(message);
          setGpsValidation(validateCapturedGpsLocation(null));
          setGpsLoading(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    });
  }, [setGpsError, setGpsLoading, setGpsReading, setGpsValidation]);

  useEffect(() => {
    if (stage === 'capture') void startCamera();
    else stopCamera();

    return stopCamera;
  }, [stage, startCamera, stopCamera]);

  useEffect(() => {
    let active = true;
    setIsTestAccount(false);
    if (!user || isGuestMode) return;

    void supabase
      .from('profiles')
      .select('is_test_account')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Test account access check failed:', error);
          return;
        }
        setIsTestAccount(data?.is_test_account === true);
      });

    return () => {
      active = false;
    };
  }, [isGuestMode, user]);

  useEffect(() => {
    const field = descriptionRef.current;
    if (!field || stage !== 'review') return;

    field.style.height = 'auto';
    field.style.height = `${Math.max(96, field.scrollHeight)}px`;
  }, [description, stage]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const analyzePhoto = useCallback(
    async (
      blob: Blob | null = photoBlob,
      mode: 'camera' | 'upload' = captureMode,
    ) => {
    if (!blob || analysisInFlight.current) return;
    analysisInFlight.current = true;
    setAnalysisId(null);
    setPossibleDuplicate(false);
    setAnalysisStatus('checking');
    setAnalysisMessage('Checking your location...');

    try {
      const reading = await requestFreshGps();
      const locationValidation = validateCapturedGpsLocation(reading);
      setGpsValidation(locationValidation);
      if (!reading || !locationValidation.isAccurate || !locationValidation.isFresh) {
        setAnalysisStatus('gps_retry');
        setAnalysisMessage('Please retry your location.');
        return;
      }
      if (!locationValidation.isWithinBarangayScope) {
        setAnalysisStatus('outside');
        setAnalysisMessage('Reporting is available only within Barangay Purisima.');
        return;
      }

      setAnalysisMessage('Checking your image...');
      const form = new FormData();
      form.append('file', blob, 'concern');
      form.append('captureMode', mode);
      form.append('latitude', String(reading.lat));
      form.append('longitude', String(reading.lng));
      form.append('accuracyMeters', String(reading.accuracyMeters));
      form.append('locationTimestamp', String(reading.locationTimestamp));
      const result = await callReportWorkflow(
        '/api/reports/analyze',
        form,
        setAnalysisMessage,
      );
      const categoryDetails = APPROVED_CONCERN_CATEGORIES.find(
        (category) => category.key === result.category,
      );
      if (
        result.status !== 'accepted' ||
        !result.analysisId ||
        !categoryDetails ||
        !result.title ||
        !result.description
      ) {
        throw new Error('Report processing is temporarily unavailable.');
      }

      setAnalysisId(result.analysisId);
      setAnalysisStatus('accepted');
      setAnalysisMessage(result.message);
      setPossibleDuplicate(result.possibleDuplicate === true);
      setSelectedCategory(categoryDetails.key);
      setReportTitle(result.title);
      setDescription(result.description);
    } catch (error) {
      console.error('Report image verification failed:', error);
      if (error instanceof ReportWorkflowError) {
        setAnalysisStatus(error.status);
        setAnalysisMessage(error.message);
      } else {
        setAnalysisStatus('error');
        setAnalysisMessage("We couldn't verify your photo. Please try again.");
      }
    } finally {
      analysisInFlight.current = false;
    }
    },
    [
      captureMode,
      photoBlob,
      requestFreshGps,
      setAnalysisId,
      setAnalysisMessage,
      setAnalysisStatus,
      setDescription,
      setGpsValidation,
      setPossibleDuplicate,
      setReportTitle,
      setSelectedCategory,
    ],
  );

  const preparePhoto = useCallback(
    async (blob: Blob, mode: 'camera' | 'upload') => {
      stopCamera();
      setPhotoBlob(blob);
      setCaptureMode(mode);
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      const previewUrl = URL.createObjectURL(blob);
      setPhotoPreviewUrl(previewUrl);
      setCapturedAt(new Date().toISOString());
      setStage('review');
      setSelectedCategory('');
      setReportTitle('');
      setDescription('');
      await analyzePhoto(blob, mode);
    },
    [
      analyzePhoto,
      photoPreviewUrl,
      setCaptureMode,
      setCapturedAt,
      setDescription,
      setPhotoBlob,
      setPhotoPreviewUrl,
      setReportTitle,
      setSelectedCategory,
      setStage,
      stopCamera,
    ],
  );

  const captureFromCamera = async () => {
    const video = window.matchMedia('(max-width: 1023px)').matches
      ? mobileVideoRef.current
      : videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      toast.error('The camera is still starting. Please wait a moment.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.92),
    );
    if (blob) await preparePhoto(blob, 'camera');
  };

  const handleTestPhotoUpload = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    await preparePhoto(file, 'upload');
  };

  const resetForRetake = () => {
    if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
    setStage('capture');
    setPhotoBlob(null);
    setPhotoPreviewUrl(null);
    setCapturedAt(null);
    setSelectedCategory('');
    setReportTitle('');
    setDescription('');
    setReporterName('');
    setReporterContact('');
    setPurok('');
    setAnalysisStatus('idle');
    setAnalysisMessage('');
    setAnalysisId(null);
    setPossibleDuplicate(false);
    setCaptureMode('camera');
    setSubmissionFailed(false);
    analysisInFlight.current = false;
  };

  const submitReport = async () => {
    const photo = photoBlob;
    const verifiedAnalysisId = analysisId;
    const missingFields = [
      !photo && 'Photo',
      !verifiedAnalysisId && 'Verified photo',
      !selectedCategory && 'Category',
      !reportTitle.trim() && 'Title',
      !description.trim() && 'Description',
      !purok && 'Purok',
    ].filter(Boolean) as string[];

    if (missingFields.length > 0) {
      toast.error(`Please complete: ${missingFields.join(', ')}.`);
      return;
    }
    if (!photo || !verifiedAnalysisId) return;

    setIsSubmitting(true);
    setSubmissionFailed(false);
    try {
      const form = new FormData();
      form.append('file', photo, 'concern');
      form.append('analysisId', verifiedAnalysisId);
      form.append('title', reportTitle.trim());
      form.append('description', description.trim());
      form.append('purok', purok);
      form.append('reporterName', reporterName.trim());
      form.append('reporterContact', reporterContact.trim());
      const result = await callReportWorkflow('/api/reports/submit', form);
      if (!result.reportId) throw new Error('The report could not be submitted.');
      setPossibleDuplicate(result.possibleDuplicate === true);
      setSubmittedReportId(result.reportId);
      setStage('submitted');
      toast.success(result.message, {
        description: `Report ID: REPORT-${result.reportId.slice(0, 8).toUpperCase()}`,
      });
    } catch (error) {
      console.error('Report submission failed:', error);
      if (error instanceof ReportWorkflowError) {
        if (error.status === 'duplicate' || error.status === 'gps_retry' || error.status === 'outside') {
          setAnalysisStatus(error.status);
          setAnalysisMessage(error.message);
        } else {
          setSubmissionFailed(true);
          toast.error(error.message);
        }
      } else {
        setSubmissionFailed(true);
        toast.error('Unable to submit the report. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedCategoryDetails = resolveApprovedCategory(selectedCategory);
  const canSubmit = !isSubmitting && analysisStatus === 'accepted' && !!analysisId;

  return (
    <div
      className={cn(
        'min-h-screen transition-colors',
        stage === 'capture'
          ? 'overflow-hidden touch-none select-none pb-0 lg:pb-6'
          : stage === 'review'
            ? 'pb-20 lg:pb-6'
            : 'pb-6',
      )}
      style={{
        backgroundColor: stage === 'capture' ? '#ffffff' : palette.page,
        color: palette.text,
      }}
    >
      <main
        className={cn(
          'app-container px-4 py-4',
          stage !== 'capture' && 'lg:py-5',
          stage === 'review' && 'max-lg:pb-2',
          stage === 'capture' && 'lg:fixed lg:inset-0 lg:z-[70] lg:h-dvh lg:max-w-none lg:overflow-hidden lg:p-0',
          stage === 'capture' &&
            'max-lg:fixed max-lg:inset-0 max-lg:z-[70] max-lg:h-[100dvh] max-lg:min-h-0 max-lg:w-full max-lg:max-w-none max-lg:overflow-hidden max-lg:p-0',
        )}
      >
        <div className={cn('hidden lg:block', stage === 'capture' && 'lg:hidden')}>
          <ResidentPageHeader
            title="Report an Issue"
            subtitle="Submit a barangay concern in Barangay Purisima."
            className="mb-5 lg:mb-6"
          />
        </div>

        {stage === 'capture' && (
          <section
            onTouchStart={handleCameraTouchStart}
            onTouchEnd={handleCameraTouchEnd}
            className="relative h-full min-h-0 w-full overflow-hidden bg-[#102E2B] text-white lg:hidden"
          >
            <video
              ref={mobileVideoRef}
              muted
              playsInline
              className="absolute inset-0 h-full w-full object-cover"
              style={{ backgroundColor: palette.camera }}
              aria-label="Live camera preview"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/75" />
            <div className="pointer-events-none absolute inset-0 bg-black/10" />

            <header
              data-camera-controls
              className="absolute inset-x-0 top-0 z-30 flex items-center justify-between gap-3 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]"
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={() => navigate(-1)}
                className="h-10 w-10 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                aria-pressed={torchEnabled}
                onClick={() => void toggleTorch()}
                className={cn(
                  'h-10 w-10 rounded-full border border-white/25 bg-black/35 text-white hover:bg-black/50 hover:text-white',
                  torchEnabled && 'bg-white text-[#00745B] hover:bg-white hover:text-[#00745B]',
                )}
              >
                <Zap className="h-5 w-5" fill={torchEnabled ? 'currentColor' : 'none'} />
              </Button>
            </header>

            {!cameraStarting && !cameraError && (
              <div className="pointer-events-none absolute inset-x-[clamp(1.25rem,8vw,2.25rem)] top-[clamp(6.5rem,18vh,10rem)] bottom-[clamp(10rem,28vh,14rem)]">
                <span className="absolute left-0 top-0 h-9 w-9 rounded-tl-xl border-l-[3px] border-t-[3px] border-white/90" />
                <span className="absolute right-0 top-0 h-9 w-9 rounded-tr-xl border-r-[3px] border-t-[3px] border-white/90" />
                <span className="absolute bottom-0 left-0 h-9 w-9 rounded-bl-xl border-b-[3px] border-l-[3px] border-white/90" />
                <span className="absolute bottom-0 right-0 h-9 w-9 rounded-br-xl border-b-[3px] border-r-[3px] border-white/90" />
              </div>
            )}

            {(cameraStarting || cameraError) && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/55 px-8 text-center">
                {cameraStarting ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <>
                    <ImageOff className="h-10 w-10 text-emerald-200" />
                    <p className="mt-3 text-sm text-white/90">{cameraError}</p>
                    <Button
                      type="button"
                      onClick={() => void startCamera()}
                      className="mt-5 rounded-xl bg-white text-primary hover:bg-white/90"
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry Camera
                    </Button>
                  </>
                )}
                {cameraStarting && (
                  <p className="mt-3 text-sm text-white/85">Starting camera...</p>
                )}
              </div>
            )}

            <div
              data-camera-controls
              className="absolute inset-x-0 bottom-0 z-30 rounded-t-[28px] bg-black/75 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 backdrop-blur-md"
            >
              <input
                ref={uploadInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Upload a report image"
                onChange={(event) => void handleTestPhotoUpload(event)}
                className="sr-only"
              />
              <div className="flex items-center justify-between">
                {isTestAccount && !isGuestMode ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => uploadInputRef.current?.click()}
                    className="h-14 w-16 flex-col gap-1 rounded-xl text-white hover:bg-white/10 hover:text-white"
                  >
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-[10px]">Upload</span>
                  </Button>
                ) : (
                  <span className="h-14 w-16" />
                )}
                <button
                  type="button"
                  onClick={captureFromCamera}
                  disabled={cameraStarting || !!cameraError}
                  aria-label="Take a photo of the issue"
                  className="flex h-[clamp(3.5rem,16dvh,4.75rem)] w-[clamp(3.5rem,16dvh,4.75rem)] items-center justify-center rounded-full border-[4px] border-white bg-white/15 shadow-lg disabled:opacity-40"
                >
                  <span className="h-[clamp(2.75rem,12dvh,3.625rem)] w-[clamp(2.75rem,12dvh,3.625rem)] rounded-full bg-white" />
                </button>
                <span className="h-14 w-16" />
              </div>
              <p className="mt-3 text-center text-sm font-bold">
                Take a photo of the issue
              </p>
              <p className="mt-1 text-center text-[11px] text-white/70">
                e.g. garbage, drainage, streetlight, road damage
              </p>
            </div>
          </section>
        )}

        {stage === 'capture' && (
          <section
            onTouchStart={handleCameraTouchStart}
            onTouchEnd={handleCameraTouchEnd}
            className={cn(
              'relative hidden h-dvh overflow-hidden border-0 text-white lg:block',
              cameraStarting || cameraError ? 'bg-[#011412]' : 'bg-black',
            )}
          >
            <div className="h-full pr-[148px] 2xl:pr-[190px]">
              <div
                className={cn(
                  'relative h-full min-w-0 overflow-visible',
                  cameraStarting || cameraError ? 'bg-[#011412]' : 'bg-black',
                )}
              >
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="absolute left-0 top-0 h-full w-[calc(100%+148px)] object-cover 2xl:w-[calc(100%+190px)]"
                  style={{
                    backgroundColor:
                      cameraStarting || cameraError ? '#011412' : '#000000',
                  }}
                  aria-label="Live camera preview"
                />

                {(cameraStarting || cameraError) && (
                  <div className="absolute inset-0 z-10 bg-[#011412]/95" />
                )}

                <div
                  data-camera-controls
                  className="absolute left-1/2 top-5 z-30 flex h-10 w-[144px] -translate-x-1/2 items-center gap-2 rounded-full bg-[#008979] px-3 shadow-lg"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-white">
                    <MapPin className="h-4 w-4" strokeWidth={2} />
                  </span>
                  <div className="flex-1 leading-tight">
                    <p className="whitespace-nowrap text-[11px] font-extrabold">Report an Issue</p>
                    <p className="mt-0.5 whitespace-nowrap text-[9px] text-white/90">Barangay Purisima</p>
                  </div>
                </div>

                {!cameraStarting && !cameraError && (
                  <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 h-[280px] w-[440px] max-h-[50vh] max-w-[46vw] -translate-x-1/2 -translate-y-1/2 2xl:h-[445px] 2xl:w-[560px] 2xl:max-h-[54vh] 2xl:max-w-[48vw]">
                    <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-2xl border-l-4 border-t-4 border-white 2xl:h-[58px] 2xl:w-[58px] 2xl:rounded-tl-[24px] 2xl:border-l-[7px] 2xl:border-t-[7px]" />
                    <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-2xl border-r-4 border-t-4 border-white 2xl:h-[58px] 2xl:w-[58px] 2xl:rounded-tr-[24px] 2xl:border-r-[7px] 2xl:border-t-[7px]" />
                    <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-2xl border-b-4 border-l-4 border-white 2xl:h-[58px] 2xl:w-[58px] 2xl:rounded-bl-[24px] 2xl:border-b-[7px] 2xl:border-l-[7px]" />
                    <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-2xl border-b-4 border-r-4 border-white 2xl:h-[58px] 2xl:w-[58px] 2xl:rounded-br-[24px] 2xl:border-b-[7px] 2xl:border-r-[7px]" />
                  </div>
                )}

                {(cameraStarting || cameraError) && (
                  <div className="absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center text-white">
                    {cameraStarting ? (
                      <>
                        <Loader2 className="h-10 w-10 animate-spin 2xl:h-14 2xl:w-14" />
                        <p className="mt-3 text-sm 2xl:mt-4 2xl:text-lg">Starting camera...</p>
                      </>
                    ) : (
                      <>
                        <span className="flex h-14 w-[72px] items-center justify-center text-white/85 2xl:h-[92px] 2xl:w-[112px]">
                          <CameraOff className="h-14 w-[68px] 2xl:h-[88px] 2xl:w-[108px]" strokeWidth={1.55} />
                        </span>
                        <p className="mt-4 w-[430px] max-w-[42vw] px-4 text-center text-[16px] leading-6 text-white 2xl:mt-7 2xl:w-[520px] 2xl:max-w-[44vw] 2xl:text-[23px] 2xl:leading-[1.32]">
                          {cameraError}
                        </p>
                        <Button
                          type="button"
                          onClick={() => void startCamera()}
                          className="mt-5 h-[50px] min-w-[220px] rounded-full bg-white px-7 text-[16px] font-extrabold text-[#00745B] shadow-xl hover:bg-white/95 2xl:mt-7 2xl:h-[66px] 2xl:min-w-[290px] 2xl:px-10 2xl:text-[22px]"
                        >
                          <RefreshCw className="mr-2.5 h-5 w-5 2xl:mr-4 2xl:h-8 2xl:w-8" strokeWidth={2.3} />
                          Retry Camera
                        </Button>
                      </>
                    )}
                  </div>
                )}

              </div>
            </div>

            <aside
              data-camera-controls
              className="absolute inset-y-0 right-0 z-30 w-[148px] rounded-bl-[40px] rounded-tl-[40px] bg-black shadow-2xl 2xl:w-[191px] 2xl:rounded-bl-[52px] 2xl:rounded-tl-[52px]"
            >
              <button
                type="button"
                onClick={() => uploadInputRef.current?.click()}
                aria-label="Upload a report image"
                className="absolute left-1/2 top-[15%] flex -translate-x-1/2 flex-col items-center rounded-lg p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <ImagePlus className="h-5 w-5 text-white" strokeWidth={1.8} />
                <span className="mt-1.5 text-xs font-semibold text-white">Upload</span>
              </button>

              <button
                type="button"
                aria-label={torchEnabled ? 'Turn flashlight off' : 'Turn flashlight on'}
                aria-pressed={torchEnabled}
                onClick={() => void toggleTorch()}
                className={cn(
                  'absolute left-1/2 top-[27%] flex -translate-x-1/2 flex-col items-center rounded-lg p-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white',
                  torchEnabled ? 'text-emerald-300' : 'text-white',
                )}
              >
                <Zap className="h-5 w-5" fill={torchEnabled ? 'currentColor' : 'none'} />
                <span className="mt-1.5 text-xs font-semibold">Flashlight</span>
              </button>

              <div className="absolute inset-x-2 top-[40%] flex flex-col items-center text-center">
                <button
                  type="button"
                  onClick={captureFromCamera}
                  disabled={cameraStarting || !!cameraError}
                  aria-label="Take a photo of the issue"
                  className={cn(
                    'flex h-[84px] w-[84px] items-center justify-center rounded-full border-[4px] bg-black transition-all enabled:hover:scale-105 disabled:opacity-100',
                    cameraStarting || cameraError
                      ? 'border-[#777777] shadow-[0_0_0_3px_#333333]'
                      : 'border-white shadow-[0_0_0_3px_rgba(255,255,255,0.55)]',
                  )}
                >
                  <span
                    className={cn(
                      'h-[68px] w-[68px] rounded-full transition-colors',
                      cameraStarting || cameraError ? 'bg-[#808080]' : 'bg-white',
                    )}
                  />
                </button>
              </div>

              <div className="absolute inset-x-2 top-[68%] text-center">
                <p className="text-[12px] font-extrabold leading-tight text-white">
                  Take a photo of the issue
                </p>
                <p className="mx-auto mt-1 max-w-[118px] text-[8px] leading-[1.35] text-white/70 2xl:max-w-[150px]">
                  e.g. garbage, drainage, streetlight, road damage
                </p>
              </div>

            </aside>

            <input
              ref={uploadInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label="Upload a report image"
              onChange={(event) => void handleTestPhotoUpload(event)}
              className="sr-only"
            />
            <canvas ref={canvasRef} className="hidden" />
          </section>
        )}

        {stage === 'review' && (
          <section className="mx-auto max-w-xl lg:hidden">
            <header className="-mx-4 bg-white/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur dark:bg-transparent">
              <div className="relative flex h-10 items-center justify-center px-12">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Retake photo"
                  onClick={resetForRetake}
                  disabled={analysisStatus === 'checking' || isSubmitting}
                  className="absolute left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border border-[#DCE4E8] bg-white text-[#172332] shadow-sm hover:bg-[#F3F8F6] dark:border-[#35534f] dark:bg-[#0B1920] dark:text-slate-100 dark:hover:bg-[#102E2B]"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </div>
              <h1 className="pb-2 text-center text-sm font-extrabold text-[#111827] dark:text-slate-100">
                Report an Issue
              </h1>
              <MobileReportProgress step={2} />
            </header>

            <div className="space-y-3 pt-3">
              {analysisStatus !== 'accepted' ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="flex min-h-[calc(100dvh-120px)] flex-col overflow-hidden rounded-[20px] border border-[#EAF0F0] bg-gradient-to-b from-white via-white to-[#E8F7F2] shadow-sm dark:border-[#273e49] dark:from-[#0B1920] dark:via-[#0B1920] dark:to-[#0B1920]"
                >
                  {photoPreviewUrl && (
                    <div className="p-2 pb-0">
                      <img
                        src={photoPreviewUrl}
                        alt="Captured concern photo being analyzed"
                        className="aspect-[16/10] w-full rounded-[14px] object-cover"
                      />
                    </div>
                  )}
                  <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center px-6 py-6 text-center">
                    {analysisStatus === 'checking' ? (
                      <>
                        <span className="relative flex h-20 w-20 items-center justify-center rounded-full">
                          <span
                            aria-hidden="true"
                            className="absolute inset-0 animate-spin rounded-full border-[5px] border-[#D9F0EA] border-r-[#087E70] dark:border-[#24413f] dark:border-r-teal-400"
                          />
                          <Layers3 className="relative z-10 h-8 w-8 text-[#087E70]" />
                        </span>
                        <h2 className="mt-4 text-base font-extrabold text-[#111827] dark:text-slate-100">
                          Classifying your photo...
                        </h2>
                        <p className="mt-2 max-w-[250px] text-xs leading-relaxed text-[#526477] dark:text-slate-300">
                          {analysisMessage || 'Verifying your photo...'}
                        </p>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-9 w-9 text-amber-600" />
                        <p className="mt-3 max-w-sm text-sm font-semibold text-[#263746] dark:text-slate-200">
                          {analysisMessage}
                        </p>
                        <div className="mt-4 flex gap-2">
                          {(analysisStatus === 'error' ||
                            analysisStatus === 'gps_retry' ||
                            analysisStatus === 'outside') && (
                            <Button
                              type="button"
                              onClick={() => void analyzePhoto()}
                              disabled={gpsLoading}
                              className="rounded-xl"
                            >
                              {gpsLoading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Retry
                            </Button>
                          )}
                          {analysisStatus !== 'error' && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={resetForRetake}
                              className="rounded-xl"
                            >
                              Retake Photo
                            </Button>
                          )}
                        </div>
                        {gpsError && (
                          <p className="mt-3 text-xs text-muted-foreground">{gpsError}</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : (
                <form
                  className="space-y-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitReport();
                  }}
                >
                  {possibleDuplicate && !isTestAccount && (
                    <p
                      role="status"
                      className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900"
                    >
                      A similar concern may already exist. Your report can still be submitted for review.
                    </p>
                  )}

                  <div className="flex items-center gap-2.5 rounded-[14px] bg-[#E5F5F0] p-2.5 dark:bg-[#0B1920]">
                    {photoPreviewUrl && (
                      <img
                        src={photoPreviewUrl}
                        alt=""
                        className="h-14 w-16 shrink-0 rounded-lg object-cover"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[10px] font-semibold text-[#167A68] dark:text-teal-300">
                        <Layers3 className="h-3.5 w-3.5 dark:text-teal-300" />
                        Detected Concern
                      </p>
                      <p className="mt-0.5 truncate text-sm font-extrabold text-[#142234] dark:text-slate-100">
                        {selectedCategoryDetails?.label}
                      </p>
                    </div>
                    <CheckCircle2 className="mr-1 h-5 w-5 shrink-0 text-[#14866F]" />
                  </div>

                  <div className="min-w-0 rounded-[18px] bg-white p-3 dark:bg-[#101F27]">
                    <h2 className="mb-2 text-sm font-extrabold text-[#101828] dark:text-slate-100">
                      Report Details
                    </h2>

                    <div className="mb-2 rounded-xl bg-[#F3F8F6] px-3 dark:bg-[#0B1920]">
                      <div className="flex h-8 items-center gap-2 text-xs font-semibold text-[#263746] dark:text-slate-200">
                        <Layers3 className="h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                        <span className="min-w-0 flex-1 truncate">
                          {selectedCategoryDetails?.label}
                        </span>
                        <span className="text-[10px] font-medium text-[#728293] dark:text-slate-400">Detected</span>
                      </div>
                      <div className="flex h-8 items-center gap-2 text-xs font-semibold text-[#263746] dark:text-slate-200">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[#137C6B] dark:text-teal-300" />
                        <span className="truncate">{formatCapturedDate(capturedAt)}</span>
                      </div>
                    </div>

                    <label className="mb-2 block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                      <span className="mb-1 block">Title <span className="text-destructive">*</span></span>
                      <Input
                        value={reportTitle}
                        onChange={(event) =>
                          setReportTitle(event.target.value.slice(0, 120))
                        }
                        className="h-9 rounded-xl border-[#DCE4E8] bg-white px-3 text-xs font-semibold text-[#172332] dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                        required
                      />
                    </label>

                    <label className="block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                      <span className="mb-1 block">Description <span className="text-destructive">*</span></span>
                      <span className="relative block">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                        <Textarea
                          value={description}
                          onChange={(event) =>
                            setDescription(event.target.value.slice(0, 1000))
                          }
                          rows={2}
                          maxLength={1000}
                          className="min-h-[72px] w-full min-w-0 resize-y rounded-xl border-[#DCE4E8] bg-white py-2 pl-9 pr-3 text-xs leading-relaxed text-[#172332] dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                          required
                        />
                      </span>
                      <span className="mt-1 block text-right text-[10px] font-medium text-[#718096] dark:text-slate-400">
                        {description.length}/1000
                      </span>
                    </label>

                    <label className="mt-2 block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                      <span className="mb-1 block">Purok <span className="text-destructive">*</span></span>
                      <Select value={purok} onValueChange={setPurok}>
                        <SelectTrigger
                          aria-label="Purok"
                          className="h-10 rounded-xl border-[#DCE4E8] bg-white text-xs font-semibold dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                        >
                          <SelectValue placeholder="Select purok" />
                        </SelectTrigger>
                        <SelectContent>
                          {PURISIMA_PUROKS.map((item) => (
                            <SelectItem key={item} value={item}>
                              {item}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </label>

                    <details className="mt-2 rounded-[16px] bg-[#F3F8F6] px-3 py-2.5 dark:bg-[#101F27]">
                      <summary className="cursor-pointer text-xs font-bold text-[#263746] dark:text-slate-200">
                        Reporter details (optional)
                      </summary>
                      <div className="mt-3 space-y-3">
                        <label className="block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                          Name (optional)
                          <Input
                            value={reporterName}
                            onChange={(event) =>
                              setReporterName(event.target.value.slice(0, 120))
                            }
                            autoComplete="name"
                            placeholder="Enter your name"
                            className="mt-1 h-10 rounded-xl border-[#DCE4E8] bg-white text-xs dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                          />
                        </label>
                        <label className="block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                          Contact number (optional)
                          <Input
                            type="tel"
                            inputMode="tel"
                            value={reporterContact}
                            onChange={(event) =>
                              setReporterContact(event.target.value.slice(0, 30))
                            }
                            autoComplete="tel"
                            placeholder="e.g. 09XX XXX XXXX"
                            className="mt-1 h-10 rounded-xl border-[#DCE4E8] bg-white text-xs dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                          />
                        </label>
                      </div>
                    </details>
                  </div>

                  <section className="rounded-[18px] bg-[#E9F7F3] p-3 dark:bg-[#0B1920]">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#162535] dark:text-slate-100">
                      <MapPin className="h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                      Reported Location
                    </h3>
                    <div className="overflow-hidden rounded-[14px] bg-white dark:bg-[#0B1920]">
                      {gpsReading ? (
                        <LocationPicker
                          value={{ lat: gpsReading.lat, lng: gpsReading.lng }}
                          onChange={() => undefined}
                          height="200px"
                          readOnly
                          hideLabel
                          zoomControlVariant="report"
                          hideCoordinates
                          focusOnValue
                          markerVariant="report"
                        />
                      ) : (
                        <div className="flex h-[200px] flex-col items-center justify-center gap-2 bg-[#E5F5F0] text-xs font-semibold text-[#526477] dark:bg-[#0B1920] dark:text-slate-300">
                          <LocateFixed className="h-7 w-7 text-[#137C6B]" />
                          {gpsError || 'Waiting for device GPS...'}
                        </div>
                      )}
                    </div>
                    <div
                      className={cn(
                        'mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold',
                        gpsValidation?.isValid
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-[#0B1920] dark:text-teal-200'
                          : 'bg-amber-100 text-amber-900 dark:bg-[#4a2d16] dark:text-amber-200',
                      )}
                    >
                      {gpsValidation?.isValid ? (
                        <ShieldCheck className="h-4 w-4 shrink-0" />
                      ) : (
                        <AlertCircle className="h-4 w-4 shrink-0" />
                      )}
                      <span>
                        {gpsValidation?.isValid
                          ? 'Location verified.'
                          : gpsValidation && !gpsValidation.isWithinBarangayScope
                            ? 'Reporting is available only within Barangay Purisima.'
                            : gpsValidation
                              ? 'Please retry your location.'
                              : gpsError || 'Waiting for GPS verification.'}
                      </span>
                    </div>
                  </section>

                  <Button
                    type="submit"
                    disabled={!canSubmit || !purok}
                    className="h-12 w-full rounded-xl bg-[#087E70] text-sm font-extrabold text-white hover:bg-[#06695F]"
                  >
                    {isSubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    {isSubmitting
                      ? 'Submitting...'
                      : submissionFailed
                        ? 'Retry Submit'
                        : 'Submit Report'}
                  </Button>
                  <CancelReportButton
                    onCancel={resetForRetake}
                    className="h-11 w-full rounded-xl border-[#CDDCE4] text-sm font-bold"
                  />
                </form>
              )}
            </div>
          </section>
        )}

        {stage === 'review' && (
          <form
            className={cn(
              'mt-4 hidden lg:block',
              analysisStatus !== 'accepted' && 'mb-5',
            )}
            onSubmit={(event) => {
              event.preventDefault();
              void submitReport();
            }}
          >
            <div className="flex h-[106px] items-start px-6 pt-4" aria-label="Report progress">
              <div className="relative mx-auto grid h-[72px] w-[520px] grid-cols-3 items-start pt-1">
                <span
                  className="absolute left-[16.6667%] right-1/2 top-[22px] h-px"
                  style={{ backgroundColor: palette.primary }}
                />
                <span
                  className="absolute left-1/2 right-[16.6667%] top-[22px] h-px"
                  style={{ backgroundColor: palette.border }}
                />
                {[
                  { label: 'Photo', complete: true },
                  { label: 'Details', complete: true },
                  { label: 'Submit', complete: false },
                ].map((step, index) => (
                  <div key={step.label} className="relative z-10 flex flex-col items-center">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-base font-extrabold"
                      style={
                        step.complete
                          ? { backgroundColor: palette.primary, color: palette.primaryText }
                          : {
                              border: `1px solid ${palette.primary}`,
                              backgroundColor: palette.panel,
                              color: palette.primary,
                            }
                      }
                    >
                      {step.complete ? <Check className="h-5 w-5" strokeWidth={3} /> : index + 1}
                    </span>
                    <span
                      className="mt-2 text-sm font-extrabold leading-none"
                      style={{ color: palette.text }}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {analysisStatus !== 'accepted' ? (
              <div className="grid h-[calc(100dvh-175px)] min-h-[385px] max-h-[520px] grid-cols-[minmax(320px,0.82fr)_minmax(0,1.18fr)] gap-4 px-5 pb-5">
                <section className="flex min-h-0 flex-col rounded-[20px] border border-[#DCE8E8] bg-white p-3.5 shadow-[0_8px_22px_rgba(35,73,82,0.08)] dark:border-[#273e49] dark:bg-[#101F27]">
                  {photoPreviewUrl && (
                    <img src={photoPreviewUrl} alt="Captured concern" className="min-h-0 w-full flex-1 rounded-[15px] object-cover" />
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={resetForRetake}
                    className="mt-3 h-11 w-full rounded-[14px] border border-[#B9E2D8] bg-[#F4FCF9] text-sm font-extrabold text-[#087E58] hover:bg-[#EAF8F3] hover:text-[#087E58] dark:border-[#245c52] dark:bg-[#102E2B] dark:text-teal-300 dark:hover:bg-[#163b36] dark:hover:text-teal-200"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                  </Button>
                </section>

                <section className="relative flex min-h-0 flex-col items-center justify-center overflow-hidden rounded-[20px] border border-[#DCE8E8] bg-white px-6 pb-16 text-center shadow-[0_8px_22px_rgba(35,73,82,0.08)] dark:border-[#273e49] dark:bg-[#101F27]">
                  <div className="relative z-10 flex flex-col items-center">
                    {analysisStatus === 'checking' ? (
                      <span className="relative flex h-24 w-24 items-center justify-center rounded-full">
                        <span aria-hidden="true" className="absolute inset-0 animate-spin rounded-full bg-[conic-gradient(#07945D_0deg_92deg,#DDF5ED_92deg_360deg)]" />
                        <span aria-hidden="true" className="absolute inset-1.5 rounded-full bg-white dark:bg-[#101F27]" />
                        <Layers3 className="relative z-10 h-9 w-9 text-[#078D59]" strokeWidth={1.8} />
                      </span>
                    ) : (
                      <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#E6F7F1] dark:bg-[#183b35]">
                        <Layers3 className="h-9 w-9 text-[#078D59] dark:text-teal-300" strokeWidth={1.8} />
                      </span>
                    )}
                    <h2 className="mt-3 text-[23px] font-extrabold tracking-[-0.02em] text-[#07112D] dark:text-slate-100">
                      {analysisStatus === 'checking' ? 'Classifying your photo...' : 'Review your photo and location'}
                    </h2>
                    <p className="mt-2 max-w-xl text-sm text-[#526176] dark:text-slate-300">
                      {analysisStatus === 'checking'
                        ? analysisMessage || 'Verifying your photo...'
                        : analysisMessage}
                    </p>
                    {analysisStatus !== 'checking' && (
                      <Button type="button" variant="outline" onClick={() => void analyzePhoto()} className="mt-4 rounded-xl">
                        Retry
                      </Button>
                    )}
                  </div>

                </section>
              </div>
            ) : (
              <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-5 px-6 pb-6">
                <aside className="space-y-4">
                  <div className="overflow-hidden rounded-[18px] border border-[#E2E8EB] bg-white p-2 shadow-sm dark:border-[#273e49] dark:bg-[#101F27]">
                    {photoPreviewUrl && (
                      <img src={photoPreviewUrl} alt="Captured concern" className="aspect-[4/3] w-full rounded-[14px] object-cover" />
                    )}
                  </div>

                  {selectedCategoryDetails && (
                    <div className="flex items-center gap-3 rounded-[14px] bg-[#E5F5F0] p-3 dark:bg-[#0B1920]">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#087E70] dark:bg-[#102E2B] dark:text-teal-300">
                        <Layers3 className="h-5 w-5" />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold text-[#167A68] dark:text-teal-300">Detected Concern</p>
                        <p className="mt-0.5 truncate text-sm font-extrabold text-[#142234] dark:text-slate-100">{selectedCategoryDetails.label}</p>
                      </div>
                      <CheckCircle2 className="ml-auto h-5 w-5 shrink-0 text-[#14866F]" />
                    </div>
                  )}

                  <Button type="button" variant="outline" onClick={resetForRetake} className="h-11 w-full rounded-xl border-[#D8E2E5] font-bold text-[#087E70] dark:border-[#2d4a54] dark:bg-[#101F27] dark:text-teal-300 dark:hover:bg-[#142630]">
                    <RefreshCw className="mr-2 h-4 w-4" /> Retake Photo
                  </Button>

                  <details open className="rounded-[16px] border border-[#E2E8EB] bg-[#F3F8F6] px-3 py-2.5 dark:border-[#273e49] dark:bg-[#101F27]">
                    <summary className="cursor-pointer text-xs font-bold text-[#263746] dark:text-slate-200">
                      Reporter details (optional)
                    </summary>
                    <div className="mt-3 space-y-3">
                      <label className="block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                        Name (optional)
                        <Input
                          value={reporterName}
                          onChange={(event) => setReporterName(event.target.value.slice(0, 120))}
                          autoComplete="name"
                          placeholder="Enter your name"
                          className="mt-1 h-10 rounded-xl border-[#DCE4E8] bg-white text-xs dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                        />
                      </label>
                      <label className="block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                        Contact number (optional)
                        <Input
                          value={reporterContact}
                          onChange={(event) => setReporterContact(event.target.value.slice(0, 30))}
                          type="tel"
                          inputMode="tel"
                          autoComplete="tel"
                          placeholder="e.g. 09XX XXX XXXX"
                          className="mt-1 h-10 rounded-xl border-[#DCE4E8] bg-white text-xs dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100"
                        />
                      </label>
                    </div>
                  </details>
                </aside>

                <section className="min-w-0 space-y-4">
                  {possibleDuplicate && !isTestAccount && (
                    <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                      A similar concern may already exist. Your report can still be submitted for review.
                    </p>
                  )}

                  <div className="rounded-[18px] border border-[#E2E8EB] bg-white p-4 dark:border-[#273e49] dark:bg-[#101F27]">
                    <h2 className="mb-3 text-sm font-extrabold text-[#101828] dark:text-slate-100">Report Details</h2>

                    <div className="mb-3 rounded-xl bg-[#F3F8F6] px-3 dark:bg-[#0B1920]">
                      <div className="flex h-10 items-center gap-2 text-xs font-semibold text-[#263746] dark:text-slate-200">
                        <Layers3 className="h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                        <span className="min-w-0 flex-1 truncate">{selectedCategoryDetails?.label}</span>
                        <span className="text-[10px] font-medium text-[#728293] dark:text-slate-400">Detected</span>
                      </div>
                      <div className="flex h-10 items-center gap-2 text-xs font-semibold text-[#263746] dark:text-slate-200">
                        <CalendarDays className="h-4 w-4 shrink-0 text-[#137C6B] dark:text-teal-300" />
                        <span className="truncate">{formatCapturedDate(capturedAt)}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label className="text-[11px] font-bold text-[#273746] dark:text-slate-200">
                        <span className="mb-1 block">Title <span className="text-destructive">*</span></span>
                        <Input value={reportTitle} onChange={(event) => setReportTitle(event.target.value.slice(0, 120))} className="h-10 rounded-xl border-[#DCE4E8] bg-white text-xs font-semibold dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100" required />
                      </label>
                      <label className="text-[11px] font-bold text-[#273746] dark:text-slate-200">
                        <span className="mb-1 block">Purok <span className="text-destructive">*</span></span>
                        <Select value={purok} onValueChange={setPurok}>
                          <SelectTrigger aria-label="Purok" className="h-10 rounded-xl border-[#DCE4E8] bg-white text-xs font-semibold dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100">
                            <SelectValue placeholder="Select purok" />
                          </SelectTrigger>
                          <SelectContent>
                            {PURISIMA_PUROKS.map((item) => (
                              <SelectItem key={item} value={item}>{item}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </label>
                    </div>

                    <label className="mt-3 block text-[11px] font-bold text-[#273746] dark:text-slate-200">
                      <span className="mb-1 block">Description <span className="text-destructive">*</span></span>
                      <span className="relative block">
                        <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                        <Textarea ref={descriptionRef} value={description} onChange={(event) => setDescription(event.target.value.slice(0, 1000))} rows={3} maxLength={1000} className="min-h-[90px] resize-y rounded-xl border-[#DCE4E8] bg-white py-2.5 pl-9 pr-3 text-xs leading-relaxed dark:border-[#273e49] dark:bg-[#0B1920] dark:text-slate-100" required />
                      </span>
                      <span className="mt-1 block text-right text-[10px] font-medium text-[#718096] dark:text-slate-400">{description.length}/1000</span>
                    </label>
                  </div>

                  <div className="rounded-[18px] border border-[#E2E8EB] bg-[#E9F7F3] p-3 dark:border-[#273e49] dark:bg-[#0B1920]">
                    <h3 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-[#162535] dark:text-slate-100">
                      <MapPin className="h-4 w-4 text-[#137C6B] dark:text-teal-300" />
                      Reported Location
                    </h3>
                    <div className="overflow-hidden rounded-[14px] bg-white dark:bg-[#0B1920]">
                      {gpsReading ? (
                        <LocationPicker
                          value={{ lat: gpsReading.lat, lng: gpsReading.lng }}
                          onChange={() => undefined}
                          height="260px"
                          readOnly
                          hideLabel
                          hideCoordinates
                          zoomControlVariant="report"
                          focusOnValue
                          markerVariant="report"
                        />
                      ) : (
                        <div className="flex h-[260px] flex-col items-center justify-center gap-2 bg-[#E5F5F0] text-xs font-semibold text-[#526477] dark:bg-[#0B1920] dark:text-slate-300">
                          <LocateFixed className="h-7 w-7 text-[#137C6B]" />
                          {gpsError || 'Waiting for device GPS...'}
                        </div>
                      )}
                    </div>
                    {gpsValidation && (
                      <div className={cn('mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold', gpsValidation.isValid ? 'bg-emerald-100 text-emerald-800 dark:bg-[#0B1920] dark:text-teal-200' : 'bg-amber-100 text-amber-900 dark:bg-[#4a2d16] dark:text-amber-200')}>
                        {gpsValidation.isValid ? <ShieldCheck className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        {gpsValidation.isValid ? 'Location verified.' : 'Please verify the location.'}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_2fr] gap-3">
                    <CancelReportButton onCancel={resetForRetake} className="h-12 rounded-xl" />
                    <Button type="submit" disabled={!canSubmit || !purok} className="h-12 rounded-xl bg-[#087E70] px-8 font-extrabold text-white hover:bg-[#06695F]">
                      {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Send className="mr-2 h-5 w-5" />}
                      {isSubmitting ? 'Submitting...' : submissionFailed ? 'Retry Submit' : 'Submit Report'}
                    </Button>
                  </div>
                </section>
              </div>
            )}
          </form>
        )}

        {stage === 'submitted' && (
          <>
            <header className="sticky top-0 z-30 -mx-4 border-b border-[#E5EAED] bg-white/95 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur lg:hidden">
              <div className="flex h-10 items-center justify-center px-12">
                <h1 className="text-sm font-extrabold text-[#111827]">
                  Report an Issue
                </h1>
              </div>
              <MobileReportProgress step={3} />
            </header>
            <section
              className="mt-4 flex min-h-[460px] items-center justify-center rounded-2xl border p-6 text-center shadow-md transition-colors"
              style={{ backgroundColor: palette.card, borderColor: palette.border, color: palette.text, boxShadow: palette.shadow }}
            >
              <div className="max-w-lg">
                <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200">
                  <ClipboardCheck className="h-8 w-8" />
                </span>
                <h2 className="mt-4 text-2xl font-extrabold tracking-[-0.035em]">Report Submitted</h2>
                <p className="mt-2" style={{ color: palette.mutedText }}>
                  Your report is ready for review.
                </p>
                {possibleDuplicate && !isTestAccount && (
                  <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
                    A similar concern may already exist. Barangay staff can review it.
                  </p>
                )}
                <div
                  className="mt-5 rounded-2xl border p-4 text-sm"
                  style={{ backgroundColor: palette.soft, borderColor: palette.border }}
                >
                  <p className="font-semibold" style={{ color: palette.mutedText }}>Report ID</p>
                  <p className="mt-1 font-mono text-lg font-extrabold" style={{ color: palette.primary }}>
                    REPORT-{submittedReportId?.slice(0, 8).toUpperCase()}
                  </p>
                  <p className="mt-1 text-xs" style={{ color: palette.mutedText }}>
                    Save this ID for tracking and follow-ups.
                  </p>
                  <p className="mt-3 flex items-center justify-center gap-2 font-semibold">
                    <Check className="h-4 w-4 text-emerald-600" />
                    {selectedCategoryDetails?.label}
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    if (submittedReportId) {
                      navigate(`/my-requests?report=${encodeURIComponent(submittedReportId)}`);
                    }
                  }}
                  className="mt-6 rounded-xl px-7"
                  style={{ backgroundColor: palette.primary, color: palette.primaryText }}
                >
                  <Eye className="mr-2 h-4 w-4" />
                  View Report
                </Button>
              </div>
            </section>
          </>
        )}
      </main>

      {!isGuestMode && (
        <BottomNav
          currentPath="/report-issue"
          hideMobile={stage !== 'review'}
          hideDesktop={stage === 'capture'}
        />
      )}
    </div>
  );
};

export default ReportIssue;
