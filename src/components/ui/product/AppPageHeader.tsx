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
      <div className="border-b border-border/70 bg-card px-5 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {icon ? <div className="mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div> : null}
          <div className="min-w-0 flex-1">
            <h1 className="font-heading text-xl font-extrabold tracking-tight sm:text-2xl">{title}</h1>
            {description ? <p className="mt-1 max-w-3xl text-xs text-muted-foreground sm:text-sm">{description}</p> : null}
          </div>
          {actions ? <div className="hidden shrink-0 items-center gap-2 sm:flex">{actions}</div> : null}
        </div>

        {actions ? <div className="mt-3 flex items-center gap-2 sm:hidden">{actions}</div> : null}

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
