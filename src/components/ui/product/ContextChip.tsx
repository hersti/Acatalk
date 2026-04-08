import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ContextChipProps = {
  icon?: ReactNode;
  label: string;
  value?: string;
  className?: string;
};

export function ContextChip({ icon, label, value, className }: ContextChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-secondary/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground",
        className,
      )}
    >
      {icon}
      <span>{label}</span>
      {value ? <span className="font-semibold text-foreground">{value}</span> : null}
    </span>
  );
}
