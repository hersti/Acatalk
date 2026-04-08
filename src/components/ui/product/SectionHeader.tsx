import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type SectionHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, description, icon, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {icon ? <span className="text-primary/90">{icon}</span> : null}
          <h2 className="font-heading text-[0.96rem] font-extrabold tracking-tight sm:text-[1.02rem]">{title}</h2>
        </div>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
