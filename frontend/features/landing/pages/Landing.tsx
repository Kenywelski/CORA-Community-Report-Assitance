import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  Camera,
  ChevronDown,
  ClipboardCheck,
  Clock,
  CloudRain,
  Construction,
  Lightbulb,
  LogIn,
  MapPin,
  Megaphone,
  Menu,
  Phone,
  PlayCircle,
  Siren,
  Trash2,
  UserPlus,
  Users,
  X,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { getEmergencyContactAppearance } from '@/features/emergency-contacts/contactAppearance';
import { emergencyContactQueryKeys } from '@/features/emergency-contacts/queryKeys';
import { emergencyContactTelHref, parseEmergencyContactNumbers } from '@/features/emergency-contacts/contactNumbers';
import { supabase } from "@/integrations/supabase/client";
import { BarangayPurisimaMap } from "@/features/residents/components/BarangayPurisimaMap";
import { AnnouncementDetailDialog } from "@/features/residents/components/AnnouncementDetailDialog";
import { LandingFaqChatbot } from "@/features/landing/components/LandingFaqChatbot";
import {
  loadBarangayPrograms,
  type BarangayProgramItem,
} from '@/lib/barangayContentStore';

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

const PURISIMA_LOGO_URL = "/assets/branding/cora-logo.png";

const LANDING_NAV_ITEMS = [
  { label: "Home", id: "home" },
  { label: "About", id: "how-it-works" },
  { label: "Announcements", id: "announcements" },
  { label: "Programs", id: "programs" },
  { label: "Emergency Contacts", id: "emergency-contacts" },
  { label: "FAQs", id: "faqs" },
] as const;

type LandingNavId = (typeof LANDING_NAV_ITEMS)[number]["id"];

