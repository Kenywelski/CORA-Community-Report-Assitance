import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BottomNav } from '@/components/BottomNav';
import { AuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';
import { BarangaySelect } from '@/components/BarangaySelect';
import { LocationPicker } from '@/components/LocationPicker';
import { z } from 'zod';

const categories = [
  'Barangay Clearance',
  'Business Permit',
  'Community Tax Certificate',
  'Road Repair',
  'Street Lighting',
  'Water Supply',
  'Garbage Collection',
  'Drainage',
  'Public Safety',
  'Health Services',
  'Social Welfare',
  'Civil Registry',
  'Other',
];

// Validation schema
const requestSchema = z.object({
  category: z.string().min(1, 'Please select a category'),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title too long'),
  description: z.string().min(20, 'Please provide a detailed description (at least 20 characters)').max(1000, 'Description too long'),
  barangay: z.string().min(1, 'Please select your barangay'),
});

const RequestService = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get('category') || '';
  
  const { user, isLoading: authLoading } = useAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(initialCategory);
  const [barangay, setBarangay] = useState('');
  const [location, setLocation] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    try {
      requestSchema.parse({ category, title, description, barangay });
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach(err => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error('Please sign in to submit a request');
      navigate('/auth');
      return;
    }

    if (!validateForm()) {
      toast.error('Please fix the errors in the form');
      return;
    }

    setIsSubmitting(true);

    const { error } = await supabase.from('service_requests').insert({
      user_id: user.id,
      title: title.trim(),
      description: description.trim(),
      category,
      location: `${barangay}${location ? `, ${location}` : ''}`,
      latitude,
      longitude,
      photo_url: photoUrl,
    });

    if (error) {
      toast.error('Failed to submit request');
    } else {
      setIsSuccess(true);
      toast.success('Request submitted successfully!');
    }

    setIsSubmitting(false);
  };

  const handleLocationChange = (lat: number, lng: number) => {
    setLatitude(lat);
    setLongitude(lng);
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="app-container">
          <div className="px-4 pt-12 flex flex-col items-center justify-center min-h-[60vh]">
            <div className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6 animate-scale-in">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h1 className="text-2xl font-bold text-center mb-2">Request Submitted!</h1>
            <p className="text-muted-foreground text-center mb-8">
              Your service request has been submitted successfully. You can track its status in your profile.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => navigate('/')}>
                Go Home
              </Button>
              <Button onClick={() => navigate('/my-requests')}>
                View My Requests
              </Button>
            </div>
          </div>
        </div>
        <BottomNav currentPath="/services" onNavigate={(path) => navigate(path)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="app-container">
        {/* Header */}
        <div className="hero-gradient px-4 pt-12 pb-8">
          <button
            onClick={() => navigate('/services')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-white text-xl font-bold">Request Service</h1>
              <p className="text-white/70 text-sm">Submit a new service request</p>
            </div>
          </div>
        </div>

        {/* Curved transition */}
        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        {/* Form - Protected by AuthGuard */}
        <div className="px-4 -mt-2">
          <AuthGuard fallback="message">
            <Card variant="elevated" className="animate-slide-up">
              <CardContent className="p-5">
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Category *</label>
                    <Select value={category} onValueChange={(v) => { setCategory(v); setErrors(prev => ({ ...prev, category: '' })); }}>
                      <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                        <SelectValue placeholder="Select a category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>
                            {cat}
                          </SelectItem>
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
                    <label className="text-sm font-medium">Title *</label>
                    <Input
                      value={title}
                      onChange={(e) => { setTitle(e.target.value); setErrors(prev => ({ ...prev, title: '' })); }}
                      placeholder="Brief title for your request"
                      maxLength={100}
                      className={errors.title ? 'border-destructive' : ''}
                    />
                    {errors.title && (
                      <p className="text-sm text-destructive flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" /> {errors.title}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Description *</label>
                    <Textarea
                      value={description}
                      onChange={(e) => { setDescription(e.target.value); setErrors(prev => ({ ...prev, description: '' })); }}
                      placeholder="Describe your request in detail. Include all relevant information..."
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
                    onValueChange={(v) => { setBarangay(v); setErrors(prev => ({ ...prev, barangay: '' })); }}
                    error={errors.barangay}
                  />

                  <LocationPicker
                    latitude={latitude}
                    longitude={longitude}
                    onLocationChange={handleLocationChange}
                    locationText={location}
                    onLocationTextChange={setLocation}
                  />

                  <PhotoUpload
                    label="Attach Photo (Optional)"
                    onUpload={setPhotoUrl}
                    currentUrl={photoUrl}
                    onRemove={() => setPhotoUrl(null)}
                  />

                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Submit Request'
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </AuthGuard>
        </div>
      </div>

      <BottomNav currentPath="/services" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default RequestService;
