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
      padding="sm"
      className={cn(
        "border-border/75 bg-gradient-to-b from-card to-card/95 shadow-[var(--shadow-card)]",
        highlighted && "border-primary/30 bg-gradient-to-br from-primary/12 via-card to-accent/20",
        className,
      )}
    >
      {title || icon ? (
        <div className="mb-2.5 border-b border-border/70 pb-2">
          <div className="flex items-center gap-2">
            {icon ? <span className="text-primary/90">{icon}</span> : null}
            {title ? <h3 className="font-heading text-sm font-extrabold tracking-tight">{title}</h3> : null}
          </div>
        </div>
      ) : null}
      {children}
    </Surface>
  );
}
