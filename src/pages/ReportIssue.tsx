import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Camera,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  CloudRain,
  Construction,
  Edit3,
  FileCheck2,
  Lightbulb,
  Loader2,
  MapPin,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  XCircle,
} from 'lucide-react';
import { LocationPicker } from '@/components/LocationPicker';
import {
  CameraCapturePayload,
  DirectCameraCapture,
} from '@/components/DirectCameraCapture';
import {
  VoiceReportAssistant,
  type VoiceOrganized,
} from '@/components/VoiceReportAssistant';
import {
  APPROVED_CONCERN_CATEGORIES,
  ApprovedConcernCategoryKey,
  AutonomousAiDecision,
  CapturedGpsReading,
  DEFAULT_CONFIDENCE_THRESHOLD,
  GpsValidationResult,
  ImageQualityMetrics,
  ImageSuitabilityEvaluation,
  LOW_CONFIDENCE_MESSAGE,
  MobileNetV3InferenceResponse,
  ROBOFLOW_CLASS_LABEL_BY_KEY,
  TRAINED_CLASS_REFERENCES,
  buildAutomatedReportDescription,
  evaluateAutonomousAiReportDecision,
  evaluateImageSuitability,
  resolveApprovedCategory,
  validateCapturedGpsLocation,
} from '@/lib/mobilenetReportPipeline';
import {
  inspectCapturedImageQuality,
  loadReferenceImageAsBlob,
  runMobileNetV3Classification,
} from '@/lib/mobilenetClassifyService';
import { cn } from '@/lib/utils';

type WorkflowStep = 'capture' | 'analyzing' | 'preview' | 'submitted';

const CATEGORY_ICONS: Record<ApprovedConcernCategoryKey, typeof Trash2> = {
  garbage: Trash2,
  street_light: Lightbulb,
  drainage: CloudRain,
  road_damage: Construction,
};

