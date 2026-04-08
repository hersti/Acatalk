import type { ReactNode } from "react";

import { MetricCard } from "@/components/ui/product/MetricCard";

type PageMetric = {
  label: string;
  value: string | number;
  icon?: ReactNode;
  trend?: string;
  trendPositive?: boolean;
};

type PageMetricsRowProps = {
  items: PageMetric[];
};

export function PageMetricsRow({ items }: PageMetricsRowProps) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <MetricCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          trend={item.trend}
          trendPositive={item.trendPositive}
        />
      ))}
    </div>
  );
}
