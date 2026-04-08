import { useFollow } from "@/hooks/useFollow";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { UserPlus, UserCheck, UserX, Link2, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
interface FollowButtonProps {
  targetUserId: string;
  showConnection?: boolean;
}

export default function FollowButton({ targetUserId, showConnection = true }: FollowButtonProps) {
  const { user } = useAuth();
  const { isFollowing, connectionStatus, loading, toggleFollow, requestConnection, respondToConnection } = useFollow(targetUserId);

  if (!user || user.id === targetUserId) return null;

  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant={isFollowing ? "secondary" : "default"}
        size="sm"
        className="h-8 text-xs gap-1.5 rounded-lg"
        onClick={toggleFollow}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isFollowing ? (
          <>
            <UserCheck className="h-3.5 w-3.5" />
            Takip Ediliyor
          </>
        ) : (
          <>
            <UserPlus className="h-3.5 w-3.5" />
            Takip Et
          </>
        )}
      </Button>

      {showConnection && connectionStatus === "none" && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 rounded-lg"
          onClick={async () => {
            try {
              await requestConnection();
            } catch (e: any) {
              toast.error(e.message || "Bağlantı isteği gönderilemedi.");
            }
          }}
          disabled={loading}
        >
          <Link2 className="h-3.5 w-3.5" />
          Bağlan
        </Button>
      )}

      {showConnection && connectionStatus === "pending_sent" && (
        <Button variant="outline" size="sm" className="h-8 text-xs rounded-lg" disabled>
          İstek Gönderildi
        </Button>
      )}

      {showConnection && connectionStatus === "pending_received" && (
        <div className="flex items-center gap-1">
          <Button
            variant="default"
            size="sm"
            className="h-8 text-xs gap-1 rounded-lg"
            onClick={() => respondToConnection(true)}
            disabled={loading}
          >
            <Check className="h-3.5 w-3.5" />
            Kabul Et
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1 rounded-lg"
            onClick={() => respondToConnection(false)}
            disabled={loading}
          >
            <X className="h-3.5 w-3.5" />
            Reddet
          </Button>
        </div>
      )}

      {showConnection && connectionStatus === "accepted" && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 rounded-lg text-accent" disabled>
          <UserCheck className="h-3.5 w-3.5" />
          Bağlı
        </Button>
      )}

      {showConnection && connectionStatus === "rejected" && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs gap-1.5 rounded-lg"
          onClick={async () => {
            try {
              await requestConnection();
            } catch (e: any) {
              toast.error(e.message || "Bağlantı isteği gönderilemedi.");
            }
          }}
          disabled={loading}
        >
          <Link2 className="h-3.5 w-3.5" />
          Tekrar Bağlan
        </Button>
      )}
    </div>
  );
}
