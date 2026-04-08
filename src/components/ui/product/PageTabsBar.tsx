import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageTabsBarItem = {
  key: string;
  label: string;
  count?: number;
  icon?: ReactNode;
};

type PageTabsBarProps = {
  items: PageTabsBarItem[];
  value: string;
  onChange: (next: string) => void;
  className?: string;
};

export function PageTabsBar({ items, value, onChange, className }: PageTabsBarProps) {
  return (
    <div className={cn("rounded-xl border border-border/70 bg-secondary/40 p-1", className)}>
      <div className="flex flex-wrap items-center gap-1">
        {items.map((item) => {
          const isActive = item.key === value;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onChange(item.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                isActive
                  ? "bg-primary text-primary-foreground shadow-[var(--shadow-soft)]"
                  : "text-muted-foreground hover:bg-background hover:text-foreground",
              )}
            >
              {item.icon}
              <span>{item.label}</span>
              {typeof item.count === "number" ? (
                <span
                  className={cn(
                    "inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                    isActive ? "bg-primary-foreground/20" : "bg-background text-foreground",
                  )}
                >
                  {item.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
