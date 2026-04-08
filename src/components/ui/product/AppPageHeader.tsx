import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Surface } from "@/components/ui/surface";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";

type AppPageHeaderProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  actions?: ReactNode;
  tabs?: ReactNode;
  search?: {
    value: string;
    onChange: (next: string) => void;
    placeholder?: string;
  };
  className?: string;
};

export function AppPageHeader({ title, description, icon, actions, tabs, search, className }: AppPageHeaderProps) {
  return (
    <Surface variant="panel" border="subtle" radius="xl" padding="none" className={cn("overflow-hidden", className)}>
      <div className="h-1.5 bg-gradient-to-r from-primary/80 via-primary/40 to-accent/60" />
      <div className="border-b border-border/70 bg-gradient-to-b from-card to-card/95 px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {icon ? <div className="mt-0.5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-[var(--shadow-soft)]">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-2xl font-extrabold tracking-tight text-foreground sm:text-[2rem]">{title}</h1>
            {description ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
          {actions ? <div className="hidden shrink-0 items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-1.5 sm:flex">{actions}</div> : null}
        </div>

        {actions ? <div className="mt-3 flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 p-1.5 sm:hidden">{actions}</div> : null}

        {search ? (
          <div className="mt-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search.value}
                onChange={(event) => search.onChange(event.target.value)}
                placeholder={search.placeholder || "Ara..."}
                className="h-10 rounded-xl border-transparent bg-secondary/70 pl-10 focus:border-border focus:bg-background"
              />
            </div>
          </div>
        ) : null}
      </div>

      {tabs ? <div className="bg-card px-5 py-3 sm:px-6">{tabs}</div> : null}
    </Surface>
  );
}
