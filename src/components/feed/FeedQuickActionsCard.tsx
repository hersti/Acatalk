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
    <Card className="border shadow-sm p-2.5">
      <h3 className="font-heading text-sm font-bold">Hızlı Paylaşım</h3>
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Seçtiğin ders için tek adımda içerik ekle.
      </p>

      <div className="mt-2 space-y-1.5">
        {canAddContent ? (
          <Button size="sm" className="w-full gap-1.5 h-8" onClick={onOpenCreate}>
            <PlusCircle className="h-3.5 w-3.5" /> İçerik Ekle
          </Button>
        ) : (
          <p className="text-[11px] text-muted-foreground rounded-md bg-secondary/40 px-2 py-1.5">
            Paylaşım için ders üniversitesi ve profil üniversitesi aynı olmalı.
          </p>
        )}

        {isViewingOtherUniversity && onSwitchToOwnUniversity ? (
          <Button size="sm" variant="outline" className="w-full h-8" onClick={onSwitchToOwnUniversity}>
            Kendi Üniversiteme Dön
          </Button>
        ) : null}
      </div>
    </Card>
  );
}
