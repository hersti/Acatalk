import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

type SplitViewLayoutProps = {
  left: ReactNode;
  main: ReactNode;
  right?: ReactNode;
  leftWidth?: number;
  rightWidth?: number;
  className?: string;
};

export function SplitViewLayout({
  left,
  main,
  right,
  leftWidth = 320,
  rightWidth = 320,
  className,
}: SplitViewLayoutProps) {
  const splitStyle = {
    ["--split-left" as string]: `${leftWidth}px`,
    ["--split-right" as string]: `${rightWidth}px`,
  } as CSSProperties;

  return (
    <div
      className={cn(
        "grid h-full min-h-[640px] grid-cols-1 overflow-hidden rounded-2xl border border-border/80 bg-background shadow-[var(--shadow-card)]",
        right
          ? "lg:[grid-template-columns:var(--split-left)_minmax(0,1fr)_var(--split-right)]"
          : "lg:[grid-template-columns:var(--split-left)_minmax(0,1fr)]",
        className,
      )}
      style={splitStyle}
    >
      <aside className="min-h-0 border-b border-border/70 bg-card lg:border-b-0 lg:border-r">{left}</aside>
      <section className={cn("min-h-0 bg-muted/20", right && "lg:border-r lg:border-border/70")}>{main}</section>
      {right ? <aside className="min-h-0 border-t border-border/70 bg-card lg:border-t-0">{right}</aside> : null}
    </div>
  );
}
