import type { ReactNode } from "react";

import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type HelperCardProps = {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  highlighted?: boolean;
  className?: string;
};

export function HelperCard({ title, icon, children, highlighted = false, className }: HelperCardProps) {
  return (
    <Surface
      variant={highlighted ? "helper" : "base"}
      border="subtle"
      radius="xl"
      padding="md"
      className={cn(
        "border-border/75 bg-gradient-to-b from-card to-card/95",
        highlighted && "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/20",
        className,
      )}
    >
      {title || icon ? (
        <div className="mb-3 border-b border-border/70 pb-2.5">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary">{icon}</span> : null}
            {title ? <h3 className="font-heading text-sm font-bold tracking-tight">{title}</h3> : null}
          </div>
        </div>
      ) : null}
      {children}
    </Surface>
  );
}
