import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

export type SurfaceVariant = "base" | "raised" | "soft" | "outline" | "ghost" | "panel" | "helper";
export type SurfacePadding = "none" | "sm" | "md" | "lg";
export type SurfaceRadius = "sm" | "md" | "lg" | "xl";
export type SurfaceBorder = "none" | "subtle" | "default";

const surfaceVariants = cva(
  "w-full text-card-foreground",
  {
    variants: {
      variant: {
        base: "bg-card [box-shadow:var(--shadow-soft)]",
        raised: "bg-card [box-shadow:var(--shadow-card)]",
        soft: "bg-secondary/55 [box-shadow:var(--shadow-panel)]",
        panel: "bg-card/95 [box-shadow:var(--shadow-card)]",
        helper: "bg-card [box-shadow:var(--shadow-elevated)]",
        outline: "bg-card shadow-none",
        ghost: "bg-transparent shadow-none",
      },
      padding: {
        none: "p-0",
        sm: "p-3",
        md: "p-4",
        lg: "p-6",
      },
      radius: {
        sm: "rounded-sm",
        md: "rounded-md",
        lg: "rounded-lg",
        xl: "rounded-xl",
      },
      border: {
        none: "border border-transparent",
        subtle: "border border-border/70",
        default: "border border-border",
      },
      interactive: {
        true: "transition-[background-color,border-color,box-shadow] duration-150 hover:border-border/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        false: "",
      },
    },
    defaultVariants: {
      variant: "base",
      padding: "md",
      radius: "lg",
      border: "default",
      interactive: false,
    },
  },
);

export interface SurfaceProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof surfaceVariants> {
  asChild?: boolean;
}

const Surface = React.forwardRef<HTMLDivElement, SurfaceProps>(
  (
    {
      className,
      variant = "base",
      padding = "md",
      radius = "lg",
      border = "default",
      interactive = false,
      asChild = false,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "div";

    return (
      <Comp
        ref={ref}
        className={cn(surfaceVariants({ variant, padding, radius, border, interactive }), className)}
        {...props}
      />
    );
  },
);
Surface.displayName = "Surface";

export { Surface, surfaceVariants };

