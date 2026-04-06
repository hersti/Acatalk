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
  posts,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  sort,
  onSortChange,
  filterType,
  onFilterChange,
}: DiscussionListProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tartışmalarda ara..."
          className="h-8 border-transparent bg-secondary/50 pl-8 text-xs"
        />
      </div>

      <div className="flex gap-2">
        <Select value={sort} onValueChange={onSortChange}>
          <SelectTrigger className="h-7 flex-1 rounded-lg border-transparent bg-secondary/50 text-[11px]">
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
          <SelectTrigger className="h-7 flex-1 rounded-lg border-transparent bg-secondary/50 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DISCUSSION_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <ScrollArea className="max-h-[520px]">
        <div className="space-y-1.5 pr-1">
          {loading ? (
            <div className="py-10 text-center">
              <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : posts.length === 0 ? (
            <div className="px-4 py-10 text-center">
              <MessageCircle className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
              <p className="text-sm font-medium text-muted-foreground">Tartışma bulunamadı</p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                Filtreleri sadeleştirin veya bu ders için yeni bir akademik tartışma başlatın.
              </p>
            </div>
          ) : (
            posts.map((post) => {
              const discussionType = post.discussion_type;
              const solved = post.is_solved;
              const pinned = post.is_pinned;
              const isSelected = post.id === selectedId;
              const displayName = post.is_anonymous ? "Anonim" : post.profiles?.username || "Anonim";
              const initial = displayName[0]?.toUpperCase() || "?";

              return (
                <button
                  key={post.id}
                  onClick={() => onSelect(post.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-all duration-150 ${
                    isSelected
                      ? "border-primary/25 bg-primary/10 shadow-sm"
                      : pinned
                        ? "border-primary/10 bg-primary/[0.03] hover:bg-primary/[0.06]"
                        : "border-transparent bg-card hover:bg-secondary/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <div
                      className={`flex min-w-[36px] flex-col items-center justify-center rounded-lg py-1 text-center ${
                        (post.helpful_count ?? 0) > 0 ? "bg-primary/10" : "bg-secondary/60"
                      }`}
                    >
                      <ChevronUp className={`h-3 w-3 ${(post.helpful_count ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`} />
                      <span className={`text-xs font-bold ${(post.helpful_count ?? 0) > 0 ? "text-primary" : "text-muted-foreground"}`}>
                        {post.helpful_count ?? 0}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center gap-1.5">
                        {pinned && (
                          <span className="flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                            <Pin className="h-2.5 w-2.5" /> Sabit
                          </span>
                        )}
                        {solved && (
                          <span className="flex items-center gap-0.5 rounded-md bg-success/10 px-1.5 py-0.5 text-[10px] font-bold text-success">
                            <CheckCircle2 className="h-2.5 w-2.5" /> Çözüldü
                          </span>
                        )}
                        {discussionType && typeLabels[discussionType] && (
                          <span
                            className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                              typeBadgeColor[discussionType] || "bg-secondary text-muted-foreground"
                            }`}
                          >
                            {typeLabels[discussionType]}
                          </span>
                        )}
                      </div>

                      <p className="line-clamp-2 text-[13px] font-semibold leading-snug">{post.title}</p>

                      {post.content && <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-muted-foreground">{post.content}</p>}

                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {post.is_anonymous ? (
                            <EyeOff className="h-3 w-3" />
                          ) : (
                            <Avatar className="h-3.5 w-3.5">
                              <AvatarFallback className="bg-primary/10 text-[7px] font-bold text-primary">{initial}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="max-w-[80px] truncate font-medium">{displayName}</span>
                        </div>
                        <span className="text-muted-foreground/50">.</span>
                        <span className="flex items-center gap-0.5">
                          <MessageCircle className="h-3 w-3" />
                          {post.comment_count ?? 0}
                        </span>
                        <span className="ml-auto text-[10px]">{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}</span>
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
