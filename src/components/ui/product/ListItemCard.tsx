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
        "w-full rounded-xl border px-3 py-3 text-left transition-all",
        active ? "border-primary/35 bg-primary/10 shadow-sm" : "border-border/60 bg-card hover:border-primary/20 hover:bg-background",
        className,
      )}
    >
      {children}
    </button>
  );
}
