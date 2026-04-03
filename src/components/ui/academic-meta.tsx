import * as React from "react";
import {
  BadgeCheck,
  BookOpenText,
  Building2,
  GraduationCap,
  LibraryBig,
  School,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type AcademicMetaItemKind =
  | "university"
  | "department"
  | "program"
  | "verified"
  | "contentType"
  | "semester"
  | "custom";

export type AcademicMetaItem = {
  kind: AcademicMetaItemKind;
  label: string;
  value?: string;
  icon?: React.ReactNode;
  emphasis?: "default" | "subtle";
};

export type AcademicMetaProps = {
  items?: AcademicMetaItem[];
  university?: string;
  department?: string;
  program?: string;
  semester?: string;
  contentType?: "discussion" | "note" | "exam" | "resource";
  isVerified?: boolean;
  size?: "sm" | "md";
  tone?: "default" | "muted";
  wrap?: boolean;
  className?: string;
};

const CONTENT_TYPE_LABELS: Record<NonNullable<AcademicMetaProps["contentType"]>, string> = {
  discussion: "Tartışma",
  note: "Not",
  exam: "Çıkmış Soru",
  resource: "Kaynak",
};

const KIND_ICON_MAP: Partial<Record<AcademicMetaItemKind, LucideIcon>> = {
  university: Building2,
  department: GraduationCap,
  program: School,
  verified: BadgeCheck,
  contentType: BookOpenText,
  semester: LibraryBig,
};

function buildItemsFromShortcuts(props: AcademicMetaProps): AcademicMetaItem[] {
  const generated: AcademicMetaItem[] = [];

  if (props.university) {
    generated.push({ kind: "university", label: "Üniversite", value: props.university });
  }

  if (props.department) {
    generated.push({ kind: "department", label: "Bölüm", value: props.department });
  }

  if (props.program) {
    generated.push({ kind: "program", label: "Program", value: props.program });
  }

  if (props.semester) {
    generated.push({ kind: "semester", label: "Dönem", value: props.semester });
  }

  if (props.contentType) {
    generated.push({
      kind: "contentType",
      label: "İçerik",
      value: CONTENT_TYPE_LABELS[props.contentType],
    });
  }

  if (props.isVerified) {
    generated.push({
      kind: "verified",
      label: "Doğrulanmış Öğrenci",
      emphasis: "default",
    });
  }

  return generated;
}

function renderItemIcon(item: AcademicMetaItem, size: "sm" | "md") {
  if (item.icon) return item.icon;

  const Icon = KIND_ICON_MAP[item.kind];
  if (!Icon) return null;

  return <Icon className={cn("shrink-0 opacity-80", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />;
}

export function AcademicMeta({
  items,
  university,
  department,
  program,
  semester,
  contentType,
  isVerified,
  size = "sm",
  tone = "default",
  wrap = true,
  className,
}: AcademicMetaProps) {
  const resolvedItems = React.useMemo(() => {
    if (items && items.length > 0) return items;

    return buildItemsFromShortcuts({
      university,
      department,
      program,
      semester,
      contentType,
      isVerified,
    });
  }, [contentType, department, isVerified, items, program, semester, university]);

  if (resolvedItems.length === 0) return null;

  const containerClass = cn(
    "flex items-center gap-2",
    wrap ? "flex-wrap" : "overflow-x-auto whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
    className,
  );

  const itemClass = cn(
    "inline-flex items-center gap-1.5 rounded-full border leading-none",
    size === "sm" ? "h-6 px-2.5 text-[11px]" : "h-7 px-3 text-xs",
    tone === "muted" ? "border-border/60 bg-muted/40 text-muted-foreground" : "border-border/70 bg-secondary/55 text-foreground/80",
    !wrap && "shrink-0",
  );

  return (
    <div className={containerClass}>
      {resolvedItems.map((item, index) => {
        const iconNode = renderItemIcon(item, size);
        const key = `${item.kind}-${item.label}-${item.value ?? ""}-${index}`;

        return (
          <span
            key={key}
            className={cn(
              itemClass,
              item.emphasis === "default" && "font-medium text-foreground/95",
              item.emphasis === "subtle" && "font-normal",
            )}
          >
            {iconNode ? <span aria-hidden="true">{iconNode}</span> : null}
            <span className="opacity-90">{item.label}</span>
            {item.value ? <span className="opacity-55" aria-hidden="true">·</span> : null}
            {item.value ? <span className="text-foreground">{item.value}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

