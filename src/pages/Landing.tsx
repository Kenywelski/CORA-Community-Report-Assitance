import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  Bell,
  ClipboardCheck,
  LogIn,
  MapPin,
  Megaphone,
  Mic,
  PlayCircle,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: AlertTriangle,
    title: "Report an Issue",
    text: "Describe a community concern, attach a photo, and pick the location. Guests can even report anonymously.",
  },
  {
    icon: Mic,
    title: "Speak Your Report",
    text: "No typing needed — talk in Filipino, English or Bisaya and CORA turns it into an editable report.",
  },
  {
    icon: Sparkles,
    title: "AI-Assisted Reporting",
    text: "The AI helper checks your report is complete, suggests the right office, and flags anything unclear for staff review.",
  },
  {
    icon: ClipboardCheck,
    title: "Track Your Reports",
    text: "Follow each report live from Submitted to Acknowledged to Resolved, with updates from the office handling it.",
  },
  {
    icon: Megaphone,
    title: "Announcements",
    text: "Official barangay announcements and community updates, posted by authorized personnel.",
  },
  {
    icon: Siren,
    title: "Emergency Contacts",
    text: "Quick access to important hotlines when every second counts.",
  },
];

const steps = [
  {
    title: "Create your account",
    text: "Tap Sign in and register with your email or Google account. Reporting works even without an account.",
  },
  {
    title: "Report the issue",
    text: "Tap the Report an Issue button, describe what happened, add a photo and confirm the location.",
  },
  {
    title: "Track the response",
    text: "Watch your report move from Submitted to Resolved under My Reports, and get notified of updates.",
  },
];

export const Landing = () => {
  const navigate = useNavigate();
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    document.title = "CORA — Community Report & Information System | Barangay Purisima, Tago";
  }, []);

  const scrollToVideo = () => {
    document.getElementById("how-it-works")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-card/90 backdrop-blur-md">
        <div className="app-container flex items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-sm font-extrabold text-primary-foreground">
              CORA
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">CORA</p>
              <p className="truncate text-[11px] text-muted-foreground">Community Report &amp; Information System</p>
            </div>
          </div>
          <Button variant="accent" size="sm" className="shrink-0 rounded-lg" onClick={() => navigate("/auth")}>
            <LogIn className="h-4 w-4" /> Sign in
          </Button>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="hero-gradient absolute inset-0" />
          <div className="relative app-container px-4 pb-10 pt-12 text-center lg:pt-16">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-semibold text-white ring-1 ring-white/25">
              <MapPin className="h-3.5 w-3.5" /> Barangay Purisima, Tago, Surigao del Sur
            </span>
            <h1 className="mx-auto mt-4 max-w-2xl text-3xl font-extrabold leading-tight text-white lg:text-5xl">
              Report community issues. Track them live. Stay informed.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-white/85 lg:text-base">
              CORA is the community report and information system of Barangay Purisima — report a concern with a photo
              or your own voice, follow its progress in real time, and keep up with official announcements.
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button variant="accent" size="lg" className="w-full sm:w-auto sm:px-8" onClick={() => navigate("/auth")}>
                <LogIn className="h-5 w-5" /> Sign in / Create account
              </Button>
              <Button
                variant="ghost"
                size="lg"
                className="w-full text-white hover:bg-white/15 hover:text-white sm:w-auto"
                onClick={scrollToVideo}
              >
                <PlayCircle className="h-5 w-5" /> Watch how it works
              </Button>
            </div>
            <p className="mt-4 text-xs text-white/70">
              No account yet? You can still report an issue anonymously and browse public updates.
            </p>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-6 rounded-t-3xl bg-background" />
        </section>

        {/* Demo video */}
        <section id="how-it-works" className="app-container scroll-mt-20 px-4 py-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-foreground lg:text-3xl">How to access and use CORA</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              A short walkthrough: creating an account, reporting an issue, and tracking it to resolution.
            </p>
          </div>
          <DemoVideo showVideo={showVideo} onPlay={() => setShowVideo(true)} />
          {/* Steps */}
          <ol className="mx-auto mt-8 grid max-w-3xl gap-4 sm:grid-cols-3">
            {steps.map((step, i) => (
              <li key={step.title} className="service-card text-left">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {i + 1}
                </span>
                <h3 className="mt-3 text-sm font-bold text-foreground">{step.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 text-center">
            <Button variant="accent" size="lg" className="px-8" onClick={() => navigate("/auth")}>
              <LogIn className="h-5 w-5" /> Get started — Sign in
            </Button>
          </div>
        </section>

        {/* Features */}
        <section className="app-container px-4 pb-10">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-bold text-foreground lg:text-3xl">What CORA can do</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything residents need to report concerns and stay connected with the barangay.
            </p>
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div key={f.title} className="service-card text-left">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-secondary">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground">{f.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{f.text}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Community strip */}
        <section className="app-container px-4 pb-12">
          <div className="grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => navigate("/updates")}
              className="service-card flex items-center gap-4 text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary">
                <Bell className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Browse announcements</p>
                <p className="text-xs text-muted-foreground">Public community updates — open to everyone.</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => navigate("/emergency")}
              className="service-card flex items-center gap-4 text-left"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emergency">
                <Siren className="h-6 w-6 text-emergency-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Emergency contacts</p>
                <p className="text-xs text-muted-foreground">Important hotlines, ready when you need them.</p>
              </div>
            </button>
          </div>
        </section>

        {/* Closing note */}
        <section className="app-container px-4 pb-12">
          <div className="mx-auto max-w-2xl rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-secondary">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <h2 className="mt-3 text-lg font-bold text-foreground">Built for the community</h2>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              CORA helps residents of Barangay Purisima report concerns and access barangay information in one place.
              AI features are assistive only — every report is reviewed and acted on by authorized municipal
              personnel.
            </p>
            <Button variant="accent" className="mt-4" onClick={() => navigate("/auth")}>
              <ShieldCheck className="h-4 w-4" /> Sign in to get started
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card py-6">
        <div className="app-container px-4 text-center">
          <p className="text-xs font-semibold text-foreground">CORA — Community Report &amp; Information System</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Barangay Purisima, Tago, Surigao del Sur, Philippines</p>
        </div>
      </footer>
    </div>
  );
};

/** Demo tutorial video player. Renders a poster card until the video is loaded in. */
const DemoVideo = ({ showVideo, onPlay }: { showVideo: boolean; onPlay: () => void }) => {
  return (
    <div
      className={cn(
        "relative mx-auto mt-6 max-w-3xl overflow-hidden rounded-2xl border border-border bg-card shadow-lg",
      )}
    >
      {showVideo ? (
        <video className="aspect-video w-full bg-foreground" controls autoPlay playsInline preload="metadata" />
      ) : (
        <button
          type="button"
          onClick={onPlay}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-secondary"
          aria-label="Play the demo tutorial video"
        >
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary shadow-lg transition-transform group-hover:scale-105">
            <PlayCircle className="h-9 w-9 text-primary-foreground" />
          </span>
          <span className="text-sm font-semibold text-primary">Play the demo tutorial</span>
          <span className="text-xs text-muted-foreground">Video demo — how to access and use CORA</span>
        </button>
      )}
    </div>
  );
};

export default Landing;
