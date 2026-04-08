import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type HelperPanelProps = {
  children: ReactNode;
  className?: string;
};

export function HelperPanel({ children, className }: HelperPanelProps) {
  return <div className={cn("h-full space-y-3 overflow-y-auto bg-card p-4 sm:p-5", className)}>{children}</div>;
}
