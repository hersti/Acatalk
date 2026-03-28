import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Award, Upload, MessageSquare, CheckCircle, ThumbsUp, Trophy,
  Activity, MessageCircle, FileText, BookOpen, Bookmark
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  upload: Upload,
  "message-square": MessageSquare,
  "check-circle": CheckCircle,
  "thumbs-up": ThumbsUp,
  trophy: Trophy,
  activity: Activity,
  "message-circle": MessageCircle,
  award: Award,
  "file-text": FileText,
  "book-open": BookOpen,
  bookmark: Bookmark,
};

const CATEGORY_COLORS: Record<string, string> = {
  contribution: "text-primary bg-primary/10",
  community: "text-accent bg-accent/10",
  academic: "text-notes bg-notes/10",
};

interface BadgeDisplayProps {
  badges: Array<{
    badge: {
      key: string;
      name: string;
      description: string;
      category: string;
      icon: string;
    };
    earned_at: string;
  }>;
  maxShow?: number;
  size?: "xs" | "sm" | "md";
}

export default function BadgeDisplay({ badges, maxShow = 5, size = "sm" }: BadgeDisplayProps) {
  if (!badges.length) return null;

  const displayed = badges.slice(0, maxShow);
  const remaining = badges.length - maxShow;
  const iconSize = size === "xs" ? "h-2.5 w-2.5" : size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const containerSize = size === "xs" ? "h-4 w-4" : size === "sm" ? "h-5 w-5" : "h-7 w-7";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {displayed.map((ub) => {
        const Icon = ICON_MAP[ub.badge.icon] || Award;
        const colorClass = CATEGORY_COLORS[ub.badge.category] || "text-muted-foreground bg-muted";
        return (
          <Tooltip key={ub.badge.key}>
            <TooltipTrigger asChild>
              <div className={`${containerSize} rounded-full flex items-center justify-center ${colorClass} cursor-help`}>
                <Icon className={iconSize} />
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs font-bold">{ub.badge.name}</p>
              <p className="text-[10px] text-muted-foreground">{ub.badge.description}</p>
            </TooltipContent>
          </Tooltip>
        );
      })}
      {remaining > 0 && (
        <span className="text-[10px] text-muted-foreground font-medium">+{remaining}</span>
      )}
    </div>
  );
}
