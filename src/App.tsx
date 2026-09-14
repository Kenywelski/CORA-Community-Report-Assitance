import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Services from "./pages/Services";
import Updates from "./pages/Updates";
import Profile from "./pages/Profile";
import ReportIssue from "./pages/ReportIssue";
import MyRequests from "./pages/MyRequests";
import Feedback from "./pages/Feedback";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRequests from "./pages/AdminRequests";
import AdminUsers from "./pages/AdminUsers";
import AdminFeedback from "./pages/AdminFeedback";
import AdminAnnouncements from "./pages/AdminAnnouncements";
import AdminPosts from "./pages/AdminPosts";
import CommunityWall from "./pages/CommunityWall";
import EmergencyContacts from "./pages/EmergencyContacts";
import AdminEmergencyContacts from "./pages/AdminEmergencyContacts";
import Programs from "./pages/Programs";
import Directory from "./pages/Directory";
import AdminChat from "./pages/AdminChat";
import NotFound from "./pages/NotFound";
import { ChatbotLauncher } from "./components/ChatbotLauncher";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/services" element={<Services />} />
            <Route path="/updates" element={<Updates />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/report-issue" element={<ReportIssue />} />
            <Route path="/my-requests" element={<MyRequests />} />
            <Route path="/feedback" element={<Feedback />} />
            <Route path="/community" element={<CommunityWall />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/requests" element={<AdminRequests />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/announcements" element={<AdminAnnouncements />} />
            <Route path="/admin/posts" element={<AdminPosts />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            <Route path="/programs" element={<Programs />} />
            <Route path="/directory" element={<Directory />} />
            <Route path="/emergency" element={<EmergencyContacts />} />
            <Route path="/admin/emergency-contacts" element={<AdminEmergencyContacts />} />
            <Route path="/admin/chat" element={<AdminChat />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
          <ChatbotLauncher />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
