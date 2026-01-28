import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ArrowLeft, Plus, Edit2, Trash2, Save, X, Loader2, MapPin, Image as ImageIcon } from 'lucide-react';
import { PhotoUpload } from '@/components/PhotoUpload';
import type { Tables } from '@/integrations/supabase/types';

type TouristSpot = Tables<'tourist_spots'>;

const MUNICIPALITIES = [
  'Cortes',
  'Barobo',
  'Bislig City',
  'Cagwait',
  'Cantilan',
  'Carmen',
  'Carrascal',
  'Hinatuan',
  'Lanuza',
  'Lianga',
  'Lingig',
  'Madrid',
  'Marihatag',
  'San Agustin',
  'San Miguel',
  'Tagbina',
  'Tago',
  'Tandag City',
];

const AdminTouristSpots = () => {
  const navigate = useNavigate();
  const { user, isAdmin, isLoading: authLoading } = useAuth();
  const [spots, setSpots] = useState<TouristSpot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingSpot, setEditingSpot] = useState<Partial<TouristSpot> | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('Access denied');
    } else if (isAdmin) {
      fetchSpots();
    }
  }, [user, isAdmin, authLoading, navigate]);

  const fetchSpots = async () => {
    const { data } = await supabase
      .from('tourist_spots')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (data) setSpots(data);
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!editingSpot?.title || !editingSpot?.description) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSaving(true);

    if (isCreating) {
      const { error } = await supabase.from('tourist_spots').insert({
        title: editingSpot.title,
        description: editingSpot.description,
        municipality: editingSpot.municipality || null,
        location: editingSpot.location || null,
        images: editingSpot.images || [],
        is_active: editingSpot.is_active ?? true,
        created_by: user?.id,
      });

      if (error) {
        toast.error('Failed to create tourist spot');
      } else {
        toast.success('Tourist spot created');
        setEditingSpot(null);
        setIsCreating(false);
        fetchSpots();
      }
    } else {
      const { error } = await supabase
        .from('tourist_spots')
        .update({
          title: editingSpot.title,
          description: editingSpot.description,
          municipality: editingSpot.municipality,
          location: editingSpot.location,
          images: editingSpot.images,
          is_active: editingSpot.is_active,
        })
        .eq('id', editingSpot.id!);

      if (error) {
        toast.error('Failed to update tourist spot');
      } else {
        toast.success('Tourist spot updated');
        setEditingSpot(null);
        fetchSpots();
      }
    }

    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this tourist spot?')) return;

    const { error } = await supabase.from('tourist_spots').delete().eq('id', id);

    if (error) {
      toast.error('Failed to delete tourist spot');
    } else {
      toast.success('Tourist spot deleted');
      fetchSpots();
    }
  };

  const handleImageUpload = (url: string) => {
    setEditingSpot(prev => ({
      ...prev,
      images: [...(prev?.images || []), url],
    }));
  };

  const removeImage = (index: number) => {
    setEditingSpot(prev => ({
      ...prev,
      images: prev?.images?.filter((_, i) => i !== index) || [],
    }));
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="app-container">
        {/* Header */}
        <div className="hero-gradient px-4 pt-12 pb-8">
          <button
            onClick={() => navigate('/admin')}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-6"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back to Admin</span>
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-white text-xl font-bold">Tourist Spots</h1>
                <p className="text-white/70 text-sm">Manage destinations</p>
              </div>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditingSpot({ is_active: true, images: [] });
                setIsCreating(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        <div className="h-6 bg-background rounded-t-3xl -mt-6 relative z-10" />

        {/* Edit/Create Form */}
        {editingSpot && (
          <div className="px-4 mb-4">
            <Card variant="elevated">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">
                  {isCreating ? 'Add Tourist Spot' : 'Edit Tourist Spot'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Title *</label>
                  <Input
                    value={editingSpot.title || ''}
                    onChange={(e) => setEditingSpot(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Tourist spot name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Municipality</label>
                  <select
                    value={editingSpot.municipality || ''}
                    onChange={(e) => setEditingSpot(prev => ({ ...prev, municipality: e.target.value }))}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select municipality</option>
                    {MUNICIPALITIES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Location Details</label>
                  <Input
                    value={editingSpot.location || ''}
                    onChange={(e) => setEditingSpot(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g., Barangay Name, near landmark"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Description *</label>
                  <Textarea
                    value={editingSpot.description || ''}
                    onChange={(e) => setEditingSpot(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Describe this tourist spot..."
                    rows={4}
                  />
                </div>

                <PhotoUpload
                  label="Add Images"
                  onUpload={handleImageUpload}
                />

                {editingSpot.images && editingSpot.images.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {editingSpot.images.map((img, idx) => (
                      <div key={idx} className="relative">
                        <img src={img} alt="" className="w-full h-20 object-cover rounded-lg" />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={editingSpot.is_active ?? true}
                      onCheckedChange={(checked) => setEditingSpot(prev => ({ ...prev, is_active: checked }))}
                    />
                    <span className="text-sm">Active (visible to users)</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setEditingSpot(null);
                      setIsCreating(false);
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Cancel
                  </Button>
                  <Button className="flex-1" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-1" />
                        Save
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* List */}
        <div className="px-4 space-y-3">
          {spots.map((spot) => (
            <Card key={spot.id} variant="elevated" className="overflow-hidden">
              <div className="flex">
                <div className="w-24 h-24 flex-shrink-0">
                  {spot.images && spot.images.length > 0 ? (
                    <img src={spot.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-muted flex items-center justify-center">
                      <ImageIcon className="h-6 w-6 text-muted-foreground" />
                    </div>
                  )}
                </div>
                <CardContent className="flex-1 p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-medium text-sm">{spot.title}</h3>
                      <p className="text-xs text-muted-foreground">{spot.municipality}</p>
                      <span className={`text-xs ${spot.is_active ? 'text-success' : 'text-muted-foreground'}`}>
                        {spot.is_active ? '● Active' : '○ Hidden'}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setEditingSpot(spot)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => handleDelete(spot.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminTouristSpots;
