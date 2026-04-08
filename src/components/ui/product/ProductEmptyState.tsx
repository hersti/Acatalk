import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ProductCard } from "@/components/ui/product/ProductCard";
import { cn } from "@/lib/utils";

type ProductEmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  actionNode?: ReactNode;
  className?: string;
};

export function ProductEmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionNode,
  className,
}: ProductEmptyStateProps) {
  return (
    <ProductCard highlighted className={cn("mx-auto max-w-md p-6 text-center", className)}>
      <div className="mx-auto mb-3.5 flex h-14 w-14 items-center justify-center rounded-xl border border-border/80 bg-gradient-to-b from-secondary to-background text-muted-foreground shadow-[var(--shadow-soft)]">
        <span className="text-primary/80">{icon}</span>
      </div>
      <h3 className="font-heading text-lg font-bold tracking-tight">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      {actionNode ? (
        <div className="mt-3.5">{actionNode}</div>
      ) : actionLabel && onAction ? (
        <Button size="sm" className="mt-3.5" onClick={onAction}>
          {actionLabel}
        </Button>
      ) : null}
    </ProductCard>
  );
}
