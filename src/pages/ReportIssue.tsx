import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle, AlertCircle, MapPin, Camera } from 'lucide-react';
import { LocationPicker } from '@/components/LocationPicker';
import { BarangaySelect } from '@/components/BarangaySelect';
import { DirectCameraCapture } from '@/components/DirectCameraCapture';
import { z } from 'zod';
import { VoiceReportAssistant, type VoiceOrganized } from '@/components/VoiceReportAssistant';

const reportCategories = [
  { value: 'road_damage', label: 'Road Damage' },
  { value: 'street_light', label: 'Street Light Issue' },
  { value: 'garbage', label: 'Garbage/Waste Problem' },
  { value: 'drainage', label: 'Drainage/Canal Issue' },
  { value: 'water_supply', label: 'Water Supply Problem' },
  { value: 'public_safety', label: 'Public Safety Concern' },
  { value: 'noise', label: 'Noise Complaint' },
  { value: 'stray_animals', label: 'Stray Animals' },
  { value: 'illegal_activity', label: 'Illegal Activity' },
  { value: 'environmental', label: 'Environmental Issue' },
  { value: 'other', label: 'Other Issue' },
];

const reportSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  description: z.string().min(20, 'Please provide more details (at least 20 characters)').max(1000),
  barangay: z.string().min(1, 'Please select the barangay'),
});

