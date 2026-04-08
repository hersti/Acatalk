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
      className={cn(highlighted && "bg-gradient-to-br from-primary/10 to-accent/10", className)}
    >
      {title || icon ? (
        <div className="mb-3 flex items-center gap-2">
          {icon ? <span className="text-primary">{icon}</span> : null}
          {title ? <h3 className="font-heading text-sm font-bold">{title}</h3> : null}
        </div>
      ) : null}
      {children}
    </Surface>
  );
}
