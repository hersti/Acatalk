import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ListItemCardProps = {
  children: ReactNode;
  active?: boolean;
  onClick?: () => void;
  className?: string;
};

export function ListItemCard({ children, active = false, onClick, className }: ListItemCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-xl border px-3 py-2.5 text-left transition-all",
        active
          ? "border-primary/55 bg-gradient-to-r from-primary/15 via-primary/6 to-card shadow-[var(--shadow-card)] ring-1 ring-primary/30"
          : "border-border/70 bg-card hover:border-primary/30 hover:bg-background/95 hover:shadow-[var(--shadow-soft)]",
        className,
      )}
    >
      {active ? <span className="absolute inset-y-2 left-0.5 w-1 rounded-full bg-primary/85" /> : null}
      {children}
    </button>
  );
}
