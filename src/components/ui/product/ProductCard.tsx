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
      padding="md"
      interactive={interactive}
      className={cn(
        "border-border/75 bg-gradient-to-b from-card to-card/95",
        highlighted && "border-primary/25 bg-gradient-to-br from-primary/10 via-card to-accent/10",
        className,
      )}
    >
      {children}
    </Surface>
  );
}