const ReportIssue = () => {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [barangay, setBarangay] = useState('');
  const [locationDetails, setLocationDetails] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [cameraOpen, setCameraOpen] = useState(true);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submittedReportId, setSubmittedReportId] = useState<string | null>(null);
  const [submittedReportStatus, setSubmittedReportStatus] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locationAccessError, setLocationAccessError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [usedVoice, setUsedVoice] = useState(false);

  const applyVoice = (r: VoiceOrganized) => {
    if (r.category && r.category !== 'unknown' && reportCategories.some((c) => c.value === r.category)) setCategory(r.category);
    setDescription(r.description.slice(0, 1000));
    if (r.location_details && !locationDetails) setLocationDetails(r.location_details.slice(0, 200));
    setErrors({});
    setUsedVoice(true);
  };

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationAccessError('Location access is unavailable in this browser. You can select the issue location on the map.');
      return;
    }
    setLocationAccessError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => setLocationAccessError('Location access was not granted. You can select the issue location on the map.'),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    if (!cameraOpen && !isSuccess && !coords) requestCurrentLocation();
  }, [cameraOpen, isSuccess, coords]);

  const handlePhotoCaptured = async (photo: Blob) => {
    const { data: { user } } = await supabase.auth.getUser();
    const owner = user?.id ?? 'guest';
    const path = `reports/${owner}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const { error } = await supabase.storage.from('public-media').upload(path, photo, {
      contentType: 'image/jpeg',
      upsert: false,
    });

    if (error) {
      console.error(error);
      toast.error('Could not save the captured photo. Check your connection and try again.');
      return;
    }

    const { data: { publicUrl } } = supabase.storage.from('public-media').getPublicUrl(path);
    setPhotoUrl(publicUrl);
    setCameraOpen(false);
  };

  const validate = () => {
    try {
      reportSchema.parse({ category, description, barangay });
      if (!coords) {
        setErrors({ location: 'Select the issue location on the map or use your current location before submitting.' });
        return false;
      }
      setErrors({});
      return true;
    } catch (e) {
      if (e instanceof z.ZodError) {
        const ne: Record<string, string> = {};
        e.errors.forEach((er) => er.path[0] && (ne[er.path[0] as string] = er.message));
        setErrors(ne);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) {
      toast.error('Please fix the errors in the form');
      return;
    }
    if (!isReviewing) {
      setIsReviewing(true);
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);
    const selected = reportCategories.find((c) => c.value === category);
    const { data: { user } } = await supabase.auth.getUser();

    const newId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const { error } = await supabase.from('service_requests').insert({
      id: newId,
      user_id: user?.id || null,
      title: `[REPORT] ${selected?.label || category}`,
      description: `${description}\n\n${contactName ? `Reporter: ${contactName}` : 'Anonymous Report'}\n${contactNumber ? `Contact: ${contactNumber}` : ''}\n${locationDetails ? `Location Details: ${locationDetails}` : ''}${usedVoice ? '\nInput: CORA voice-assisted report (resident reviewed and confirmed)' : ''}`,
      category: `Report: ${selected?.label || category}`,
      location: barangay + (locationDetails ? `, ${locationDetails}` : ''),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      photo_url: photoUrl,
      media_urls: photoUrl ? [photoUrl] : [],
      media_types: photoUrl ? ['image'] : [],
      reporter_name: contactName.trim() || null,
      is_public: isPublic,
    });
    const inserted = { id: newId };

    if (error) {
      console.error(error);
      toast.error(error?.message || 'Failed to submit report. Please check your connection and try again.');
      setIsSubmitting(false);
      return;
    }

    setIsSuccess(true);
    setSubmittedReportId(newId);
    setSubmittedReportStatus('pending');
    setSubmittedAt(createdAt);
    toast.success('Report submitted successfully!');
    setIsSubmitting(false);

    // Kick off AI validation + routing (non-blocking for the resident)
    try {
      const { error: validationError } = await supabase.functions.invoke('validate-report', { body: { reportId: inserted.id } });
      if (validationError) console.warn('Report saved; AI validation is pending:', validationError.message);
    } catch (e) {
      console.warn('Report saved; AI validation is pending:', e);
    }
    try {
      const { error: routingError } = await supabase.functions.invoke('route-complaint', { body: { report_id: inserted.id } });
      if (routingError) console.warn('Report saved; routing needs review:', routingError.message);
    } catch (e) {
      console.warn('Report saved; routing needs review:', e);
    }
  };

  if (cameraOpen) {
    return (
      <DirectCameraCapture
        onUsePhoto={handlePhotoCaptured}
        onCancel={() => navigate('/')}
      />
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="app-container">
          <div className="px-4 pt-12 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 animate-scale-in">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-2">Report Submitted Successfully</h1>
            <p className="text-muted-foreground text-center mb-8">
              Your community report has been submitted for barangay review.
            </p>
            <div className="mb-6 w-full max-w-sm rounded-xl border bg-card p-4 text-sm">
              <p><span className="font-medium">Report ID:</span> {submittedReportId}</p>
              <p className="mt-2"><span className="font-medium">Category:</span> {reportCategories.find((item) => item.value === category)?.label || category}</p>
              <p className="mt-2"><span className="font-medium">Location:</span> {barangay}{locationDetails ? `, ${locationDetails}` : ''}</p>
              <p className="mt-2"><span className="font-medium">Date Submitted:</span> {submittedAt ? new Date(submittedAt).toLocaleDateString() : '—'}</p>
              <p className="mt-2"><span className="font-medium">Status:</span> {submittedReportStatus === 'pending' ? 'Pending Review' : submittedReportStatus?.split('_').join(' ') || 'Submitted'}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              <Button variant="outline" onClick={() => navigate('/')}>Back to Home</Button>
              {submittedReportId && (
                <Button variant="outline" onClick={() => navigate('/my-requests')}>View My Reports</Button>
              )}
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setCategory(''); setDescription(''); setBarangay('');
                  setLocationDetails(''); setContactName(''); setContactNumber(''); setUsedVoice(false);
                  setPhotoUrl(null); setSubmittedReportId(null); setSubmittedReportStatus(null); setSubmittedAt(null); setCoords(null);
                  setIsReviewing(false);
                  setCameraOpen(true);
                }}
              >
                New Report
              </Button>
            </div>
          </div>
        </div>
        <BottomNav currentPath="/services" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-8 lg:pt-14">
      <div className="app-container pb-10 lg:max-w-2xl">
        <div className="bg-gradient-to-b from-accent to-accent/80 px-4 pt-8 pb-8">
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors lg:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Report an Issue</h1>
              <p className="text-white/70 text-sm">Add details about your community concern</p>
            </div>
          </div>
        </div>

        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        <div className="px-4 -mt-2">
          <Card variant="elevated" className="animate-slide-up">
            <CardContent className="p-5">
              {!isReviewing ? (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="flex items-center gap-3 rounded-lg border bg-card p-3">
                  {photoUrl ? (
                    <img src={photoUrl} alt="Captured community issue" className="h-16 w-16 rounded-md object-cover" />
                  ) : (
                    <Camera className="h-8 w-8 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">Photo captured</p>
                    <p className="text-xs text-muted-foreground">Image classification is not configured. Choose the issue category that best matches your photo.</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => setCameraOpen(true)}>Retake</Button>
                </div>

                <VoiceReportAssistant
                  barangay={barangay}
                  locationDetails={locationDetails}
                  hasPhoto={!!photoUrl}
                  onApply={applyVoice}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium">Community Issue *</label>
                  <Select value={category} onValueChange={(v) => { setCategory(v); setErrors((p) => ({ ...p, category: '' })); }}>
                    <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                      <SelectValue placeholder="What are you reporting?" />
                    </SelectTrigger>
                    <SelectContent>
                      {reportCategories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.category}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Describe the Issue *</label>
                  <Textarea
                    value={description}
                    onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: '' })); }}
                    placeholder="Describe what is happening and include any important details."
                    rows={4}
                    maxLength={1000}
                    className={errors.description ? 'border-destructive' : ''}
                  />
                  <p className="text-xs text-muted-foreground text-right">{description.length}/1000</p>
                  {errors.description && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> {errors.description}
                    </p>
                  )}
                </div>

                <BarangaySelect
                  value={barangay}
                  onValueChange={(v) => { setBarangay(v); setErrors((p) => ({ ...p, barangay: '' })); }}
                  error={errors.barangay}
                />

                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" /> Specific Location (Optional)
                  </label>
                  <Input
                    value={locationDetails}
                    onChange={(e) => setLocationDetails(e.target.value)}
                    placeholder="e.g., Near the school, in front of the church..."
                    maxLength={200}
                  />
                </div>

                <LocationPicker
                  value={coords}
                  onChange={(nextCoords) => {
                    setCoords(nextCoords);
                    setErrors((current) => ({ ...current, location: '' }));
                  }}
                />
                {locationAccessError && (
                  <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                    <p>{locationAccessError}</p>
                    <Button type="button" variant="outline" size="sm" className="mt-2" onClick={requestCurrentLocation}>Enable Location</Button>
                  </div>
                )}
                {coords && (
                  <div className="rounded-lg border bg-card p-3">
                    <p className="text-sm font-medium">Selected location</p>
                    <p className="mt-1 text-xs text-muted-foreground">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>
                  </div>
                )}
                {errors.location && <p className="text-sm text-destructive">{errors.location}</p>}

                <div className="p-4 rounded-xl bg-muted/50 space-y-3">
                  <p className="text-sm font-medium">Contact Information (Optional)</p>
                  <p className="text-xs text-muted-foreground">
                    Provide your contact if you want updates. Otherwise submit anonymously.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" maxLength={100} />
                    <Input type="tel" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Contact number" maxLength={15} />
                  </div>
                </div>

                <label className="flex items-start gap-3 p-3 rounded-xl border bg-card cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Share as a Community Report</p>
                    <p className="text-xs text-muted-foreground">
                      Let other residents view this report and follow its progress. Uncheck to keep it private to authorized personnel.
                    </p>
                  </div>
                </label>


                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  Review Report
                </Button>
              </form>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div>
                    <h2 className="text-lg font-semibold">Review Your Report</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Check the photo and details before submitting.</p>
                  </div>
                  {photoUrl && <img src={photoUrl} alt="Captured community issue" className="max-h-64 w-full rounded-lg object-cover" />}
                  <div className="space-y-3 rounded-lg border p-4 text-sm">
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Community Issue</p><p className="mt-1 font-medium">{reportCategories.find((item) => item.value === category)?.label || category}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Description</p><p className="mt-1 whitespace-pre-wrap">{description}</p></div>
                    <div><p className="text-xs font-semibold uppercase text-muted-foreground">Location</p><p className="mt-1">{barangay}{locationDetails ? `, ${locationDetails}` : ''}</p>{coords && <p className="mt-1 text-xs text-muted-foreground">{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</p>}</div>
                  </div>
                  <div className="rounded-lg bg-muted p-4 text-sm">
                    <p className="font-semibold">AI-Assisted Analysis</p>
                    <p className="mt-1 text-muted-foreground">Report analysis will run after submission. Barangay personnel remain responsible for final review and decisions.</p>
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button type="button" variant="outline" className="min-h-12 flex-1" onClick={() => setIsReviewing(false)}>Edit Report</Button>
                    <Button type="submit" size="lg" className="min-h-12 flex-1" disabled={isSubmitting}>
                      {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
                    </Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav currentPath="/services" />
    </div>
  );
};

export default ReportIssue;
