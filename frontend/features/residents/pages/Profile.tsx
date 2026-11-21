import { useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  ChevronRight,
  Edit2,
  Loader2,
  LogOut,
  Mail,
  MapPin,
  Phone,
  Save,
  Settings,
  Shield,
  Siren,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/features/auth/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface ProfileData {
  full_name: string | null;
  phone: string | null;
  address: string | null;
  barangay: string | null;
  avatar_url: string | null;
}

type EditableProfileField = 'full_name' | 'phone' | 'address' | 'barangay';

interface ProfileRowProps {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
  editing?: boolean;
  placeholder?: string;
  onChange?: (value: string) => void;
}

const ProfileRow = ({
  icon: Icon,
  label,
  value,
  editing = false,
  placeholder,
  onChange,
}: ProfileRowProps) => (
  <div className="flex min-h-[68px] items-center gap-3 px-4 py-3 sm:px-5">
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
      <Icon className="h-4 w-4" />
    </span>
    <div className="min-w-0 flex-1">
      <p className="text-[10px] font-semibold leading-none text-muted-foreground">{label}</p>
      {editing ? (
        <Input
          value={value || ''}
          onChange={(event) => onChange?.(event.target.value)}
          placeholder={placeholder}
          className="mt-1.5 h-8 rounded-lg px-2.5 text-xs"
        />
      ) : (
        <p className="mt-1 truncate text-[13px] font-semibold leading-snug text-foreground">
          {value || 'Not set'}
        </p>
      )}
    </div>
  </div>
);

interface MobileProfileMenuRowProps {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}

const MobileProfileMenuRow = ({ icon: Icon, label, onClick }: MobileProfileMenuRowProps) => (
  <button
    type="button"
    onClick={onClick}
    className="group flex h-11 w-full items-center gap-3 px-3 text-left text-xs font-semibold text-foreground transition-colors hover:bg-primary/[0.035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
  >
    <Icon className="h-4 w-4 shrink-0 text-primary" strokeWidth={1.9} />
    <span className="min-w-0 flex-1 truncate">{label}</span>
    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70 transition-transform group-hover:translate-x-0.5" />
  </button>
);

const Profile = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isAdmin, signOut } = useAuth();
  const mobileView =
    location.state !== null &&
    typeof location.state === 'object' &&
    'profileView' in location.state &&
    location.state.profileView === 'information'
      ? 'information'
      : 'menu';
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedProfile, setEditedProfile] = useState<ProfileData | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!error && data) {
      setProfile(data);
      setEditedProfile(data);
    }
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (user) {
      void fetchProfile();
    }
  }, [authLoading, fetchProfile, navigate, user]);

  const updateEditedField = (field: EditableProfileField, value: string) => {
    setEditedProfile((current) => current ? { ...current, [field]: value } : current);
  };

  const cancelEditing = () => {
    setEditedProfile(profile);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!user || !editedProfile) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: editedProfile.full_name,
        phone: editedProfile.phone,
        address: editedProfile.address,
        barangay: editedProfile.barangay,
      })
      .eq('user_id', user.id);

    if (error) {
      toast.error('Failed to update profile');
    } else {
      setProfile(editedProfile);
      setIsEditing(false);
      toast.success('Profile updated successfully');
    }
    setIsSaving(false);
  };

  if (authLoading || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const displayName =
    profile?.full_name ||
    (user.user_metadata?.full_name as string | undefined) ||
    user.email?.split('@')[0] ||
    'CORA Resident';
  const residentBarangay = profile?.barangay || 'Barangay Purisima';

  const handleProfileLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <main className="app-container px-4 pb-4 pt-5 lg:pt-6">
        {mobileView === 'menu' && (
          <div className="lg:hidden">
            <h1 className="text-center text-lg font-extrabold tracking-tight text-foreground">My Profile</h1>

            <section className="relative mt-4 overflow-hidden rounded-2xl border border-border/45 bg-card px-4 py-3.5 shadow-[0_6px_18px_rgba(15,23,42,0.07)]">
              <div aria-hidden="true" className="absolute -bottom-9 right-[-4%] h-16 w-28 rotate-[-10deg] rounded-[50%] bg-primary/10" />
              <div aria-hidden="true" className="absolute -bottom-9 right-[12%] h-14 w-20 rotate-[-16deg] rounded-[50%] bg-emerald-400/15" />

              <div className="relative flex items-center gap-3">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/15 text-primary ring-1 ring-primary/20">
                  {profile?.avatar_url ? (
                    <img src={profile.avatar_url} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <UserRound className="h-7 w-7" strokeWidth={1.7} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold leading-tight text-foreground">{displayName}</p>
                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Resident</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0 text-primary" />
                    <span className="truncate">{residentBarangay}</span>
                  </p>
                </div>
              </div>
            </section>

            <section className="mt-4">
              <h2 className="px-1 pb-1.5 text-[10px] font-bold text-muted-foreground">Account</h2>
              <div className="divide-y divide-border/45 overflow-hidden rounded-2xl border border-border/40 bg-card shadow-[0_5px_16px_rgba(15,23,42,0.055)]">
                <MobileProfileMenuRow
                  icon={UserRound}
                  label="Profile Information"
                  onClick={() => {
                    navigate(location.pathname, {
                      state: { profileView: 'information' },
                    });
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                />
                <MobileProfileMenuRow icon={Settings} label="Settings" onClick={() => navigate('/settings')} />
              </div>
            </section>

            <section className="mt-4">
              <h2 className="px-1 pb-1.5 text-[10px] font-bold text-muted-foreground">Barangay Information</h2>
              <div className="divide-y divide-border/45 overflow-hidden rounded-2xl border border-border/40 bg-card shadow-[0_5px_16px_rgba(15,23,42,0.055)]">
                <MobileProfileMenuRow icon={Siren} label="Emergency Contacts" onClick={() => navigate('/emergency')} />
                <MobileProfileMenuRow icon={MapPin} label="Barangay Directory" onClick={() => navigate('/directory')} />
                <MobileProfileMenuRow icon={CalendarDays} label="Barangay Programs" onClick={() => navigate('/programs')} />
              </div>
            </section>

            <button
              type="button"
              onClick={handleProfileLogout}
              className="mt-4 flex h-11 w-full items-center gap-3 rounded-2xl border border-red-100 bg-red-50/80 px-3 text-left text-xs font-semibold text-red-600 shadow-[0_5px_16px_rgba(15,23,42,0.045)] transition-colors hover:bg-red-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 dark:border-red-950/50 dark:bg-red-950/20"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        )}

        <div className={cn(mobileView === 'menu' ? 'hidden lg:block' : 'block')}>

        {mobileView === 'information' && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mb-3 h-9 rounded-full px-3 text-xs font-semibold lg:hidden"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" />
            Back to My Profile
          </Button>
        )}

        <ResidentPageHeader
          title="My Profile"
          subtitle="View and manage your personal information."
          className="mb-5 lg:mb-6"
        />

        <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-[0_8px_24px_rgba(15,23,42,0.07)]">
          <div className="flex min-h-14 items-center justify-end border-b border-border/50 px-4 sm:px-5">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  <X className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="h-8 rounded-full px-3 text-xs"
                >
                  {isSaving ? (
                    <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="mr-1 h-3.5 w-3.5" />
                  )}
                  Save
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="admin-action-edit h-8 rounded-full px-3 text-xs font-semibold"
              >
                <Edit2 className="mr-1 h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </div>

          <div className="divide-y divide-border/50">
            <ProfileRow
              icon={UserRound}
              label="Full Name"
              value={editedProfile?.full_name}
              editing={isEditing}
              placeholder="Enter your full name"
              onChange={(value) => updateEditedField('full_name', value)}
            />
            <ProfileRow icon={Mail} label="Email" value={user.email} />
            <ProfileRow
              icon={Phone}
              label="Phone"
              value={editedProfile?.phone}
              editing={isEditing}
              placeholder="Enter your phone number"
              onChange={(value) => updateEditedField('phone', value)}
            />
            <ProfileRow
              icon={MapPin}
              label="Address"
              value={editedProfile?.address}
              editing={isEditing}
              placeholder="Enter your address"
              onChange={(value) => updateEditedField('address', value)}
            />
            <ProfileRow
              icon={Building2}
              label="Barangay"
              value={editedProfile?.barangay}
              editing={isEditing}
              placeholder="Enter your barangay"
              onChange={(value) => updateEditedField('barangay', value)}
            />
          </div>
        </section>

        {isAdmin && (
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/admin')}
            className="mt-4 w-full rounded-xl sm:w-auto"
          >
            <Shield className="mr-2 h-4 w-4" />
            Admin Dashboard
          </Button>
        )}
        </div>
      </main>

      <BottomNav currentPath="/profile" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default Profile;
