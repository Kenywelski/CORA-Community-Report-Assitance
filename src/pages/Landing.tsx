import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Anchor,
  ArrowRight,
  Bell,
  Building,
  Calendar,
  Camera,
  ClipboardCheck,
  Clock,
  CloudRain,
  Construction,
  Flame,
  HeartPulse,
  Lightbulb,
  LogIn,
  MapPin,
  Megaphone,
  Menu,
  Phone,
  PlayCircle,
  Shield,
  Siren,
  Trash2,
  UserPlus,
  Users,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { BarangayPurisimaMap } from "@/components/BarangayPurisimaMap";
import { AnnouncementDetailDialog } from "@/components/AnnouncementDetailDialog";
import { LandingFaqChatbot } from "@/components/LandingFaqChatbot";

interface Announcement {
  id: string;
  title: string;
  content: string;
  excerpt: string | null;
  type: "general" | "urgent" | "event";
  published_at: string;
  image_url: string | null;
}

interface EmergencyContact {
  id: string;
  department_name: string;
  service_type: string;
  contact_number: string;
  address: string | null;
  availability: string;
}

interface ProgramItem {
  id: string;
  title: string;
  category: string;
  content: string;
  tags: string[] | null;
}

const steps = [
  {
    number: "Step 1",
    icon: UserPlus,
    title: "Create an account or sign in",
    text: "Register with your email address or sign in to access your resident reporting account.",
  },
  {
    number: "Step 2",
    icon: Camera,
    title: "Capture and submit a community concern",
    text: "Select the concern category, attach a photo, pin the location in Barangay Purisima, and submit your report.",
  },
  {
    number: "Step 3",
    icon: ClipboardCheck,
    title: "Monitor the report's status",
    text: "View the current status of your submitted report from your account dashboard as it is reviewed.",
  },
  {
    number: "Step 4",
    icon: Bell,
    title: "Receive updates as barangay personnel process the concern",
    text: "Stay informed with status changes and official remarks posted by authorized personnel handling your report.",
  },
];

const concernCategories = [
  {
    icon: Trash2,
    title: "Improper Waste Disposal",
    text: "Report uncollected household waste, illegal dumping, or litter accumulation in public areas and roadsides.",
  },
  {
    icon: Lightbulb,
    title: "Streetlight Problem",
    text: "Report non-functioning, flickering, or damaged streetlights affecting nighttime visibility and safety.",
  },
  {
    icon: CloudRain,
    title: "Drainage/Flooding Concern",
    text: "Report clogged canals, blocked drainage waterways, or localized water accumulation in the barangay.",
  },
  {
    icon: Construction,
    title: "Road Damage",
    text: "Report potholes, cracked concrete pavement, or damaged public pathways requiring maintenance.",
  },
];

const announcementTypeConfig = {
  general: {
    icon: Megaphone,
    badgeClass: "text-[#177A73] bg-[#EAF6F4]",
    label: "General",
  },
  urgent: {
    icon: AlertTriangle,
    badgeClass: "text-[#F36B3F] bg-[#F36B3F]/10",
    label: "Urgent",
  },
  event: {
    icon: Calendar,
    badgeClass: "text-[#177A73] bg-[#EAF6F4]",
    label: "Event",
  },
};

const emergencyTypeIcon: Record<string, typeof Siren> = {
  Police: Shield,
  Fire: Flame,
  "Disaster/Rescue": AlertTriangle,
  "Health/Hospital": HeartPulse,
  Maritime: Anchor,
  Government: Building,
  Barangay: Building,
};

const CORA_LOGO_URL = "/assets/aistudio/3d37efc1-7635-48f1-b2ad-74baa90bab76_7adcf976.png";

