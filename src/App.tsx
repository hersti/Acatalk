import { lazy, Suspense, type ReactNode } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import RootPage from "./pages/RootPage";
import ProfilePage from "./pages/ProfilePage";
import MessagesPage from "./pages/MessagesPage";
import SettingsPage from "./pages/SettingsPage";
import NotificationsPage from "./pages/NotificationsPage";
import { StateBlock } from "@/components/ui/state-blocks";
import ScrollToTop from "./components/ScrollToTop";

const queryClient = new QueryClient();
const CoursesPage = lazy(() => import("./pages/CoursesPage"));
const UniversitiesPage = lazy(() => import("./pages/UniversitiesPage"));
const UniversityDetailPage = lazy(() => import("./pages/UniversityDetailPage"));
const CoursePage = lazy(() => import("./pages/CoursePage"));
const PostPage = lazy(() => import("./pages/PostPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const UserProfilePage = lazy(() => import("./pages/UserProfilePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const AdminPage = lazy(() => import("./pages/AdminPage"));
const CommunityPage = lazy(() => import("./pages/CommunityPage"));
const UniversityChatPage = lazy(() => import("./pages/UniversityChatPage"));
const AboutPage = lazy(() => import("./pages/AboutPage"));
const ContactPage = lazy(() => import("./pages/ContactPage"));
const TermsPage = lazy(() => import("./pages/TermsPage"));
const CommunityRulesPage = lazy(() => import("./pages/CommunityRulesPage"));
const PrivacyPage = lazy(() => import("./pages/PrivacyPage"));
const CopyrightPage = lazy(() => import("./pages/CopyrightPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteInlineFallback() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-xl border border-border/70 bg-card p-6">
        <StateBlock
          variant="loading"
          size="section"
          title="İçerik yükleniyor"
          description="Lütfen bekleyin."
        />
      </div>
    </div>
  );
}

function withRouteFallback(node: ReactNode) {
  return <Suspense fallback={<RouteInlineFallback />}>{node}</Suspense>;
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
            <Route path="/courses" element={withRouteFallback(<CoursesPage />)} />
            <Route path="/universities" element={withRouteFallback(<UniversitiesPage />)} />
            <Route path="/universities/:id" element={withRouteFallback(<UniversityDetailPage />)} />
            <Route path="/course/:id" element={withRouteFallback(<CoursePage />)} />
            <Route path="/post/:id" element={withRouteFallback(<PostPage />)} />
            <Route path="/auth" element={withRouteFallback(<AuthPage />)} />
            <Route path="/forgot-password" element={withRouteFallback(<ForgotPasswordPage />)} />
            <Route path="/reset-password" element={withRouteFallback(<ResetPasswordPage />)} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/user/:id" element={withRouteFallback(<UserProfilePage />)} />
            <Route path="/leaderboard" element={withRouteFallback(<LeaderboardPage />)} />
            <Route path="/admin" element={withRouteFallback(<AdminPage />)} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/communities" element={withRouteFallback(<CommunityPage />)} />`r`n            <Route path="/communities/:id" element={withRouteFallback(<CommunityPage />)} />
            <Route path="/community" element={<Navigate to="/communities" replace />} />
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
