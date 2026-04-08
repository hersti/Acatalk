import type { ReactNode } from "react";

import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";

type ProductCardProps = {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  highlighted?: boolean;
};

export function ProductCard({ children, className, interactive = false, highlighted = false }: ProductCardProps) {
  return (
    <Surface
      variant={highlighted ? "helper" : "raised"}
      border="subtle"
      radius="xl"
      padding="sm"
      interactive={interactive}
      className={cn(
        "border-border/75 bg-gradient-to-b from-card to-card/95 shadow-[var(--shadow-card)]",
        highlighted && "border-primary/30 bg-gradient-to-br from-primary/12 via-card to-accent/12",
        className,
      )}
    >
      {children}
    </Surface>
  );
}
