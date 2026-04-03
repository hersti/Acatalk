import * as React from "react";
import {
  AlertTriangle,
  Ban,
  Box,
  Loader2,
  SearchX,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

export type StateBlockVariant =
  | "loading"
  | "empty"
  | "noResults"
  | "error"
  | "offline"
  | "forbidden";

export type StateBlockSize = "inline" | "section" | "page";

export type StateBlockProps = {
  variant: StateBlockVariant;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  primaryAction?: React.ReactNode;
  secondaryAction?: React.ReactNode;
  size?: StateBlockSize;
  className?: string;
};

const stateBlockVariants = cva(
  "flex w-full flex-col items-center justify-center rounded-lg border border-dashed text-center",
  {
    variants: {
      variant: {
        loading: "border-border bg-card text-muted-foreground",
        empty: "border-border bg-card text-muted-foreground",
        noResults: "border-border bg-card text-muted-foreground",
        error: "border-destructive/35 bg-destructive/5 text-foreground",
        offline: "border-warning/35 bg-warning/10 text-foreground",
        forbidden: "border-border/90 bg-secondary/50 text-foreground",
      },
      size: {
        inline: "min-h-[140px] gap-2 p-4",
        section: "min-h-[220px] gap-3 p-8",
        page: "min-h-[48vh] gap-3 p-10",
      },
    },
    defaultVariants: {
      variant: "empty",
      size: "section",
    },
  },
);

const iconToneVariants = cva(
  "flex items-center justify-center rounded-full border",
  {
    variants: {
      variant: {
        loading: "border-border bg-secondary/60 text-muted-foreground",
        empty: "border-border bg-secondary/60 text-muted-foreground",
        noResults: "border-border bg-secondary/60 text-muted-foreground",
        error: "border-destructive/30 bg-destructive/10 text-destructive",
        offline: "border-warning/30 bg-warning/20 text-warning-foreground",
        forbidden: "border-border bg-muted text-muted-foreground",
      },
      size: {
        inline: "h-9 w-9",
        section: "h-11 w-11",
        page: "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "empty",
      size: "section",
    },
  },
);

const DEFAULT_TEXT: Record<StateBlockVariant, { title: string; description: string }> = {
  loading: {
    title: "Yükleniyor",
    description: "İçerik hazırlanıyor, lütfen bekleyin.",
  },
  empty: {
    title: "Henüz içerik yok",
    description: "Bu alanda gösterilecek bir içerik bulunamadı.",
  },
  noResults: {
    title: "Sonuç bulunamadı",
    description: "Arama veya filtre kriterlerini güncelleyip tekrar deneyin.",
  },
  error: {
    title: "Bir sorun oluştu",
    description: "İşlem tamamlanamadı. Lütfen tekrar deneyin.",
  },
  offline: {
    title: "Bağlantı problemi",
    description: "İnternet bağlantınızı kontrol edip yeniden deneyin.",
  },
  forbidden: {
    title: "Bu alana erişiminiz yok",
    description: "Bu içerik için yetki gerekli olabilir.",
  },
};

const ICON_MAP: Record<StateBlockVariant, LucideIcon> = {
  loading: Loader2,
  empty: Box,
  noResults: SearchX,
  error: AlertTriangle,
  offline: WifiOff,
  forbidden: Ban,
};

export function StateBlock({
  variant,
  title,
  description,
  icon,
  primaryAction,
  secondaryAction,
  size = "section",
  className,
}: StateBlockProps) {
  const fallbackText = DEFAULT_TEXT[variant];
  const Icon = ICON_MAP[variant];

  return (
    <section
      className={cn(stateBlockVariants({ variant, size }), className)}
      aria-live={variant === "loading" ? "polite" : "off"}
    >
      <div className={iconToneVariants({ variant, size })} aria-hidden="true">
        {icon ?? (
          <Icon
            className={cn(
              size === "inline" ? "h-4 w-4" : "h-5 w-5",
              variant === "loading" && "animate-spin",
            )}
          />
        )}
      </div>

      <div className="max-w-xl space-y-1">
        <p className={cn("font-semibold tracking-tight", size === "inline" ? "text-sm" : "text-base")}>
          {title ?? fallbackText.title}
        </p>
        <p className={cn("text-muted-foreground", size === "inline" ? "text-xs" : "text-sm")}>
          {description ?? fallbackText.description}
        </p>
      </div>

      {(primaryAction || secondaryAction) ? (
        <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
          {primaryAction}
          {secondaryAction}
        </div>
      ) : null}
    </section>
  );
}

type StateBlockPresetProps = Omit<StateBlockProps, "variant">;

export function LoadingBlock(props: StateBlockPresetProps) {
  return <StateBlock variant="loading" {...props} />;
}

export function EmptyBlock(props: StateBlockPresetProps) {
  return <StateBlock variant="empty" {...props} />;
}

export function NoResultsBlock(props: StateBlockPresetProps) {
  return <StateBlock variant="noResults" {...props} />;
}

export function ErrorBlock(props: StateBlockPresetProps) {
  return <StateBlock variant="error" {...props} />;
}