export const Landing = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [selectedAnnouncement, setSelectedAnnouncement] = useState<Announcement | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [faqChatOpen, setFaqChatOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<LandingNavId>("home");

  useEffect(() => {
    document.title = "CORA — Community Report Assitance | Barangay Purisima";
  }, []);

  useEffect(() => {
    const sectionIds = LANDING_NAV_ITEMS
      .map((item) => item.id)
      .filter((id): id is Exclude<LandingNavId, "home" | "faqs"> =>
        id !== "home" && id !== "faqs"
      );

    const updateActiveSection = () => {
      const readingLine = window.scrollY + 120;
      let nextSection: LandingNavId = "home";

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= readingLine) {
          nextSection = id;
        }
      });

      setActiveSection((current) => current === nextSection ? current : nextSection);
    };

    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    return () => window.removeEventListener("scroll", updateActiveSection);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    const closeAtDesktopWidth = () => {
      if (window.innerWidth >= 1180) setMobileMenuOpen(false);
    };

    window.addEventListener("keydown", closeOnEscape);
    window.addEventListener("resize", closeAtDesktopWidth);
    return () => {
      window.removeEventListener("keydown", closeOnEscape);
      window.removeEventListener("resize", closeAtDesktopWidth);
    };
  }, [mobileMenuOpen]);

  // Fetch official announcements from existing admin-managed database
  const {
    data: announcements = [],
    isLoading: loadingAnnouncements,
    isError: announcementsError,
  } = useQuery({
    queryKey: ["landing-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .eq("is_active", true)
        .order("published_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return (data ?? []) as Announcement[];
    },
    staleTime: 1000 * 60 * 2,
    refetchOnMount: 'always',
  });

  // Fetch barangay programs from existing admin-managed database
  const {
    data: programs = [],
    isLoading: loadingPrograms,
    isError: programsError,
  } = useQuery({
    queryKey: ["landing-programs"],
    queryFn: async (): Promise<BarangayProgramItem[]> =>
      (await loadBarangayPrograms()).filter((program) => program.is_active).slice(0, 6),
    staleTime: 1000 * 60 * 5,
    refetchOnMount: 'always',
  });

  // Fetch verified emergency contacts from existing admin-managed database
  const {
    data: emergencyContacts = [],
    isLoading: loadingContacts,
    isError: emergencyContactsError,
  } = useQuery({
    queryKey: emergencyContactQueryKeys.landing,
    queryFn: async (): Promise<EmergencyContact[]> => {
      const { data, error } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as EmergencyContact[];
    },
    staleTime: 0,
    refetchInterval: 5_000,
    refetchIntervalInBackground: true,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!selectedAnnouncement) return;
    const latestAnnouncement = announcements.find(
      (announcement) => announcement.id === selectedAnnouncement.id,
    );
    if (!latestAnnouncement) {
      setSelectedAnnouncement(null);
      setIsDetailOpen(false);
    } else if (latestAnnouncement !== selectedAnnouncement) {
      setSelectedAnnouncement(latestAnnouncement);
    }
  }, [announcements, selectedAnnouncement]);

  const handleReportConcern = () => {
    if (user) {
      navigate("/report-issue");
    } else {
      navigate("/auth");
    }
  };

  const scrollToSection = (id: LandingNavId | "explore-purisima") => {
    setMobileMenuOpen(false);
    if (id === "faqs") {
      setFaqChatOpen(true);
      return;
    }

    setFaqChatOpen(false);
    if (id !== "explore-purisima") setActiveSection(id);
    if (id === "home") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  const currentNavItem = faqChatOpen ? "faqs" : activeSection;
  const accountDestination = user ? "/dashboard" : "/auth";
  const accountLabel = user ? "Dashboard" : "Sign In";

  const primaryBarangayContact = emergencyContacts.find(
    (c) =>
      c.service_type?.toLowerCase().includes("barangay") ||
      c.department_name?.toLowerCase().includes("purisima")
  );

  return (
    <div id="home" className="min-h-screen bg-[#F8FAFC] text-[#142B38]">
      {/* Sticky White Header & Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200/90 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6 sm:py-4 lg:px-8">
          {/* CORA brand identity */}
          <button
            type="button"
            onClick={() => scrollToSection("home")}
            className="flex min-w-0 items-center gap-3.5 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2"
          >
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
              <img
                src={PURISIMA_LOGO_URL}
                alt="CORA logo"
                className="h-full w-full scale-[1.18] object-cover"
              />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-[17px] font-bold leading-tight text-[#142B38]">
                CORA
              </p>
              <p className="truncate text-xs font-medium leading-tight text-[#64748B]">
                Barangay Purisima | Community Report Assitance
              </p>
            </div>
          </button>

          {/* Desktop Navigation Links + Sign In */}
          <nav
            aria-label="Primary navigation"
            className="hidden items-center gap-1.5 min-[1180px]:flex"
          >
            {LANDING_NAV_ITEMS.map((item) => {
              const isActive = currentNavItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => scrollToSection(item.id)}
                  aria-current={isActive ? "location" : undefined}
                  className={cn(
                    "relative whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[13px] font-semibold transition-colors after:absolute after:bottom-0 after:left-1/2 after:h-0.5 after:-translate-x-1/2 after:rounded-full after:bg-[#177A73] after:transition-[width,opacity] after:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2",
                    isActive
                      ? "text-[#177A73] after:w-5 after:opacity-100"
                      : "text-[#142B38]/80 after:w-0 after:opacity-0 hover:text-[#177A73]"
                  )}
                >
                  {item.label}
                </button>
              );
            })}
            <Button
              type="button"
              onClick={() => navigate(accountDestination)}
              className="ml-2.5 h-11 shrink-0 gap-2 rounded-xl bg-[#F36B3F] px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#dc5a30] focus-visible:ring-[#F36B3F]"
            >
              <LogIn className="h-4 w-4" />
              <span>{accountLabel}</span>
            </Button>
          </nav>

          {/* Mobile Hamburger Menu Button */}
          <div className="flex items-center min-[1180px]:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-navigation-menu"
              aria-label={mobileMenuOpen ? "Close navigation menu" : "Open navigation menu"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-transparent text-[#142B38] transition-colors hover:bg-[#EAF6F4] hover:text-[#177A73] focus-visible:bg-[#EAF6F4] focus-visible:text-[#177A73] focus-visible:outline-none"
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
            className="border-t border-slate-200 bg-white shadow-lg min-[1180px]:hidden"
          >
            <div className="mx-auto flex max-w-6xl flex-col space-y-1 px-4 pb-5 pt-3 sm:px-6 lg:px-8">
              {LANDING_NAV_ITEMS.map((item) => {
                const isActive = currentNavItem === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => scrollToSection(item.id)}
                    aria-current={isActive ? "location" : undefined}
                    className={cn(
                      "flex w-full items-center justify-start rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition-colors",
                      isActive
                        ? "bg-[#EAF6F4] text-[#177A73]"
                        : "text-[#142B38] hover:bg-slate-100 hover:text-[#177A73]"
                    )}
                  >
                    <span>{item.label}</span>
                  </button>
                );
              })}
              <div className="pt-2">
                <Button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    navigate(accountDestination);
                  }}
                  className="h-11 w-full gap-2 rounded-xl bg-[#F36B3F] text-sm font-semibold text-white shadow-sm hover:bg-[#dc5a30]"
                >
                  <LogIn className="h-4 w-4" />
                  <span>{accountLabel}</span>
                </Button>
              </div>
            </div>
          </nav>
        )}
      </header>

      <main>
        {/* Barangay Hall Hero Section */}
        <section className="relative flex min-h-[calc(100svh-4.25rem)] items-center justify-center overflow-hidden bg-[#0C413E]">
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage:
                "linear-gradient(180deg, rgba(12, 32, 43, 0.93) 0%, rgba(15, 91, 86, 0.88) 58%, rgba(12, 65, 62, 0.94) 100%), url('/assets/branding/barangay-hall-purisima.png')",
            }}
          />
          <div className="relative mx-auto w-full max-w-5xl px-4 py-10 text-center sm:px-6 sm:py-12">
            {/* Small Location Badge */}
            <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3.5 py-2 text-xs font-semibold text-white ring-1 ring-white/25 sm:text-[13px]">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-[#EAF6F4] sm:h-4 sm:w-4" />
              <span>Barangay Purisima, Tago, Surigao del Sur</span>
            </div>

            {/* Main Headline */}
            <h1 className="mx-auto mt-5 max-w-2xl text-balance text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl lg:text-[34px]">
              Report Local Issues That Need Barangay Action
            </h1>

            {/* Supporting Description */}
            <p className="mx-auto mt-4 max-w-3xl text-sm leading-relaxed text-white/90 sm:text-base">
              CORA helps Barangay Purisima residents report improper waste disposal, damaged or non-functioning streetlights, drainage or flooding concerns, and road damage—then track each report as barangay personnel review and address it.
            </p>

            {/* Primary & Secondary Call-to-Action Buttons */}
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
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
            <p className="mx-auto mt-5 max-w-2xl text-xs leading-relaxed text-white/80 sm:text-[13px]">
              New to CORA? Create an account to submit and track community concerns. Public barangay information is available to everyone.
            </p>
          </div>
        </section>

        {/* How CORA works */}
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
          <div className="mx-auto max-w-2xl text-center">
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
          </div>

          <div className="mt-8">
            {loadingAnnouncements ? (
              <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-12">
                <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
              </div>
            ) : announcementsError ? (
              <div role="alert" className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-[#64748B]">
                Announcements could not be loaded. Please try again later.
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
                              className="h-36 w-full bg-slate-50 object-contain"
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
            <div className="mx-auto max-w-2xl text-center">
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
            </div>

            <div className="mt-8">
              {loadingPrograms ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
                </div>
              ) : programsError ? (
                <div role="alert" className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 text-center text-sm text-[#64748B]">
                  Barangay programs could not be loaded. Please try again later.
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
                        <h3 className="text-base font-bold text-[#142B38]">
                          {prog.title}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-[#64748B] sm:text-sm">
                          {prog.description}
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
            <div className="mx-auto max-w-2xl text-center">
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
            </div>

            <div className="mt-8">
              {loadingContacts ? (
                <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-[#F8FAFC] py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-[#177A73]" />
                </div>
              ) : emergencyContactsError ? (
                <div role="alert" className="rounded-2xl border border-slate-200 bg-[#F8FAFC] p-8 text-center text-sm text-[#64748B]">
                  Emergency contacts could not be loaded. Please try again later.
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
                <div className="space-y-3">
                  {emergencyContacts.map((c) => {
                    const appearance = getEmergencyContactAppearance(c.department_name, c.service_type);
                    const Icon = appearance.icon;
                    const contactNumbers = parseEmergencyContactNumbers(c.contact_number);
                    return (
                      <details
                        key={c.id}
                        className="group rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
                      >
                        <summary className="flex cursor-pointer list-none items-center gap-3 rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#177A73] sm:p-5 [&::-webkit-details-marker]:hidden">
                          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${appearance.iconClass}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="inline-flex rounded-full bg-[#EAF6F4] px-2.5 py-1 text-[10px] font-semibold text-[#177A73]">
                              {c.service_type}
                            </span>
                            <h3 className="mt-1.5 break-words text-sm font-bold leading-snug text-[#142B38] sm:text-base">
                              {c.department_name}
                            </h3>
                          </div>
                          <div className="flex shrink-0 items-center gap-3">
                            {contactNumbers.length > 0 && (
                              <span className="hidden text-xs text-[#64748B] sm:inline">
                                {contactNumbers.length} {contactNumbers.length === 1 ? 'number' : 'numbers'}
                              </span>
                            )}
                            <ChevronDown
                              aria-hidden="true"
                              className="h-5 w-5 text-[#64748B] transition-transform duration-200 group-open:rotate-180"
                            />
                          </div>
                        </summary>

                        <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                          <div className="border-t border-slate-200 pt-3">
                            <div className="flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-[#64748B]">
                              {c.address && (
                                <span className="inline-flex items-center gap-1.5">
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  {c.address}
                                </span>
                              )}
                              {c.availability && (
                                <span className="inline-flex items-center gap-1.5">
                                  <Clock className="h-3.5 w-3.5 shrink-0" />
                                  {c.availability}
                                </span>
                              )}
                            </div>
                            <div className="mt-4">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#64748B]">
                                  {contactNumbers.length ? 'Call this service' : 'Phone contact'}
                                </p>
                                {contactNumbers.length > 0 && (
                                  <span className="text-[10px] font-medium text-[#64748B] sm:hidden">
                                    {contactNumbers.length} {contactNumbers.length === 1 ? 'number' : 'numbers'}
                                  </span>
                                )}
                              </div>
                              {contactNumbers.length ? (
                                <div className={`grid gap-2 ${contactNumbers.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                                  {contactNumbers.map((number, index) => (
                                    <a
                                      key={`${number}-${index}`}
                                      href={emergencyContactTelHref(number)}
                                      aria-label={`Call ${c.department_name} at ${number}`}
                                      className="inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-xl bg-[#177A73] px-3 py-2 font-mono text-xs font-semibold tabular-nums text-white transition-colors hover:bg-[#13635d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#177A73] focus-visible:ring-offset-2"
                                    >
                                      <Phone className="h-3.5 w-3.5 shrink-0" />
                                      <span className="whitespace-nowrap">{number}</span>
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-xl bg-[#F1F5F9] px-3 py-3 text-center text-xs font-medium text-[#64748B]">
                                  No number available
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </details>
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
                <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm">
                  <img
                    src={PURISIMA_LOGO_URL}
                    alt="CORA logo"
                    className="h-full w-full scale-[1.18] object-cover"
                  />
                </div>
                <div>
                  <p className="text-base font-bold text-white">CORA</p>
                  <p className="text-xs text-slate-300">
                    Barangay Purisima | Community Report Assitance
                  </p>
                </div>
              </div>
              <p className="mt-4 max-w-sm text-xs leading-relaxed text-slate-300">
                Centralized Community Report Assitance platform serving residents and officials of Barangay Purisima, Municipality of Tago, Province of Surigao del Sur.
              </p>
              <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-300">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-[#EAF6F4]" />
                <span>Barangay Purisima, Tago, Surigao del Sur, 8302, Philippines</span>
              </p>
              {primaryBarangayContact?.contact_number.trim() && (
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
                {LANDING_NAV_ITEMS.map((item) => (
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
                    onClick={() => navigate(accountDestination)}
                    className="transition-colors hover:text-white"
                  >
                    {user ? "Open Dashboard" : "Sign In / Register"}
                  </button>
                </li>
              </ul>
            </div>

            {/* Resident System Access */}
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
              CORA — Community Report Assitance · Barangay Purisima, Tago, Surigao del Sur
            </p>
            <p className="text-xs text-slate-400">
              Official Community Report Platform
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
          programs: programs.map(({ title, description, schedule, location, status }) => ({
            title,
            description,
            schedule,
            area_covered: location,
            status,
          })),
        }}
      />
    </div>
  );
};

/** Demo tutorial video player. Renders a clean overview card until the video is loaded in. */
const DemoVideo = ({ showVideo, onPlay }: { showVideo: boolean; onPlay: () => void }) => {
  const videoUrl = import.meta.env.VITE_DEMO_VIDEO_URL?.trim();
  return (
    <section className="mt-12" aria-labelledby="platform-walkthrough-heading">
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#177A73]">Video Guide</p>
        <h3
          id="platform-walkthrough-heading"
          className="mt-1.5 text-xl font-bold tracking-tight text-[#142B38] sm:text-2xl"
        >
          CORA Platform Walkthrough
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-[#64748B]">
          A visual guide to creating an account, reporting a concern, and tracking barangay updates.
        </p>
      </div>

      <div
        className={cn(
          "relative mx-auto mt-5 max-w-3xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
        )}
      >
        {showVideo && videoUrl ? (
          <video
            className="aspect-video w-full bg-[#142B38]"
            src={videoUrl}
            controls
            autoPlay
            playsInline
            preload="metadata"
          />
        ) : (
          <button
            type="button"
            onClick={() => videoUrl && onPlay()}
            disabled={!videoUrl}
            className="group flex aspect-video w-full flex-col items-center justify-center gap-3 bg-[#EAF6F4]/70 px-4 transition-colors hover:bg-[#EAF6F4]"
            aria-label="Play the CORA walkthrough video"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#177A73] text-white shadow-md transition-transform group-hover:scale-105">
              <PlayCircle className="h-8 w-8" />
            </span>
            <span className="text-sm font-bold text-[#142B38]">
              {videoUrl ? 'Watch the Platform Walkthrough' : 'Platform Walkthrough Coming Soon'}
            </span>
            <span className="text-xs text-[#64748B]">
              Overview of creating an account, submitting a concern, and monitoring status updates
            </span>
          </button>
        )}
      </div>
    </section>
  );
};

export default Landing;
