import { PlusCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FeedQuickActionsCardProps {
  canAddContent: boolean;
  isViewingOtherUniversity: boolean;
  onOpenCreate: () => void;
  onSwitchToOwnUniversity?: () => void;
}

export default function FeedQuickActionsCard({
  canAddContent,
  isViewingOtherUniversity,
  onOpenCreate,
  onSwitchToOwnUniversity,
}: FeedQuickActionsCardProps) {
  return (
    <Card className="border shadow-sm p-3">
      <h3 className="font-heading text-sm font-bold">Hizli Katki</h3>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Kesiften sonra dogrudan ders baglaminda katki baslat.
      </p>

      <div className="mt-2.5 space-y-2">
        {canAddContent ? (
          <Button size="sm" className="w-full gap-1.5" onClick={onOpenCreate}>
            <PlusCircle className="h-3.5 w-3.5" /> Icerik Ekle
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground rounded-md bg-secondary/40 px-2.5 py-2">
            Katki icin ders universitesi ile profil universitesi ayni olmali.
          </p>
        )}

        {isViewingOtherUniversity && onSwitchToOwnUniversity ? (
          <Button size="sm" variant="outline" className="w-full" onClick={onSwitchToOwnUniversity}>
            Kendi Universiteme Don
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
