import { lazy, Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { StateBlock } from "@/components/ui/state-blocks";

const GuestLandingPage = lazy(() => import("@/pages/GuestLandingPage"));
const IndexPage = lazy(() => import("@/pages/Index"));

function RootContentFallback() {
  return (
    <div className="min-h-screen bg-background px-4 py-12">
      <div className="mx-auto max-w-3xl">
        <StateBlock
          variant="loading"
          size="page"
          title="AcaTalk hazırlanıyor"
          description="Ana içerik yükleniyor."
        />
      </div>
    </div>
  );
}

export default function RootPage() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background px-4 py-12">
        <div className="mx-auto max-w-3xl">
          <StateBlock
            variant="loading"
            size="page"
            title="AcaTalk hazırlanıyor"
            description="Oturum durumunuz kontrol ediliyor."
          />
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={<RootContentFallback />}>
      {user ? <IndexPage /> : <GuestLandingPage />}
    </Suspense>
  );
}
