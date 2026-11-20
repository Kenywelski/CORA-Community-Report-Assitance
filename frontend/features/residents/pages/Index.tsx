import { HeroHeader } from "@/features/residents/components/HeroHeader";
import { ReportStats, RequestStatusCard } from "@/features/residents/components/RequestStatusCard";
import { AnnouncementsFeed } from "@/features/residents/components/AnnouncementsFeed";
import { BottomNav } from "@/features/residents/components/BottomNav";

const Index = () => {
  return (
    <div className="min-h-screen bg-background lg:pt-14">
      <div className="app-container px-4 pb-24 lg:pb-10">
        <HeroHeader />

        <main className="space-y-6 pb-2">
          <ReportStats />

          <div className="grid gap-6 lg:grid-cols-[1.08fr_0.92fr]">
            <RequestStatusCard />
            <AnnouncementsFeed />
          </div>
        </main>
      </div>

      <BottomNav />
    </div>
  );
};

export default Index;
