import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle, AlertCircle, MapPin } from 'lucide-react';
import { MediaUpload, MediaItem } from '@/components/MediaUpload';
import { ComplaintAgentChat } from '@/components/ComplaintAgentChat';
import { Bot, FileText } from 'lucide-react';
import { LocationPicker } from '@/components/LocationPicker';
import { BarangaySelect } from '@/components/BarangaySelect';
import { z } from 'zod';

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
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isPublic, setIsPublic] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    try {
      reportSchema.parse({ category, description, barangay });
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
    setIsSubmitting(true);
    const selected = reportCategories.find((c) => c.value === category);
    const { data: { user } } = await supabase.auth.getUser();

    const { error } = await supabase.from('service_requests').insert({
      user_id: user?.id || null,
      title: `[REPORT] ${selected?.label || category}`,
      description: `${description}\n\n${contactName ? `Reporter: ${contactName}` : 'Anonymous Report'}\n${contactNumber ? `Contact: ${contactNumber}` : ''}\n${locationDetails ? `Location Details: ${locationDetails}` : ''}`,
      category: `Report: ${selected?.label || category}`,
      location: barangay + (locationDetails ? `, ${locationDetails}` : ''),
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      photo_url: media.find((m) => m.type === 'image')?.url ?? null,
      media_urls: media.map((m) => m.url),
      media_types: media.map((m) => m.type),
      reporter_name: contactName.trim() || null,
      is_public: isPublic,
    });

    if (error) {
      console.error(error);
      toast.error('Failed to submit report');
    } else {
      setIsSuccess(true);
      toast.success('Report submitted successfully!');
    }
    setIsSubmitting(false);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="app-container">
          <div className="px-4 pt-12 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 animate-scale-in">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-2">Report Submitted!</h1>
            <p className="text-muted-foreground text-center mb-8">
              Thank you. The municipal office will review and take action.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/')}>Go Home</Button>
              <Button
                onClick={() => {
                  setIsSuccess(false);
                  setCategory(''); setDescription(''); setBarangay('');
                  setLocationDetails(''); setContactName(''); setContactNumber('');
                  setMedia([]); setCoords(null);
                }}
              >
                Submit Another
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
      <div className="app-container lg:max-w-2xl">
        <div className="bg-gradient-to-b from-accent to-accent/80 px-4 pt-12 pb-8">
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
              <p className="text-white/70 text-sm">No login required • Help improve our community</p>
            </div>
          </div>
        </div>

        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        <div className="px-4 -mt-2">
          <Card variant="elevated" className="animate-slide-up">
            <CardContent className="p-5">
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Type of Issue *</label>
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
                    placeholder="What did you observe? When did it happen?"
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

                <LocationPicker value={coords} onChange={setCoords} />

                <MediaUpload
                  folder="reports"
                  value={media}
                  onChange={setMedia}
                  label="Photo / Video Evidence (Recommended)"
                />

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
                    <p className="text-sm font-medium">Post to Community Wall</p>
                    <p className="text-xs text-muted-foreground">
                      Share this report publicly so other residents can track progress. Uncheck to keep it private to the municipality.
                    </p>
                  </div>
                </label>


                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit Report'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
      <BottomNav currentPath="/services" />
    </div>
  );
};

export default ReportIssue;
