import { lazy, Suspense, useLayoutEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { HomeGate } from '@/features/residents/components/HomeGate';
import { useAuth } from '@/features/auth/useAuth';
import { setThemeOverride } from '@/lib/preferences';
import { AdminRoute, StaffRoute } from './RouteGuards';
import { ROUTES } from './routePaths';

const Landing = lazy(() => import('@/features/landing/pages/Landing'));
const Auth = lazy(() => import('@/features/residents/pages/Auth'));
const PrivacyTerms = lazy(() => import('@/features/residents/pages/PrivacyTerms'));
const GuestMode = lazy(() => import('@/features/residents/pages/GuestMode'));
const Services = lazy(() => import('@/features/residents/pages/Services'));
const Updates = lazy(() => import('@/features/residents/pages/Updates'));
const Profile = lazy(() => import('@/features/residents/pages/Profile'));
const Settings = lazy(() => import('@/features/residents/pages/Settings'));
const ReportIssue = lazy(() => import('@/features/residents/pages/ReportIssue'));
const MyRequests = lazy(() => import('@/features/residents/pages/MyRequests'));
const Feedback = lazy(() => import('@/features/residents/pages/Feedback'));
const CommunityWall = lazy(() => import('@/features/residents/pages/CommunityWall'));
const Programs = lazy(() => import('@/features/residents/pages/Programs'));
const Directory = lazy(() => import('@/features/residents/pages/Directory'));
const EmergencyContacts = lazy(() => import('@/features/residents/pages/EmergencyContacts'));
const StaffRequests = lazy(() => import('@/features/staff/pages/StaffRequests'));
const AdminDashboard = lazy(() => import('@/features/admin/pages/AdminDashboard'));
const AdminRequests = lazy(() => import('@/features/admin/pages/AdminRequests'));
const AdminUsers = lazy(() => import('@/features/admin/pages/AdminUsers'));
const AdminFeedback = lazy(() => import('@/features/admin/pages/AdminFeedback'));
const AdminAnnouncements = lazy(() => import('@/features/admin/pages/AdminAnnouncements'));
const AdminOffices = lazy(() => import('@/features/admin/pages/AdminOffices'));
const AdminPrograms = lazy(() => import('@/features/admin/pages/AdminPrograms'));
const AdminEmergencyContacts = lazy(() => import('@/features/admin/pages/AdminEmergencyContacts'));
const AdminChat = lazy(() => import('@/features/admin/pages/AdminChat'));
const AdminKnowledge = lazy(() => import('@/features/admin/pages/AdminKnowledge'));
const NotFound = lazy(() => import('@/app/NotFound'));
const ChatbotLauncher = lazy(() =>
  import('@/features/residents/components/ChatbotLauncher').then((module) => ({
    default: module.ChatbotLauncher,
  }))
);

function RouteFallback() {
  return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
}

const RESIDENT_THEME_ROUTES = new Set<string>([
  ROUTES.home,
  ROUTES.dashboard,
  ROUTES.services,
  ROUTES.updates,
  ROUTES.profile,
  ROUTES.settings,
  ROUTES.reportIssue,
  ROUTES.myRequests,
  ROUTES.feedback,
  ROUTES.community,
  ROUTES.programs,
  ROUTES.directory,
  ROUTES.emergency,
]);

const RESIDENT_NO_PINCH_ZOOM_ROUTES = new Set<string>([
  ROUTES.home,
  ROUTES.dashboard,
  ROUTES.myRequests,
  ROUTES.updates,
  ROUTES.profile,
  ROUTES.settings,
  ROUTES.emergency,
  ROUTES.directory,
  ROUTES.programs,
]);

function ThemeScope() {
  const { pathname } = useLocation();
  const { user, isAdmin, isStaff } = useAuth();
  const isAdminRoute =
    pathname === ROUTES.admin || pathname.startsWith(`${ROUTES.admin}/`);
  const canUseDarkTheme =
    Boolean(user) &&
    (isAdminRoute ? isAdmin : !isAdminRoute && !isStaff && RESIDENT_THEME_ROUTES.has(pathname));
  const shouldPreventPinchZoom =
    Boolean(user) &&
    !isAdmin &&
    !isStaff &&
    RESIDENT_NO_PINCH_ZOOM_ROUTES.has(pathname);

  useLayoutEffect(() => {
    setThemeOverride(canUseDarkTheme ? null : 'light');
  }, [canUseDarkTheme]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousTouchAction = root.style.touchAction;
    if (shouldPreventPinchZoom) root.style.touchAction = 'pan-x pan-y';

    return () => {
      root.style.touchAction = previousTouchAction;
    };
  }, [shouldPreventPinchZoom]);

  return null;
}

function AppRouteContent() {
  const { user, isLoading, isAccessLoading, accessError } = useAuth();
  const { pathname } = useLocation();
  const isPublicReportRoute = pathname === ROUTES.reportIssue;

  if (
    !isPublicReportRoute &&
    (isLoading || (user && isAccessLoading))
  ) {
    return <RouteFallback />;
  }
  if (!isPublicReportRoute && user && accessError) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm text-muted-foreground"
      >
        {accessError}
      </div>
    );
  }
  if (user && pathname === ROUTES.auth) {
    return <Navigate to={ROUTES.home} replace />;
  }

  return (
    <>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route path={ROUTES.home} element={<HomeGate />} />
          <Route path={ROUTES.landing} element={<Landing />} />
          <Route path={ROUTES.dashboard} element={<HomeGate />} />
          <Route path={ROUTES.auth} element={<Auth />} />
          <Route path={ROUTES.privacyTerms} element={<PrivacyTerms />} />
          <Route path={ROUTES.guest} element={<GuestMode />} />
          <Route path={ROUTES.services} element={<Services />} />
          <Route path={ROUTES.updates} element={<Updates />} />
          <Route path={ROUTES.profile} element={<Profile />} />
          <Route path={ROUTES.settings} element={<Settings />} />
          <Route path={ROUTES.reportIssue} element={<ReportIssue />} />
          <Route path={ROUTES.myRequests} element={<MyRequests />} />
          <Route path={ROUTES.feedback} element={<Feedback />} />
          <Route path={ROUTES.community} element={<CommunityWall />} />
          <Route path={ROUTES.programs} element={<Programs />} />
          <Route path={ROUTES.directory} element={<Directory />} />
          <Route path={ROUTES.emergency} element={<EmergencyContacts />} />
          <Route element={<StaffRoute />}>
            <Route path={ROUTES.staff} element={<StaffRequests />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path={ROUTES.admin} element={<AdminDashboard />} />
            <Route path={ROUTES.adminRequests} element={<AdminRequests />} />
            <Route path={ROUTES.adminUsers} element={<AdminUsers />} />
            <Route path={ROUTES.adminAnnouncements} element={<AdminAnnouncements />} />
            <Route path={ROUTES.adminOffices} element={<AdminOffices />} />
            <Route path={ROUTES.adminPrograms} element={<AdminPrograms />} />
            <Route path={ROUTES.adminFeedback} element={<AdminFeedback />} />
            <Route path={ROUTES.adminEmergencyContacts} element={<AdminEmergencyContacts />} />
            <Route path={ROUTES.adminChat} element={<AdminChat />} />
            <Route path={ROUTES.adminKnowledge} element={<AdminKnowledge />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
      {pathname !== ROUTES.privacyTerms && (
        <Suspense fallback={null}><ChatbotLauncher /></Suspense>
      )}
    </>
  );
}

export function AppRouter() {
  return (
    <BrowserRouter>
      <ThemeScope />
      <AppRouteContent />
    </BrowserRouter>
  );
}
