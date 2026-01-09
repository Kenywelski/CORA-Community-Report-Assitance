import { EmergencyBanner } from "@/components/EmergencyBanner";
import { HeroHeader } from "@/components/HeroHeader";
import { QuickServices } from "@/components/QuickServices";
import { RequestStatusCard } from "@/components/RequestStatusCard";
import { AnnouncementsFeed } from "@/components/AnnouncementsFeed";
import { BottomNav } from "@/components/BottomNav";
import { useState } from "react";

const Index = () => {
  const [showEmergency, setShowEmergency] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <div className="app-container pb-24">
        {/* Emergency Banner */}
        {showEmergency && (
          <EmergencyBanner
            title="Weather Advisory"
            message="PAGASA has issued a rainfall advisory for Surigao del Sur. Stay safe and avoid low-lying areas."
            onDismiss={() => setShowEmergency(false)}
          />
        )}

        {/* Hero Header */}
        <HeroHeader />

        {/* Main Content */}
        <main className="space-y-6 pt-2">
          {/* Quick Services Grid */}
          <QuickServices />

          {/* Request Status */}
          <RequestStatusCard />

          {/* Announcements */}
          <AnnouncementsFeed />
        </main>
      </div>

      {/* Bottom Navigation - Full width */}
      <BottomNav />
    </div>
  );
};

export default Index;
