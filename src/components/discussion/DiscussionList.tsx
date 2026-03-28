import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChevronUp, MessageCircle, CheckCircle2, Pin, Search, EyeOff } from "lucide-react";
import { DISCUSSION_TYPES, type DiscussionPost } from "./DiscussionPanel";

const typeLabels: Record<string, string> = {
  soru: "Soru",
  sinav: "Sınav",
  kaynak: "Kaynak",
  hoca: "Hoca",
  not_sorusu: "Not",
};

const typeBadgeColor: Record<string, string> = {
  soru: "bg-primary/10 text-primary",
  sinav: "bg-accent/10 text-accent",
  kaynak: "content-badge-kaynaklar",
  hoca: "content-badge-notes",
  not_sorusu: "content-badge-exams",
};

interface DiscussionListProps {
  posts: DiscussionPost[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  search: string;
  onSearchChange: (v: string) => void;
  sort: string;
  onSortChange: (v: string) => void;
  filterType: string;
  onFilterChange: (v: string) => void;
}

export default function DiscussionList({
  posts, loading, selectedId, onSelect,
  search, onSearchChange, sort, onSortChange,
  filterType, onFilterChange,
}: DiscussionListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tartışmalarda ara..."
          className="pl-8 h-8 text-xs bg-secondary/50 border-transparent"
        />
      </div>

      <div className="flex gap-2">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="h-7 text-[11px] flex-1 bg-secondary/50 border-transparent rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">En Yeni</SelectItem>
            <SelectItem value="most_voted">En Çok Oy</SelectItem>
            <SelectItem value="most_replied">En Çok Yanıt</SelectItem>
            <SelectItem value="solved">Çözülenler</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterType} onValueChange={onFilterChange}>
          <SelectTrigger className="h-7 text-[11px] flex-1 bg-secondary/50 border-transparent rounded-lg">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISCUSSION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="max-h-[520px]">
        <div className="space-y-1.5 pr-1">
          {loading ? (
            <div className="text-center py-10">
              <div className="inline-block h-5 w-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-10 px-4">
              <MessageCircle className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Tartışma bulunamadı</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Arama veya filtreleri değiştirmeyi deneyin.
              </p>
            </div>
          ) : (
            posts.map((post) => {
              const dt = (post as any).discussion_type;
              const solved = (post as any).is_solved;
              const pinned = (post as any).is_pinned;
              const isSelected = post.id === selectedId;
              const displayName = post.is_anonymous ? "Anonim" : (post.profiles?.username || "Anonim");
              const initial = displayName[0]?.toUpperCase() || "?";
              return (
                <button
                  key={post.id}
                  onClick={() => onSelect(post.id)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-150 ${
                    isSelected
                      ? "bg-primary/10 border border-primary/25 shadow-sm"
                      : pinned
                        ? "bg-primary/[0.03] border border-primary/10 hover:bg-primary/[0.06]"
                        : "bg-card hover:bg-secondary/50 border border-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`flex flex-col items-center justify-center min-w-[36px] py-1 rounded-lg text-center ${
                      (post.helpful_count ?? 0) > 0 ? "bg-primary/10" : "bg-secondary/60"
                    }`}>
                      <ChevronUp className={`h-3 w-3 ${(post.helpful_count ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-bold ${(post.helpful_count ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {post.helpful_count ?? 0}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        {pinned && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-md">
                            <Pin className="h-2.5 w-2.5" /> Sabit
                          </span>
                        )}
                        {solved && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-md">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Çözüldü
                          </span>
                        )}
                        {dt && typeLabels[dt] && (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${typeBadgeColor[dt] || "bg-secondary text-muted-foreground"}`}>
                            {typeLabels[dt]}
                          </span>
                        )}
                      </div>

                      <p className="text-[13px] font-semibold leading-snug line-clamp-2">{post.title}</p>

                      {post.content && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5 leading-relaxed">{post.content}</p>
                      )}

                      <div className="flex items-center gap-2 mt-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {post.is_anonymous ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Avatar className="h-3.5 w-3.5">
                              <AvatarFallback className="text-[7px] font-bold bg-primary/10 text-primary">{initial}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium truncate max-w-[80px]">{displayName}</span>
                        </div>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="h-3 w-3" />
                          {post.comment_count ?? 0}
                        </span>
                        <span className="ml-auto text-[10px]">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
