import type { ReactNode } from "react";

import { ProductCard } from "@/components/ui/product/ProductCard";
import { cn } from "@/lib/utils";

type MetricCardProps = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
};

export function MetricCard({ label, value, icon, trend, trendPositive = true, className }: MetricCardProps) {
  return (
    <ProductCard className={cn("p-3.5 sm:p-4", className)}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
        {icon ? <span className="text-primary/90">{icon}</span> : null}
      </div>
      <div className="flex items-end gap-1.5">
        <p className="font-heading text-[1.6rem] font-extrabold tracking-tight text-foreground">{value}</p>
        {trend ? (
          <span className={cn("text-xs font-semibold", trendPositive ? "text-emerald-600" : "text-destructive")}>{trend}</span>
        ) : null}
      </div>
    </ProductCard>
  );
}
