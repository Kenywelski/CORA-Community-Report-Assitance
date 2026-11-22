import { useNavigate } from 'react-router-dom';
import { AppSettingsCard } from '@/features/residents/components/AppSettingsCard';
import { AuthGuard } from '@/features/residents/components/AuthGuard';
import { BottomNav } from '@/features/residents/components/BottomNav';
import { ResidentMobileBackHeader } from '@/features/residents/components/ResidentMobileBackHeader';
import { ResidentPageHeader } from '@/features/residents/components/ResidentPageHeader';

const Settings = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-24 lg:pb-10">
      <main className="app-container px-4 pb-4 pt-5 lg:pt-6">
        <ResidentMobileBackHeader title="Settings" onBack={() => navigate(-1)} />
        <div className="hidden lg:block">
          <ResidentPageHeader
            title="Settings"
            subtitle="Manage your app language, theme, and display preferences."
            className="mb-5 lg:mb-6"
          />
        </div>

        <AuthGuard fallback="redirect">
          <AppSettingsCard />
        </AuthGuard>
      </main>

      <BottomNav currentPath="/settings" onNavigate={(path) => navigate(path)} />
    </div>
  );
};

export default Settings;