const ReportIssue = () => {
  const navigate = useNavigate();

  // Immediately open the live device camera when Report an Issue is opened
  const [step, setStep] = useState<WorkflowStep>('capture');
  const [cameraModalOpen, setCameraModalOpen] = useState(true);

  // Captured Photo State
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [uploadedPhotoUrl, setUploadedPhotoUrl] = useState<string | null>(null);
  const [capturedAtIso, setCapturedAtIso] = useState<string | null>(null);
  const lastCapturedBlobRef = useRef<Blob | null>(null);

  // AI Classification & Suitability State
  const [qualityMetrics, setQualityMetrics] =
    useState<ImageQualityMetrics | null>(null);
  const [inferenceResult, setInferenceResult] =
    useState<MobileNetV3InferenceResponse | null>(null);
  const [suitability, setSuitability] =
    useState<ImageSuitabilityEvaluation | null>(null);

  // Selected / Predicted Category & Description State
  const [selectedCategoryKey, setSelectedCategoryKey] = useState<
    ApprovedConcernCategoryKey | ''
  >('');
  const [isCategoryOverridden, setIsCategoryOverridden] = useState(false);
  const [showCategorySelector, setShowCategorySelector] = useState(false);
  const [referenceFilterTab, setReferenceFilterTab] = useState<
    'all' | ApprovedConcernCategoryKey
  >('all');

  const [description, setDescription] = useState('');
  const [descriptionSourceLabel, setDescriptionSourceLabel] = useState('');
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [residentEditedDescription, setResidentEditedDescription] =
    useState(false);

  // GPS & Barangay Purisima Geofencing State (Never uses fake coordinates)
  const [gpsReading, setGpsReading] = useState<CapturedGpsReading | null>(null);
  const [gpsValidation, setGpsValidation] =
    useState<GpsValidationResult | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsError, setGpsError] = useState<string | null>(null);

  // Optional Resident Details & Voice Assistant
  const [showOptionalDetails, setShowOptionalDetails] = useState(false);
  const [locationDetails, setLocationDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [usedVoice, setUsedVoice] = useState(false);

  // Submission & Autonomous AI Decision State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submissionLockRef = useRef(false);
  const activeReportUUIDRef = useRef<string>(crypto.randomUUID());
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(
    null
  );
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [finalAiDecision, setFinalAiDecision] =
    useState<AutonomousAiDecision | null>(null);

  // Acquire fresh device GPS coordinates
  const requestFreshGpsLocation =
    useCallback((): Promise<CapturedGpsReading | null> => {
      return new Promise((resolve) => {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
          const msg =
            'Geolocation is not supported by this browser. Please enable device location services.';
          setGpsError(msg);
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
              locationTimestamp: position.timestamp || now,
              capturedAtTimestamp: now,
            };
            setGpsReading(reading);
            setGpsValidation(validateCapturedGpsLocation(reading, now));
            setGpsLoading(false);
            setGpsError(null);
            resolve(reading);
          },
          (err) => {
            setGpsLoading(false);
            const msg =
              err.code === err.PERMISSION_DENIED
                ? 'Location permission was denied. Please allow GPS access in your browser settings and tap Refresh GPS.'
                : err.code === err.TIMEOUT
                ? 'GPS location request timed out. Please move to an open area and tap Refresh GPS.'
                : 'Could not determine your GPS coordinates. Please check your device location settings and retry.';
            setGpsError(msg);
            setGpsValidation(validateCapturedGpsLocation(null));
            resolve(null);
          },
          {
            enableHighAccuracy: true,
            timeout: 12000,
            maximumAge: 0,
          }
        );
      });
    }, []);

  // Request GPS on initial mount so coordinates are ready during capture
  useEffect(() => {
    requestFreshGpsLocation();
  }, [requestFreshGpsLocation]);

  // Re-populate automated description when category or suitability changes (unless resident manually edited it)
  useEffect(() => {
    if (!suitability || residentEditedDescription) return;
    const generated = buildAutomatedReportDescription({
      suitability,
      selectedCategoryKey: selectedCategoryKey || null,
      aiServiceDescription: !isCategoryOverridden
        ? inferenceResult?.aiGeneratedDescription
        : null,
    });
    setDescription(generated.description);
    setDescriptionSourceLabel(generated.sourceLabel);
  }, [
    suitability,
    selectedCategoryKey,
    isCategoryOverridden,
    inferenceResult,
    residentEditedDescription,
  ]);

  const handlePhotoCaptured = useCallback(
    async (
      photo: Blob,
      payload?: CameraCapturePayload & {
        simulateError?: boolean;
        mockPredictedClass?: string | null;
      }
    ) => {
      setCameraModalOpen(false);
      setStep('analyzing');
      lastCapturedBlobRef.current = photo;

      const previewUrl =
        payload?.localPreviewUrl || URL.createObjectURL(photo);
      setPhotoPreviewUrl(previewUrl);

      const captureTimeMs = payload?.capturedAtTimestamp || Date.now();
      setCapturedAtIso(new Date(captureTimeMs).toISOString());

      // Reset per-capture overrides
      setIsCategoryOverridden(false);
      setShowCategorySelector(false);
      setIsEditingDescription(false);
      setResidentEditedDescription(false);
      setFinalAiDecision(null);
      activeReportUUIDRef.current = crypto.randomUUID();

      // 1. Acquire / verify actual device GPS reading
      let currentGps = payload?.gpsReading ?? gpsReading;
      if (
        !currentGps ||
        Date.now() - currentGps.locationTimestamp > 50_000
      ) {
        currentGps = await requestFreshGpsLocation();
      } else {
        setGpsReading(currentGps);
        setGpsValidation(validateCapturedGpsLocation(currentGps, Date.now()));
      }
      if (payload?.gpsError && !currentGps) {
        setGpsError(payload.gpsError);
      }

      // 2. Inspect captured image readability and blur
      const quality = await inspectCapturedImageQuality(photo);
      setQualityMetrics(quality);

      // 3. Upload captured image to Supabase storage (`public-media`)
      let finalImageUrl = previewUrl;
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        const owner = user?.id ?? 'guest';
        const storagePath = `reports/${owner}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}.jpg`;
        const { error: uploadErr } = await supabase.storage
          .from('public-media')
          .upload(storagePath, photo, {
            contentType: 'image/jpeg',
            upsert: false,
          });

        if (!uploadErr) {
          const {
            data: { publicUrl },
          } = supabase.storage.from('public-media').getPublicUrl(storagePath);
          finalImageUrl = publicUrl;
          setUploadedPhotoUrl(publicUrl);
        } else {
          setUploadedPhotoUrl(previewUrl);
        }
      } catch {
        setUploadedPhotoUrl(previewUrl);
      }

      // 4. Send photo to backend Roboflow classifier and identify concern category + description
      let inference: MobileNetV3InferenceResponse;
      if (
        quality.width >= 160 &&
        quality.height >= 160 &&
        quality.sizeBytes >= 1500
      ) {
        inference = await runMobileNetV3Classification({
          imageUrl: finalImageUrl,
          photoBlob: photo,
          gps: currentGps,
          simulateError: payload?.simulateError,
          mockPredictedClass: payload?.mockPredictedClass,
        });
      } else {
        inference = {
          modelStatus: 'not_connected',
          predictedClass: null,
          confidence: null,
        };
      }
      setInferenceResult(inference);

      // 5. Evaluate image suitability & confidence threshold
      const evalResult = evaluateImageSuitability(
        quality,
        inference,
        DEFAULT_CONFIDENCE_THRESHOLD
      );
      setSuitability(evalResult);

      if (
        evalResult.status === 'confident' &&
        evalResult.matchedCategory
      ) {
        setSelectedCategoryKey(evalResult.matchedCategory.key);
        setShowCategorySelector(false);
      } else {
        setSelectedCategoryKey(evalResult.matchedCategory?.key || '');
        setShowCategorySelector(true);
      }

      const generated = buildAutomatedReportDescription({
        suitability: evalResult,
        selectedCategoryKey: evalResult.matchedCategory?.key ?? null,
        aiServiceDescription: inference.aiGeneratedDescription,
      });
      setDescription(generated.description);
      setDescriptionSourceLabel(generated.sourceLabel);

      setStep('preview');
    },
    [gpsReading, requestFreshGpsLocation]
  );

  const handleRetryClassification = useCallback(async () => {
    const blob = lastCapturedBlobRef.current;
    if (!blob) {
      setCameraModalOpen(true);
      return;
    }
    await handlePhotoCaptured(blob, {
      blob,
      localPreviewUrl: photoPreviewUrl || URL.createObjectURL(blob),
      capturedAtTimestamp: Date.now(),
      gpsReading,
      gpsError,
    });
  }, [gpsError, gpsReading, handlePhotoCaptured, photoPreviewUrl]);

  // Expose test helper for automated browser verification of camera captures & Roboflow responses
  useEffect(() => {
    (
      window as unknown as Record<string, unknown>
    ).__CORA_TEST_CAPTURE__ = handlePhotoCaptured;
    return () => {
      delete (
        window as unknown as Record<string, unknown>
      ).__CORA_TEST_CAPTURE__;
    };
  }, [handlePhotoCaptured]);

  const handleRetakePhoto = () => {
    setCameraModalOpen(true);
  };

  const handleCancelCamera = () => {
    if (photoPreviewUrl && suitability) {
      setCameraModalOpen(false);
      setStep('preview');
    } else {
      navigate('/');
    }
  };

  const handleSelectCategoryOverride = (key: ApprovedConcernCategoryKey) => {
    setSelectedCategoryKey(key);
    if (
      !suitability?.matchedCategory ||
      suitability.matchedCategory.key !== key
    ) {
      setIsCategoryOverridden(true);
    } else {
      setIsCategoryOverridden(false);
    }
    setShowCategorySelector(false);
  };

  const applyVoice = (r: VoiceOrganized) => {
    const matched = resolveApprovedCategory(r.category);
    if (matched) {
      setSelectedCategoryKey(matched.key);
    }
    if (r.description) {
      setDescription(r.description.slice(0, 1000));
      setResidentEditedDescription(true);
      setDescriptionSourceLabel('Voice-Assisted Description (Resident Confirmed)');
    }
    if (r.location_details && !locationDetails) {
      setLocationDetails(r.location_details.slice(0, 200));
    }
    setUsedVoice(true);
  };

  // Compute live autonomous AI decision for the current capture
  const currentAutonomousDecision = evaluateAutonomousAiReportDecision({
    suitability,
    selectedCategoryKey: selectedCategoryKey || null,
    description,
    hasPhoto: Boolean(photoPreviewUrl || uploadedPhotoUrl),
  });

  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isSubmitting || submissionLockRef.current || step === 'submitted') {
      return;
    }

    if (!photoPreviewUrl && !uploadedPhotoUrl) {
      toast.error('Please capture a photo of the community concern first.');
      return;
    }

    // Re-validate GPS freshness & Barangay Purisima geofencing before submitting
    const currentGpsEval = validateCapturedGpsLocation(gpsReading, Date.now());
    setGpsValidation(currentGpsEval);

    if (!gpsReading || !currentGpsEval.isValid) {
      toast.error(
        currentGpsEval.statusMessage ||
          'Verified GPS coordinates within Barangay Purisima are required before submitting.'
      );
      return;
    }

    submissionLockRef.current = true;
    setIsSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const reportId = activeReportUUIDRef.current;
      const createdAt = new Date().toISOString();

      // Autonomous AI Decision (No Human-in-the-Loop):
      // Automatically approves clear 4-class reports; automatically rejects blurred or unrelated reports.
      const decision = evaluateAutonomousAiReportDecision({
        suitability,
        selectedCategoryKey: selectedCategoryKey || null,
        description,
        hasPhoto: Boolean(photoPreviewUrl || uploadedPhotoUrl),
      });

      const categoryLabel =
        decision.matchedCategory?.label ||
        resolveApprovedCategory(selectedCategoryKey)?.label ||
        'Unrecognized / Rejected Report';

      const finalDescriptionText =
        description.trim() ||
        decision.matchedCategory?.conservativeTemplate ||
        decision.reason;

      const metadataLines = [
        `Autonomous AI Decision: ${
          decision.verdict === 'approved'
            ? `Auto-Approved (${categoryLabel} · ${decision.confidencePercent}% confidence)`
            : `Auto-Rejected (${decision.reason})`
        }`,
        isCategoryOverridden
          ? `Category Correction: Resident updated category to ${categoryLabel}`
          : null,
        `Description Source: ${
          descriptionSourceLabel || 'AI-Generated Description'
        }`,
        `GPS Verification: ${gpsReading.lat.toFixed(6)}, ${gpsReading.lng.toFixed(
          6
        )} (±${Math.round(gpsReading.accuracyMeters)}m accuracy)`,
        locationDetails.trim()
          ? `Specific Landmark: ${locationDetails.trim()}`
          : null,
        contactName.trim() ? `Reporter: ${contactName.trim()}` : null,
        contactNumber.trim() ? `Contact: ${contactNumber.trim()}` : null,
        usedVoice
          ? 'Input: CORA voice-assisted report (resident reviewed and confirmed)'
          : null,
      ]
        .filter(Boolean)
        .join('\n');

      const { error } = await supabase.from('service_requests').insert({
        id: reportId,
        user_id: user?.id || null,
        title: `[REPORT] ${categoryLabel}`,
        description: `${finalDescriptionText}\n\n${metadataLines}`,
        category: `Report: ${categoryLabel}`,
        status: decision.requestStatus,
        ai_category: decision.matchedCategory?.label ?? null,
        ai_confidence: decision.confidencePercent,
        ai_reason: decision.reason,
        ai_validation_status: decision.aiValidationStatus,
        ai_validation_confidence: decision.confidencePercent,
        ai_validation_reason: decision.reason,
        ai_validated_at: createdAt,
        ai_validation_elements: decision.elements,
        admin_review_status: decision.adminReviewStatus,
        admin_notes: decision.adminNote,
        acknowledged_at: decision.verdict === 'approved' ? createdAt : null,
        response_at: decision.verdict === 'approved' ? createdAt : null,
        requires_review: false,
        location:
          'Barangay Purisima, Tago, Surigao del Sur' +
          (locationDetails.trim() ? `, ${locationDetails.trim()}` : ''),
        latitude: gpsReading.lat,
        longitude: gpsReading.lng,
        photo_url: uploadedPhotoUrl || photoPreviewUrl,
        media_urls:
          uploadedPhotoUrl || photoPreviewUrl
            ? [uploadedPhotoUrl || photoPreviewUrl!]
            : [],
        media_types: uploadedPhotoUrl || photoPreviewUrl ? ['image'] : [],
        reporter_name: contactName.trim() || null,
        is_public: decision.verdict === 'approved' ? isPublic : false,
      });

      if (error) {
        console.error(error);
        toast.error(
          error.message ||
            'Failed to submit report. Please check your connection and try again.'
        );
        submissionLockRef.current = false;
        setIsSubmitting(false);
        return;
      }

      setSubmittedReportId(reportId);
      setSubmittedAt(createdAt);
      setFinalAiDecision(decision);
      setStep('submitted');
      setIsSubmitting(false);

      if (decision.verdict === 'approved') {
        toast.success(
          `Report automatically approved by AI under ${categoryLabel}!`
        );
        // Trigger automatic department routing for approved reports
        supabase.functions
          .invoke('route-complaint', { body: { report_id: reportId } })
          .catch(() => {});
      } else {
        toast.error(decision.reason);
      }
    } catch (err) {
      console.error(err);
      toast.error('An unexpected error occurred while submitting your report.');
      submissionLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  const resetForNewReport = () => {
    submissionLockRef.current = false;
    activeReportUUIDRef.current = crypto.randomUUID();
    setPhotoPreviewUrl(null);
    setUploadedPhotoUrl(null);
    setCapturedAtIso(null);
    setQualityMetrics(null);
    setInferenceResult(null);
    setSuitability(null);
    setSelectedCategoryKey('');
    setIsCategoryOverridden(false);
    setShowCategorySelector(false);
    setDescription('');
    setDescriptionSourceLabel('');
    setIsEditingDescription(false);
    setResidentEditedDescription(false);
    setLocationDetails('');
    setUsedVoice(false);
    setSubmittedReportId(null);
    setSubmittedAt(null);
    setFinalAiDecision(null);
    setStep('capture');
    setCameraModalOpen(true);
    requestFreshGpsLocation();
  };

  // Immediately open camera on entry or when retaking photo
  if (cameraModalOpen || step === 'capture') {
    return (
      <DirectCameraCapture
        onUsePhoto={handlePhotoCaptured}
        onCancel={handleCancelCamera}
      />
    );
  }

  const activeCategoryObj = resolveApprovedCategory(selectedCategoryKey);

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-28 text-[#142B38] lg:pb-12">
      {/* Clean Barangay Purisima Portal Header */}
      <header
        className="border-b border-white/10 px-4 pb-6 pt-5 text-white sm:px-6"
        style={{
          background: 'linear-gradient(135deg, #142B38 0%, #177A73 100%)',
        }}
      >
        <div className="mx-auto max-w-2xl">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="mb-3 inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Resident Dashboard</span>
          </button>

          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Camera className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {step === 'analyzing'
                  ? 'Analyzing Your Report'
                  : step === 'submitted'
                  ? 'AI Report Decision'
                  : 'Review Your Report'}
              </h1>
              <p className="mt-0.5 text-xs text-white/85 sm:text-sm">
                Barangay Purisima, Tago, Surigao del Sur
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto mt-5 max-w-2xl px-4 sm:px-6">
        {/* AI ANALYSIS LOADING STATE */}
        {step === 'analyzing' && (
          <Card
            data-testid="ai-analyzing-state"
            className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
          >
            <CardContent className="p-8 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#EAF6F4] text-[#177A73]">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
              <h2
                data-testid="ai-analyzing-heading"
                className="mt-4 text-xl font-bold text-[#142B38]"
              >
                AI is analyzing your report...
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-xs leading-relaxed text-[#64748B] sm:text-sm">
                Checking image clarity, classifying against the 4 supported community concern classes, and verifying your Barangay Purisima location.
              </p>

              {photoPreviewUrl && (
                <div className="mx-auto mt-5 h-44 w-64 overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-100 shadow-xs">
                  <img
                    src={photoPreviewUrl}
                    alt="Captured community concern"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* REPORT PREVIEW: Captured Photo → Detected Category → AI-Generated Description → Location Map → Submit Report Button */}
        {step === 'preview' && suitability && (
          <form
            onSubmit={handleSubmitReport}
            data-testid="ai-report-preview"
            className="space-y-5"
          >
            {/* 1. CAPTURED PHOTO */}
            <Card
              data-testid="preview-section-photo"
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <CardContent className="p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#177A73]">
                      Step 1 · Captured Photo
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#142B38]">
                      Captured Photo
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="preview-retake-btn"
                    onClick={handleRetakePhoto}
                    className="rounded-xl border-[#E2E8F0] text-xs font-semibold text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73]"
                  >
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    Retake Photo
                  </Button>
                </div>

                {photoPreviewUrl && (
                  <div className="mt-4 overflow-hidden rounded-xl border border-[#E2E8F0] bg-slate-950">
                    <img
                      src={photoPreviewUrl}
                      alt="Captured community concern"
                      data-testid="report-preview-photo"
                      className="max-h-72 w-full object-contain"
                    />
                  </div>
                )}

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#64748B]">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-[#177A73]" />
                    <span>
                      Captured:{' '}
                      {capturedAtIso
                        ? new Date(capturedAtIso).toLocaleString()
                        : new Date().toLocaleString()}
                    </span>
                  </span>
                  {qualityMetrics && (
                    <span
                      className={cn(
                        'font-semibold',
                        suitability.isReadable
                          ? 'text-[#177A73]'
                          : 'text-red-600'
                      )}
                    >
                      {suitability.isReadable
                        ? 'Clear Photo · Passed Blur Check'
                        : 'Blurred / Unclear Image — Will Be Rejected by AI'}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 2. DETECTED CATEGORY */}
            <Card
              data-testid="preview-section-category"
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#177A73]">
                      Step 2 · Concern Classification &amp; Autonomous AI Verdict
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#142B38]">
                      Detected Category
                    </h2>
                  </div>

                  <span
                    data-testid="ai-analysis-status-badge"
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-bold',
                      currentAutonomousDecision.verdict === 'approved'
                        ? 'bg-emerald-100 text-emerald-900'
                        : 'bg-red-100 text-red-900'
                    )}
                  >
                    {currentAutonomousDecision.verdict === 'approved' ? (
                      <CheckCircle className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 text-red-700" />
                    )}
                    <span>
                      {currentAutonomousDecision.verdict === 'approved'
                        ? 'AI Auto-Approval Ready'
                        : 'Will Be Auto-Rejected by AI'}
                    </span>
                  </span>
                </div>

                {/* Suggested or User-Selected 4-Class Prediction Box */}
                {(activeCategoryObj ||
                  (suitability.status === 'confident' &&
                    suitability.matchedCategory)) && (
                  <div
                    data-testid="confident-prediction-box"
                    className="rounded-xl border border-[#177A73]/30 bg-[#EAF6F4]/60 p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const catKey =
                            activeCategoryObj?.key ||
                            suitability.matchedCategory?.key ||
                            'garbage';
                          const Icon = CATEGORY_ICONS[catKey];
                          return (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#177A73] text-white">
                              <Icon className="h-5 w-5" />
                            </div>
                          );
                        })()}
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-xs font-medium text-[#64748B]">
                              {isCategoryOverridden
                                ? 'Selected Report Category'
                                : 'Suggested Report Category'}
                            </p>
                            {(() => {
                              const currentKey =
                                activeCategoryObj?.key ||
                                suitability.matchedCategory?.key;
                              const rfClass =
                                (!isCategoryOverridden &&
                                  inferenceResult?.rawPredictedClass) ||
                                (currentKey
                                  ? ROBOFLOW_CLASS_LABEL_BY_KEY[currentKey]
                                  : null);
                              return rfClass ? (
                                <span
                                  data-testid="predicted-roboflow-class"
                                  className="inline-flex items-center rounded-md bg-[#177A73]/15 px-2 py-0.5 font-mono text-[11px] font-bold text-[#177A73]"
                                >
                                  class: {rfClass}
                                </span>
                              ) : null;
                            })()}
                          </div>
                          <p
                            data-testid="detected-concern-label"
                            className="mt-0.5 text-base font-bold text-[#142B38]"
                          >
                            {activeCategoryObj?.label ||
                              suitability.matchedCategory?.label}
                          </p>
                          {isCategoryOverridden &&
                            suitability.matchedCategory && (
                              <p
                                data-testid="category-override-note"
                                className="mt-0.5 text-[11px] font-medium text-[#177A73]"
                              >
                                Updated from{' '}
                                {suitability.matchedCategory.label}
                              </p>
                            )}
                        </div>
                      </div>

                      {suitability.confidencePercent !== null &&
                        !isCategoryOverridden && (
                          <div className="min-w-[175px]">
                            <div className="flex items-center justify-between gap-3 text-xs">
                              <span className="font-medium text-[#64748B]">
                                Detection Confidence
                              </span>
                              <span
                                data-testid="detected-confidence-value"
                                className="font-bold text-[#177A73]"
                              >
                                {suitability.confidencePercent}%
                              </span>
                            </div>
                            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-[#177A73]/20">
                              <div
                                className="h-full rounded-full bg-[#177A73] transition-all"
                                style={{
                                  width: `${
                                    suitability.confidencePercent ?? 0
                                  }%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </div>
                )}

                {/* Classifier Service Error Banner (Graceful recovery + Retry + Manual Category Selection) */}
                {(inferenceResult?.modelStatus === 'error' ||
                  suitability.status === 'model_unavailable') && (
                  <div
                    data-testid="classification-error-banner"
                    role="alert"
                    className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-bold leading-snug">
                          Automatic Classifier Unavailable — Please Select or Confirm Category
                        </p>
                        <p
                          data-testid="classification-error-message"
                          className="text-xs leading-relaxed text-amber-900"
                        >
                          {inferenceResult?.errorMessage ||
                            suitability.userMessage}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            data-testid="retry-classification-btn"
                            onClick={() => void handleRetryClassification()}
                            className="rounded-lg bg-[#177A73] text-xs font-semibold text-white hover:bg-[#12625D]"
                          >
                            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                            Retry Classification
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={handleRetakePhoto}
                            className="rounded-lg border-amber-300 bg-white text-xs font-semibold text-amber-950 hover:bg-amber-100"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Retake or Upload Photo
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Non-matching / Unrelated Image Warning */}
                {suitability.status === 'low_confidence' && (
                  <div
                    data-testid="low-confidence-banner"
                    className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-bold leading-snug">
                          Low Classification Confidence — Select a Category or Retake Photo
                        </p>
                        <p className="text-xs leading-relaxed text-red-800">
                          {LOW_CONFIDENCE_MESSAGE}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleRetakePhoto}
                            className="rounded-lg bg-[#F36B3F] text-xs font-semibold text-white hover:bg-[#dc5a30]"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Retake Clear Photo of Concern
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Blurred / Unreadable Image Banner (Will Auto-Reject) */}
                {suitability.status === 'unreadable_image' && (
                  <div
                    data-testid="unreadable-image-banner"
                    className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950"
                  >
                    <div className="flex items-start gap-3">
                      <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                      <div className="flex-1 space-y-2">
                        <p className="text-sm font-bold">
                          Blurred or Unclear Photo — Automatic AI Rejection
                        </p>
                        <p className="text-xs leading-relaxed text-red-800">
                          {suitability.userMessage}
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                          <Button
                            type="button"
                            size="sm"
                            onClick={handleRetakePhoto}
                            className="rounded-lg bg-[#F36B3F] text-xs font-semibold text-white hover:bg-[#dc5a30]"
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Retake Clear Photo
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Category Selection / Override Among the 4 Supported Classes (drainage, road, streetlights, waste) */}
                {suitability.isReadable && (
                  <>
                    {showCategorySelector || !activeCategoryObj ? (
                      <div
                        data-testid="category-selector-grid"
                        className="space-y-2.5 pt-1"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-[#142B38]">
                            Select or change the report category (drainage, road, streetlights, waste):
                          </p>
                          {activeCategoryObj && (
                            <button
                              type="button"
                              onClick={() => setShowCategorySelector(false)}
                              className="text-xs font-semibold text-[#64748B] hover:text-[#142B38]"
                            >
                              Hide
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                          {APPROVED_CONCERN_CATEGORIES.map((cat) => {
                            const Icon = CATEGORY_ICONS[cat.key];
                            const isSelected = selectedCategoryKey === cat.key;
                            const rfClass = ROBOFLOW_CLASS_LABEL_BY_KEY[cat.key];
                            return (
                              <button
                                key={cat.key}
                                type="button"
                                data-testid={`select-category-${cat.key}`}
                                onClick={() =>
                                  handleSelectCategoryOverride(cat.key)
                                }
                                className={cn(
                                  'flex items-center gap-3 rounded-xl border p-3.5 text-left transition-all',
                                  isSelected
                                    ? 'border-[#177A73] bg-[#EAF6F4] ring-2 ring-[#177A73]/25'
                                    : 'border-[#E2E8F0] bg-white hover:border-[#177A73]/40 hover:bg-[#F8FAFC]'
                                )}
                              >
                                <div
                                  className={cn(
                                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                                    isSelected
                                      ? 'bg-[#177A73] text-white'
                                      : 'bg-[#EAF6F4] text-[#177A73]'
                                  )}
                                >
                                  <Icon className="h-4 w-4" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-[#142B38]">
                                      {cat.label}
                                    </p>
                                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#64748B]">
                                      {rfClass}
                                    </span>
                                  </div>
                                  <p className="truncate text-[11px] text-[#64748B]">
                                    {cat.shortDescription}
                                  </p>
                                </div>
                                {isSelected && (
                                  <CheckCircle className="h-4 w-4 shrink-0 text-[#177A73]" />
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between border-t border-[#E2E8F0] pt-3 text-xs">
                        <span className="text-[#64748B]">
                          Need to change the suggested category (drainage, road, streetlights, waste)?
                        </span>
                        <button
                          type="button"
                          data-testid="change-category-btn"
                          onClick={() => setShowCategorySelector(true)}
                          className="font-semibold text-[#177A73] hover:underline"
                        >
                          Change Category
                        </button>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            {/* 3. AI-GENERATED DESCRIPTION */}
            <Card
              data-testid="preview-section-description"
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <CardContent className="space-y-3.5 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#177A73]">
                      Step 3 · Automated Description
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#142B38]">
                      AI-Generated Description
                    </h2>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    data-testid="toggle-edit-description-btn"
                    onClick={() => setIsEditingDescription((prev) => !prev)}
                    className="h-8 rounded-xl border-[#E2E8F0] text-xs font-semibold text-[#142B38]"
                  >
                    <Edit3 className="mr-1.5 h-3.5 w-3.5" />
                    {isEditingDescription ? 'Done Editing' : 'Edit Description'}
                  </Button>
                </div>

                <div className="inline-flex items-center gap-1.5 rounded-md bg-[#EAF6F4] px-2.5 py-1 text-[11px] font-semibold text-[#177A73]">
                  <Sparkles className="h-3 w-3" />
                  <span data-testid="description-source-badge">
                    {descriptionSourceLabel || 'AI-Generated Description'}
                  </span>
                </div>

                {!isEditingDescription ? (
                  <div
                    data-testid="auto-generated-description-text"
                    className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm leading-relaxed text-[#142B38]"
                  >
                    {description}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Textarea
                      data-testid="edit-description-textarea"
                      value={description}
                      onChange={(e) => {
                        setDescription(e.target.value);
                        setResidentEditedDescription(true);
                        setDescriptionSourceLabel(
                          'Resident-Edited Description'
                        );
                      }}
                      rows={4}
                      maxLength={1000}
                      className="rounded-xl border-[#E2E8F0] text-sm"
                    />
                    <div className="flex items-center justify-between text-xs text-[#64748B]">
                      <button
                        type="button"
                        onClick={() => {
                          setResidentEditedDescription(false);
                          setIsEditingDescription(false);
                        }}
                        className="font-semibold text-[#177A73] hover:underline"
                      >
                        Reset to AI Description
                      </button>
                      <span>{description.length}/1000</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-[#64748B]">
                  Automatically prepared from your photo — no manual typing required unless you wish to adjust a detail.
                </p>
              </CardContent>
            </Card>

            {/* 4. LOCATION MAP (OpenStreetMap + Actual Device GPS + Barangay Purisima Geofencing) */}
            <Card
              data-testid="preview-section-location"
              className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
            >
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-[#177A73]">
                      Step 4 · Location &amp; Geofencing
                    </p>
                    <h2 className="mt-0.5 text-lg font-bold text-[#142B38]">
                      Location Map
                    </h2>
                  </div>

                  <div className="flex items-center gap-2">
                    {gpsValidation && (
                      <span
                        data-testid="geofence-status-badge"
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold',
                          gpsValidation.isValid
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-amber-100 text-amber-900'
                        )}
                      >
                        <ShieldCheck className="h-3.5 w-3.5" />
                        <span>{gpsValidation.statusLabel}</span>
                      </span>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      data-testid="refresh-gps-btn"
                      onClick={() => requestFreshGpsLocation()}
                      disabled={gpsLoading}
                      className="h-8 rounded-xl border-[#E2E8F0] text-xs font-semibold"
                    >
                      {gpsLoading ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Refresh GPS
                    </Button>
                  </div>
                </div>

                {/* Interactive OpenStreetMap with Location Pin (Only rendered with real device coordinates) */}
                {gpsReading ? (
                  <div data-testid="report-osm-map-container">
                    <LocationPicker
                      value={{ lat: gpsReading.lat, lng: gpsReading.lng }}
                      onChange={() => {}}
                      height="240px"
                      readOnly={true}
                    />
                  </div>
                ) : (
                  <div
                    data-testid="gps-missing-warning"
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border border-amber-300 bg-amber-50 p-6 text-center text-amber-950"
                  >
                    <MapPin className="h-7 w-7 text-amber-600" />
                    <div className="max-w-md space-y-1">
                      <p className="text-sm font-bold">
                        Device GPS Location Required
                      </p>
                      <p className="text-xs leading-relaxed text-amber-800">
                        {gpsError ||
                          'Please allow location permission so CORA can pin your actual capture coordinates on the OpenStreetMap map and verify that the issue is within Barangay Purisima.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => requestFreshGpsLocation()}
                      disabled={gpsLoading}
                      className="rounded-xl bg-[#177A73] text-xs font-semibold text-white hover:bg-[#12625D]"
                    >
                      {gpsLoading ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Enable &amp; Retry GPS Location
                    </Button>
                  </div>
                )}

                {/* Detected Location & GPS Accuracy Details */}
                <div
                  data-testid="captured-location-details"
                  className="space-y-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4"
                >
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 shrink-0 text-[#177A73]" />
                    <p className="text-sm font-bold text-[#142B38]">
                      Barangay Purisima, Tago, Surigao del Sur
                    </p>
                  </div>

                  {gpsReading && (
                    <div className="grid grid-cols-1 gap-2 text-xs text-[#142B38] sm:grid-cols-3">
                      <p>
                        <span className="font-semibold text-[#64748B]">
                          Latitude:
                        </span>{' '}
                        <span
                          data-testid="captured-lat"
                          className="font-mono font-semibold"
                        >
                          {gpsReading.lat.toFixed(6)}
                        </span>
                      </p>
                      <p>
                        <span className="font-semibold text-[#64748B]">
                          Longitude:
                        </span>{' '}
                        <span
                          data-testid="captured-lng"
                          className="font-mono font-semibold"
                        >
                          {gpsReading.lng.toFixed(6)}
                        </span>
                      </p>
                      <p>
                        <span className="font-semibold text-[#64748B]">
                          GPS Accuracy:
                        </span>{' '}
                        <span
                          data-testid="captured-accuracy"
                          className="font-mono font-semibold"
                        >
                          ±{Math.round(gpsReading.accuracyMeters)} meters
                        </span>
                      </p>
                    </div>
                  )}

                  {gpsValidation && (
                    <p
                      className={cn(
                        'pt-1 text-xs leading-relaxed',
                        gpsValidation.isValid
                          ? 'text-[#177A73]'
                          : 'font-medium text-amber-800'
                      )}
                    >
                      {gpsValidation.statusMessage}
                    </p>
                  )}
                </div>

                {/* Optional Landmark / Contact Info Accordion */}
                <div className="border-t border-[#E2E8F0] pt-3">
                  <button
                    type="button"
                    onClick={() => setShowOptionalDetails((prev) => !prev)}
                    className="flex w-full items-center justify-between text-left text-xs font-semibold text-[#64748B] hover:text-[#142B38]"
                  >
                    <span>
                      Optional: Select Purok or Add Contact Info
                    </span>
                    {showOptionalDetails ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </button>

                  {showOptionalDetails && (
                    <div className="mt-3 space-y-3.5 pt-2">
                      <div className="space-y-1.5">
                        <label
                          htmlFor="purok-select"
                          className="text-xs font-semibold text-[#142B38]"
                        >
                          Select Purok (Optional)
                        </label>
                        <select
                          id="purok-select"
                          data-testid="purok-dropdown"
                          value={locationDetails}
                          onChange={(e) => setLocationDetails(e.target.value)}
                          className="flex h-10 w-full rounded-xl border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#142B38] shadow-xs transition-colors focus:border-[#177A73] focus:outline-none focus:ring-2 focus:ring-[#177A73]/20"
                        >
                          <option value="">Select Purok...</option>
                          <option value="Purok Avocado Evergreen">
                            Purok Avocado Evergreen
                          </option>
                          <option value="Purok Avocado Maroon">
                            Purok Avocado Maroon
                          </option>
                          <option value="Purok Calamansi">
                            Purok Calamansi
                          </option>
                          <option value="Purok Citrus I">Purok Citrus I</option>
                          <option value="Purok Citrus II">
                            Purok Citrus II
                          </option>
                          <option value="Purok Grapes">Purok Grapes</option>
                          <option value="Purok Mangga I">Purok Mangga I</option>
                          <option value="Purok Mangga II">
                            Purok Mangga II
                          </option>
                          <option value="Purok Tambis">Purok Tambis</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <Input
                          value={contactName}
                          onChange={(e) => setContactName(e.target.value)}
                          placeholder="Your name (optional)"
                          maxLength={100}
                        />
                        <Input
                          type="tel"
                          value={contactNumber}
                          onChange={(e) => setContactNumber(e.target.value)}
                          placeholder="Contact number (optional)"
                          maxLength={15}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* 5. SUBMIT REPORT BUTTON */}
            <div
              data-testid="preview-section-submit"
              className="flex flex-col-reverse gap-3 pt-1 sm:flex-row"
            >
              <Button
                type="button"
                variant="outline"
                size="lg"
                data-testid="bottom-retake-btn"
                onClick={handleRetakePhoto}
                disabled={isSubmitting}
                className="min-h-12 flex-1 rounded-xl border-[#E2E8F0] bg-white font-semibold text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73]"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Retake Photo
              </Button>
              <Button
                type="submit"
                size="lg"
                data-testid="submit-report-btn"
                disabled={isSubmitting}
                className="min-h-12 flex-1 rounded-xl bg-[#F36B3F] font-bold text-white shadow-md hover:bg-[#dc5a30]"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running AI Auto-Verification...
                  </>
                ) : (
                  <>
                    <FileCheck2 className="mr-2 h-4 w-4" />
                    Submit Report
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* REPORT SUBMITTED CONFIRMATION (Shows Autonomous AI Approval or Rejection) */}
        {step === 'submitted' && (
          <Card
            data-testid="report-submitted-confirmation"
            className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm"
          >
            <CardContent className="p-6 text-center sm:p-8">
              {finalAiDecision?.verdict === 'rejected' ? (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-600">
                  <XCircle className="h-9 w-9" />
                </div>
              ) : (
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[#177A73]">
                  <CheckCircle className="h-9 w-9" />
                </div>
              )}

              <h2
                data-testid="submitted-verdict-heading"
                className="mt-4 text-2xl font-bold text-[#142B38]"
              >
                {finalAiDecision?.verdict === 'rejected'
                  ? 'Report Automatically Rejected by AI'
                  : 'Report Automatically Approved by AI'}
              </h2>
              <p className="mx-auto mt-1.5 max-w-md text-sm text-[#64748B]">
                {finalAiDecision?.reason ||
                  'Your community concern has been automatically verified and approved by AI for barangay action.'}
              </p>

              <div className="mx-auto mt-6 max-w-md space-y-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-left text-xs sm:text-sm">
                <div className="flex items-center justify-between border-b border-[#E2E8F0] pb-2">
                  <span className="font-medium text-[#64748B]">
                    Reference Number:
                  </span>
                  <span
                    data-testid="submitted-report-id"
                    className="font-mono font-bold text-[#142B38]"
                  >
                    CORA-{submittedReportId?.slice(0, 8).toUpperCase()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#64748B]">Category:</span>
                  <span className="font-bold text-[#142B38]">
                    {finalAiDecision?.matchedCategory?.label ||
                      activeCategoryObj?.label ||
                      'Unrecognized / Outside 4 Classes'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#64748B]">Location:</span>
                  <span className="font-medium text-[#142B38]">
                    Barangay Purisima, Tago, Surigao del Sur
                  </span>
                </div>
                {gpsReading && (
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-[#64748B]">
                      GPS Coordinates:
                    </span>
                    <span className="font-mono text-xs text-[#142B38]">
                      {gpsReading.lat.toFixed(5)}, {gpsReading.lng.toFixed(5)} (±
                      {Math.round(gpsReading.accuracyMeters)}m)
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#64748B]">
                    Date Processed:
                  </span>
                  <span className="text-[#142B38]">
                    {submittedAt
                      ? new Date(submittedAt).toLocaleString()
                      : 'Just now'}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="font-medium text-[#64748B]">
                    AI Automatic Decision:
                  </span>
                  {finalAiDecision?.verdict === 'rejected' ? (
                    <span
                      data-testid="submitted-ai-verdict-badge"
                      className="inline-flex items-center rounded-md bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-900"
                    >
                      Auto-Rejected by AI
                    </span>
                  ) : (
                    <span
                      data-testid="submitted-ai-verdict-badge"
                      className="inline-flex items-center rounded-md bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-900"
                    >
                      Auto-Approved by AI
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Button
                  type="button"
                  data-testid="view-my-reports-btn"
                  onClick={() => navigate('/my-requests')}
                  className="min-h-11 rounded-xl bg-[#177A73] px-6 font-semibold text-white hover:bg-[#12625D]"
                >
                  View My Reports
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetForNewReport}
                  className="min-h-11 rounded-xl border-[#E2E8F0] px-6 font-semibold text-[#142B38]"
                >
                  {finalAiDecision?.verdict === 'rejected'
                    ? 'Retake & Submit Valid Photo'
                    : 'Submit Another Report'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="min-h-11 rounded-xl px-5 font-semibold text-[#64748B]"
                >
                  Back to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      <BottomNav currentPath="/report-issue" />
    </div>
  );
};

export default ReportIssue;
