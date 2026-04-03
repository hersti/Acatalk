import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import RootPage from "./pages/RootPage";
import { StateBlock } from "@/components/ui/state-blocks";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();
const CoursePage = lazy(() => import("./pages/CoursePage"));
const PostPage = lazy(() => import("./pages/PostPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const MessagesPage = lazy(() => import("./pages/MessagesPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const UniversityChatPage = lazy(() => import("./pages/UniversityChatPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CommunityRulesPage = lazy(() => import("./pages/CommunityRulesPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const CopyrightPage = lazy(() => import("./pages/CopyrightPage"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteLoadingFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <StateBlock
          variant="loading"
          size="page"
          title="Sayfa hazirlaniyor"
          description="Icerik yukleniyor, lutfen bekleyin."
        />
      </div>
    </div>
  );
}

function withRouteFallback(node: ReactNode) {
  return <Suspense fallback={<RouteLoadingFallback />}>{node}</Suspense>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<RootPage />} />
            <Route path="/course/:id" element={withRouteFallback(<CoursePage />)} />
            <Route path="/post/:id" element={withRouteFallback(<PostPage />)} />
            <Route path="/auth" element={withRouteFallback(<AuthPage />)} />
            <Route path="/forgot-password" element={withRouteFallback(<ForgotPasswordPage />)} />
            <Route path="/reset-password" element={withRouteFallback(<ResetPasswordPage />)} />
            <Route path="/profile" element={withRouteFallback(<ProfilePage />)} />
            <Route path="/user/:id" element={withRouteFallback(<UserProfilePage />)} />
            <Route path="/leaderboard" element={withRouteFallback(<LeaderboardPage />)} />
            <Route path="/admin" element={withRouteFallback(<AdminPage />)} />
            <Route path="/messages" element={withRouteFallback(<MessagesPage />)} />
            <Route path="/settings" element={withRouteFallback(<SettingsPage />)} />
            <Route path="/notifications" element={withRouteFallback(<NotificationsPage />)} />
            <Route path="/community" element={withRouteFallback(<CommunityPage />)} />
            <Route path="/university-chat" element={withRouteFallback(<UniversityChatPage />)} />
            <Route path="/about" element={withRouteFallback(<AboutPage />)} />
            <Route path="/contact" element={withRouteFallback(<ContactPage />)} />
            <Route path="/terms" element={withRouteFallback(<TermsPage />)} />
            <Route path="/community-rules" element={withRouteFallback(<CommunityRulesPage />)} />
            <Route path="/privacy" element={withRouteFallback(<PrivacyPage />)} />
            <Route path="/copyright" element={withRouteFallback(<CopyrightPage />)} />
            <Route path="*" element={withRouteFallback(<NotFound />)} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
