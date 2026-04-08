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
        "relative w-full rounded-xl border px-3 py-3 text-left transition-all",
        active
          ? "border-primary/45 bg-gradient-to-r from-primary/12 to-card shadow-[var(--shadow-soft)] ring-1 ring-primary/20"
          : "border-border/60 bg-card hover:border-primary/25 hover:bg-background",
        className,
      )}
    >
      {active ? <span className="absolute inset-y-2 left-0.5 w-1 rounded-full bg-primary/75" /> : null}
      {children}
    </button>
  );
}