export const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [faqChatOpen, setFaqChatOpen] = useState(false);

  useEffect(() => {
    document.title = "CORA — Barangay Purisima | Community Reporting System";
  }, []);

  // Fetch official announcements from existing admin-managed database
  const { data: announcements = [], isLoading: loadingAnnouncements } = useQuery({
    queryKey: ["landing-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) return [];
      return (data ?? []) as Announcement[];
    },
    staleTime: 1000 * 60 * 2,
  });

  // Fetch barangay programs from existing admin-managed database
  const { data: programs = [], isLoading: loadingPrograms } = useQuery({
    queryKey: ["landing-programs"],
    queryFn: async (): Promise<ProgramItem[]> => {
      const { data, error } = await supabase
        .from("municipal_knowledge")
        .select("id, title, category, content, tags")
        .eq("is_active", true)
        .ilike("category", "%program%")
        .order("title", { ascending: true })
        .limit(6);
      if (error) return [];
      return (data ?? []) as ProgramItem[];
    },
    staleTime: 1000 * 60 * 5,
  });

  // Fetch verified emergency contacts from existing admin-managed database
  const { data: emergencyContacts = [], isLoading: loadingContacts } = useQuery({
    queryKey: ["landing-emergency-contacts"],
    queryFn: async (): Promise<EmergencyContact[]> => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(6);
      if (error) return [];
      return (data ?? []) as EmergencyContact[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const handleReportConcern = () => {
    if (user) {
      navigate("/report-issue");
    } else {
      navigate("/auth");
    }
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    if (id === "faqs") {
      setFaqChatOpen(true);
      return;
    }
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const navItems = [
    { label: "Home", id: "home" },
    { label: "About", id: "how-it-works" },
    { label: "Announcements", id: "announcements" },
    { label: "Programs", id: "programs" },
    { label: "Emergency Contacts", id: "emergency-contacts" },
    { label: "FAQs", id: "faqs" },
  ];

  const primaryBarangayContact = emergencyContacts.find(
    (c) =>
      c.service_type?.toLowerCase().includes("barangay") ||
      c.department_name?.toLowerCase().includes("purisima")
  );

  return (
    <div id="home" className="min-h-screen bg-[#F8FAFC] text-[#142B38]">
      {/* Sticky White Header & Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
          {/* Left: CORA Brand Identity */}
          <button
            type="button"
            onClick={() => scrollToSection("home")}
            className="flex min-w-0 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2 rounded-xl"
          >
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-slate-200/80">
              <img
                src={CORA_LOGO_URL}
                alt="CORA Logo"
                className="h-full w-full scale-[1.18] object-cover"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-bold leading-tight text-[#142B38]">
                CORA
              </p>
              <p className="truncate text-xs font-medium text-[#64748B]">
                Barangay Purisima | Community Reporting System
              </p>
            </div>
          </button>

          {/* Desktop Navigation Links + Sign In */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-5 xl:gap-6 lg:flex"
          >
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => scrollToSection(item.id)}
                className="whitespace-nowrap text-sm font-medium text-[#142B38]/85 transition-colors hover:text-[#177A73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2 rounded-md px-1 py-0.5"
              >
                {item.label}
              </button>
            ))}
            <Button
              type="button"
              onClick={() => navigate("/auth")}
              className="h-10 shrink-0 gap-2 rounded-xl bg-[#F36B3F] px-4 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-[#dc5a30] focus-visible:ring-[#F36B3F]"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign In</span>
            </Button>
          </nav>

          {/* Mobile Hamburger Menu Button */}
          <div className="flex items-center lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#142B38] transition-colors hover:bg-[#EAF6F4] hover:text-[#177A73] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73]"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Collapsible Navigation Drawer */}
        {mobileMenuOpen && (
          <nav
            id="mobile-navigation-menu"
            aria-label="Mobile navigation"
            className="border-t border-slate-200 bg-white px-4 pb-5 pt-3 shadow-lg lg:hidden"
          >
            <div className="flex flex-col space-y-1">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-[#142B38] transition-colors hover:bg-[#EAF6F4] hover:text-[#177A73]"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="h-4 w-4 text-[#64748B]" />
                </button>
              ))}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate("/auth");
                  }}
                  className="h-11 w-full gap-2 rounded-xl bg-[#F36B3F] text-sm font-semibold text-white shadow-sm hover:bg-[#dc5a30]"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Sign In</span>
                </Button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* Centered Teal Hero Section */}
        <section className="relative overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(180deg, #142B38 0%, #177A73 58%, #1d8a82 100%)",
            }}
          />
          <div className="relative mx-auto max-w-4xl px-4 pb-16 pt-12 text-center sm:px-6 sm:pb-20 sm:pt-16 lg:pt-20">
            {/* Small Location Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold text-white ring-1 ring-white/25">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#EAF6F4]" />
              <span>Barangay Purisima, Tago, Surigao del Sur</span>
            </div>

            {/* Main Headline */}
            <h1 className="mx-auto mt-5 max-w-2xl text-balance text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl">
              A Smarter Way to Report Community Concerns
            </h1>

            {/* Supporting Description */}
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/90 sm:text-base">
              CORA connects residents and barangay officials through a centralized platform for reporting community concerns, monitoring their status, and accessing important barangay information.
            </p>

            {/* Primary & Secondary Call-to-Action Buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
              <Button
                type="button"
                size="lg"
                onClick={handleReportConcern}
                className="h-12 w-full gap-2 rounded-xl bg-[#F36B3F] px-7 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#dc5a30] focus-visible:ring-white sm:w-auto"
              >
                <span>Report a Concern</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => scrollToSection("how-it-works")}
                className="h-12 w-full rounded-xl border border-white/30 bg-white/10 px-7 text-sm font-semibold text-white transition-colors hover:bg-white/20 hover:text-white focus-visible:ring-white sm:w-auto"
              >
                <span>How CORA Works</span>
              </Button>
            </div>

            {/* Accurate Account & Public Information Note */}
            <p className="mx-auto mt-5 max-w-xl text-xs leading-relaxed text-white/80">
              New to CORA? Create an account to submit and track community concerns. Public barangay information is available to everyone.
            </p>
          </div>

          {/* Rounded Transition Between Hero and Next Section */}
          <div className="absolute bottom-0 left-0 right-0 h-6 rounded-t-3xl bg-[#F8FAFC]" />
        </section>

        {/* How CORA Works Section */}
        <section
          id="how-it-works"
          aria-labelledby="how-it-works-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:px-6 lg:px-8 lg:py-16"
        >
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
              Platform Workflow
            </p>
            <h2
              id="how-it-works-heading"
              className="mt-2 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
            >
              How CORA Works
            </h2>
            <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] sm:text-base">
              A structured four-step process for reporting local issues and following up on barangay action.
            </p>
          </div>

          {/* 4 Step Cards */}
          <ol className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <li
                  key={step.number}
                  className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-colors hover:border-[#177A73]/40"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#177A73]">
                      {step.number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-bold leading-snug text-[#142B38]">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                    {step.text}
                  </p>
                </li>
              );
            })}
          </ol>

          {/* Optional Walkthrough Video */}
          <DemoVideo showVideo={showVideo} onPlay={() => setShowVideo(true)} />
        </section>

        {/* Community Concerns Section */}
        <section
          id="community-concerns"
          aria-labelledby="community-concerns-heading"
          className="border-y border-slate-200/80 bg-white py-14 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
                Supported Categories
              </p>
              <h2
                id="community-concerns-heading"
                className="mt-2 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
              >
                Community Concerns
              </h2>
              <p className="mt-2.5 text-sm leading-relaxed text-[#64748B] sm:text-base">
                Residents can submit reports under these core barangay concern categories for review by local officials.
              </p>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {concernCategories.map((cat) => {
                const Icon = cat.icon;
                return (
                  <div
                    key={cat.title}
                    className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6 transition-colors hover:border-[#177A73]/40 hover:bg-white"
                  >
                    <div>
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="mt-4 text-base font-bold text-[#142B38]">
                        {cat.title}
                      </h3>
                      <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                        {cat.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 text-center">
              <Button
                type="button"
                onClick={handleReportConcern}
                className="h-11 gap-2 rounded-xl bg-[#F36B3F] px-6 text-sm font-semibold text-white shadow-sm hover:bg-[#dc5a30]"
              >
                <span>Submit a Community Concern</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </section>

        {/* Official Announcements Section */}
        <section
          id="announcements"
          aria-labelledby="announcements-heading"
          className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14 sm:px-6 lg:px-8 lg:py-16"
        >
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
                Public Advisories
              </p>
              <h2
                id="announcements-heading"
                className="mt-1.5 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
              >
                Official Announcements
              </h2>
              <p className="mt-1.5 text-sm text-[#64748B]">
                Verified notices and advisories published by Barangay Purisima personnel.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/updates")}
              className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73]"
            >
              <span>View All Announcements</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-8">
            {loadingAnnouncements ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
              </div>
            ) : announcements.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                  <Megaphone className="h-6 w-6" />
                </div>
                <h3 className="mt-3 text-base font-bold text-[#142B38]">
                  No official announcements published yet
                </h3>
                <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#64748B] sm:text-sm">
                  Official barangay notices and community updates will appear here as soon as they are posted by authorized personnel.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
                {announcements.map((a) => {
                  const cfg = announcementTypeConfig[a.type] ?? announcementTypeConfig.general;
                  const Icon = cfg.icon;
                  return (
                    <article
                      key={a.id}
                      onClick={() => {
                        setSelectedAnnouncement(a);
                        setIsDetailOpen(true);
                      }}
                      className="group flex cursor-pointer flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:border-[#177A73]/50"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2 text-xs text-[#64748B]">
                          <span className="inline-flex items-center gap-1.5 font-semibold text-[#177A73]">
                            <Icon className="h-3.5 w-3.5" />
                            <span>{cfg.label}</span>
                          </span>
                          <span aria-hidden="true">·</span>
                          <time dateTime={a.published_at} className="tabular-nums">
                            {format(new Date(a.published_at), "MMM d, yyyy")}
                          </time>
                        </div>
                        {a.image_url && (
                          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
                            <img
                              src={a.image_url}
                              alt={a.title}
                              referrerPolicy="no-referrer"
                              className="h-36 w-full object-cover"
                            />
                          </div>
                        )}
                        <h3 className="mt-3 text-base font-bold leading-snug text-[#142B38] group-hover:text-[#177A73]">
                          {a.title}
                        </h3>
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                          {a.excerpt || a.content}
                        </p>
                      </div>
                      <div className="mt-4 flex items-center gap-1 text-xs font-semibold text-[#177A73]">
                        <span>Read announcement</span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        {/* Barangay Programs Section */}
        <section
          id="programs"
          aria-labelledby="programs-heading"
          className="border-y border-slate-200/80 bg-white scroll-mt-20 py-14 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">
                  Community Initiatives
                </p>
                <h2
                  id="programs-heading"
                  className="mt-1.5 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
                >
                  Barangay Programs
                </h2>
                <p className="mt-1.5 text-sm text-[#64748B]">
                  Official programs and services recorded for residents of Barangay Purisima.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/programs")}
                className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73]"
              >
                <span>View Programs Page</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-8">
              {loadingPrograms ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
                </div>
              ) : programs.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                    <Users className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#142B38]">
                    No verified barangay programs listed yet
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#64748B] sm:text-sm">
                    Active community programs for Barangay Purisima will be displayed here once added by barangay administrators.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                  {programs.map((prog) => (
                    <div
                      key={prog.id}
                      className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-6"
                    >
                      <div>
                        <p className="text-xs font-semibold text-[#177A73]">
                          {prog.category}
                        </p>
                        <h3 className="mt-1.5 text-base font-bold text-[#142B38]">
                          {prog.title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                          {prog.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Interactive Barangay Map Section */}
        <BarangayPurisimaMap />

        {/* Emergency Contacts Section */}
        <section
          id="emergency-contacts"
          aria-labelledby="emergency-contacts-heading"
          className="border-t border-slate-200/80 bg-white scroll-mt-20 py-14 lg:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#F36B3F]">
                  Public Safety &amp; Response
                </p>
                <h2
                  id="emergency-contacts-heading"
                  className="mt-1.5 text-2xl font-bold tracking-tight text-[#142B38] sm:text-3xl"
                >
                  Emergency Contacts
                </h2>
                <p className="mt-1.5 text-sm text-[#64748B]">
                  Verified emergency and response hotlines serving Barangay Purisima, Tago.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/emergency")}
                className="h-10 shrink-0 gap-1.5 rounded-xl border-slate-200 bg-white text-xs font-semibold text-[#142B38] hover:bg-[#EAF6F4] hover:text-[#177A73]"
              >
                <span>Open Full Emergency Directory</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="mt-8">
              {loadingContacts ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
                </div>
              ) : emergencyContacts.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#F36B3F]/10 text-[#F36B3F]">
                    <Siren className="h-6 w-6" />
                  </div>
                  <h3 className="mt-3 text-base font-bold text-[#142B38]">
                    No emergency contacts available
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-[#64748B] sm:text-sm">
                    Verified emergency hotline records will appear here once published in the barangay directory.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {emergencyContacts.map((c) => {
                    const Icon = emergencyTypeIcon[c.service_type] || Siren;
                    return (
                      <div
                        key={c.id}
                        className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-[#F8FAFC] p-5 shadow-sm transition-colors hover:border-[#177A73]/40 hover:bg-white"
                      >
                        <div>
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EAF6F4] text-[#177A73]">
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-medium text-[#64748B]">
                                {c.service_type}
                              </p>
                              <h3 className="mt-0.5 text-base font-bold leading-snug text-[#142B38]">
                                {c.department_name}
                              </h3>
                            </div>
                          </div>

                          <div className="mt-4 space-y-1.5 text-xs text-[#64748B]">
                            {c.address && (
                              <p className="flex items-start gap-2">
                                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#177A73]" />
                                <span>{c.address}</span>
                              </p>
                            )}
                            {c.availability && (
                              <p className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 shrink-0 text-[#177A73]" />
                                <span>{c.availability}</span>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 pt-2">
                          <a
                            href={`tel:${c.contact_number.replace(/[^0-9+]/g, "")}`}
                            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 font-mono text-xs font-semibold tabular-nums text-[#142B38] transition-colors hover:border-[#177A73] hover:bg-[#EAF6F4] hover:text-[#177A73]"
                          >
                            <Phone className="h-3.5 w-3.5 text-[#177A73]" />
                            <span>{c.contact_number}</span>
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-[#142B38] text-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-8 md:grid-cols-12">
            {/* Brand & Barangay Identification */}
            <div className="md:col-span-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-white/20">
                  <img
                    src={CORA_LOGO_URL}
                    alt="CORA Logo"
                    className="h-full w-full scale-[1.18] object-cover"
                  />
                </div>
                <div>
                  <p className="text-base font-bold text-white">CORA</p>
                  <p className="text-xs text-slate-300">
                    Barangay Purisima | Community Reporting System
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-300">
                Centralized community reporting and public information portal serving residents and officials of Barangay Purisima, Municipality of Tago, Province of Surigao del Sur.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#EAF6F4]" />
                <span>Barangay Purisima, Tago, Surigao del Sur, 8302, Philippines</span>
              </p>
              {primaryBarangayContact && (
                <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-300">
                  <Phone className="h-3.5 w-3.5 shrink-0 text-[#EAF6F4]" />
                  <span>
                    {primaryBarangayContact.department_name}: {primaryBarangayContact.contact_number}
                  </span>
                </p>
              )}
            </div>

            {/* Quick Navigation Links */}
            <div className="md:col-span-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#EAF6F4]">
                Navigation
              </h3>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-300">
                {navItems.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => scrollToSection(item.id)}
                      className="transition-colors hover:text-white"
                    >
                      {item.label}
                    </button>
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    onClick={() => scrollToSection("explore-purisima")}
                    className="transition-colors hover:text-white"
                  >
                    Barangay Map
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => navigate("/auth")}
                    className="transition-colors hover:text-white"
                  >
                    Sign In / Register
                  </button>
                </li>
              </ul>
            </div>

            {/* Public Portal Access */}
            <div className="md:col-span-3">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[#EAF6F4]">
                Resident Access
              </h3>
              <p className="mt-3 text-xs leading-relaxed text-slate-300">
                Sign in with your resident account to submit a community concern and monitor its resolution status.
              </p>
              <Button
                type="button"
                onClick={handleReportConcern}
                className="mt-4 h-10 w-full gap-2 rounded-xl bg-[#F36B3F] text-xs font-semibold text-white hover:bg-[#dc5a30]"
              >
                <span>Report a Concern</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          <div className="mt-10 border-t border-white/10 pt-6 flex flex-col items-center justify-between gap-2 text-center sm:flex-row sm:text-left">
            <p className="text-xs text-slate-400">
              CORA — Community Reporting &amp; Information System · Barangay Purisima, Tago, Surigao del Sur
            </p>
            <p className="text-xs text-slate-400">
              Official Public Service Portal
            </p>
          </div>
        </div>
      </footer>

      <AnnouncementDetailDialog
        announcement={selectedAnnouncement}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
      />

      <LandingFaqChatbot
        open={faqChatOpen}
        onOpenChange={setFaqChatOpen}
        onScrollToSection={scrollToSection}
        onNavigate={(path) => navigate(path)}
        isAuthenticated={Boolean(user)}
        liveContext={{
          emergencyContacts,
          announcements,
          programs,
        }}
      />
    </div>
  );
};

/** Demo tutorial video player. Renders a clean overview card until the video is loaded in. */
const DemoVideo = ({ showVideo, onPlay }: { showVideo: boolean; onPlay: () => void }) => {
  return (
    <div
      className={cn(
        "relative mx-auto mt-10 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      )}
    >
      {showVideo ? (
        <video
          className="aspect-video w-full bg-[#142B38]"
          controls
          autoPlay
          playsInline
          preload="metadata"
        />
      ) : (
        <button
          type="button"
          onClick={onPlay}
          className="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[#EAF6F4]/70 px-4 transition-colors hover:bg-[#EAF6F4]"
          aria-label="Play the CORA walkthrough video"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#177A73] text-white shadow-md transition-transform group-hover:scale-105">
            <PlayCircle className="h-8 w-8" />
          </span>
          <span className="text-sm font-bold text-[#142B38]">
            Watch the Platform Walkthrough
          </span>
          <span className="text-xs text-[#64748B]">
            Overview of creating an account, submitting a concern, and monitoring status updates
          </span>
        </button>
      )}
    </div>
  );
};

export default Landing;
