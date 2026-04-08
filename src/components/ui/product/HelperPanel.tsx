import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HelperPanelProps = {
  children: ReactNode;
  className?: string;
};

export function HelperPanel({ children, className }: HelperPanelProps) {
  return <div className={cn("h-full space-y-2.5 overflow-y-auto bg-card p-3.5 sm:p-4", className)}>{children}</div>;
}
