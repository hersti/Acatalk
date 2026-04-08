import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BookMarked,
  ClipboardList,
  Download,
  ExternalLink,
  FileText,
  MessageSquare,
  RefreshCcw,
  ThumbsUp,
} from "lucide-react";

import type { Database, Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Surface } from "@/components/ui/surface";
import { StateBlock } from "@/components/ui/state-blocks";
import { buildPostDetailHref, resolveCourseTabFromContentType } from "@/lib/course-navigation";
import { extractPostDetailContext } from "@/lib/post-detail-context";
import { getFileTypeLabel } from "@/lib/content-renderer";

type ContentType = Database["public"]["Enums"]["content_type"];

type CourseSectionType = Extract<ContentType, "notes" | "past_exams" | "kaynaklar">;

type PostWithProfile = Tables<"posts"> & {
  profiles: Tables<"profiles"> | null;
};

type CourseAcademicContentSectionProps = {
  courseId: string;
  sectionType: CourseSectionType;
  posts: PostWithProfile[];
  loading: boolean;
  error: string | null;
  canAddContent: boolean;
  isLoggedIn: boolean;
  onCreate: () => void;
  onRetry: () => void;
};

const SECTION_META: Record<
  CourseSectionType,
  {
    label: string;
    helper: string;
    createLabel: string;
    emptyTitle: string;
    emptyDescription: string;
    icon: typeof FileText;
    iconClassName: string;
  }
> = {
  notes: {
    label: "Notlar",
    helper: "Ders materyalleri, özetler ve çalışma notları.",
    createLabel: "Not Ekle",
    emptyTitle: "Henüz not paylaşımı yok",
    emptyDescription: "Ders notları bu alanda arşivlenir. İlk not katkısını başlatabilirsiniz.",
    icon: FileText,
    iconClassName: "text-notes",
  },
  past_exams: {
    label: "Geçmiş Sınavlar",
    helper: "Vize, final ve quiz arşivi için doğrulanabilir sınav paylaşımları.",
    createLabel: "Geçmiş Sınav Ekle",
    emptyTitle: "Henüz geçmiş sınav yok",
    emptyDescription: "Sınav arşivini oluşturmak için yıl ve dönem bilgisiyle ilk sınavı ekleyin.",
    icon: ClipboardList,
    iconClassName: "text-exams",
  },
  kaynaklar: {
    label: "Kaynaklar",
    helper: "Kitap, makale, video ve bağlantı tabanlı ders referansları.",
    createLabel: "Kaynak Ekle",
    emptyTitle: "Henüz kaynak eklenmedi",
    emptyDescription: "Ders için faydalı referansları bu listede biriktirebilirsiniz.",
    icon: BookMarked,
    iconClassName: "text-kaynaklar",
  },
};

function parseResourceHost(value: string | null): string | null {
  if (!value) return null;
  try {
    const parsed = new URL(value);
    return parsed.host || null;
  } catch {
    return null;
  }
}

function hasExamSolutionSignal(post: PostWithProfile, parsedBody: string): boolean {
  if ((post.file_name || "").toLowerCase().includes("çöz") || (post.file_name || "").toLowerCase().includes("coz")) return true;
  return /\b(çözüm|cozum|solution)\b/i.test(parsedBody);
}

export default function CourseAcademicContentSection({
  courseId,
  sectionType,
  posts,
  loading,
  error,
  canAddContent,
  isLoggedIn,
  onCreate,
  onRetry,
}: CourseAcademicContentSectionProps) {
  const section = SECTION_META[sectionType];
  const SectionIcon = section.icon;

  return (
    <div className="space-y-3">
      <Surface variant="base" border="subtle" padding="md" radius="xl">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="flex items-center gap-1.5 font-heading text-sm font-bold">
              <SectionIcon className={`h-4 w-4 ${section.iconClassName}`} />
              {section.label}
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">{section.helper}</p>
          </div>
          {canAddContent ? (
            <Button size="sm" className="h-8" onClick={onCreate}>
              {section.createLabel}
            </Button>
          ) : null}
        </div>
      </Surface>

      {loading ? (
        <StateBlock variant="loading" size="section" title={`${section.label} yükleniyor`} description="Ders içerikleri hazırlanıyor." />
      ) : error ? (
        <StateBlock
          variant="error"
          size="section"
          title={`${section.label} listelenemedi`}
          description={error}
          primaryAction={
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onRetry}>
              <RefreshCcw className="h-3.5 w-3.5" />
              Tekrar Dene
            </Button>
          }
        />
      ) : posts.length === 0 ? (
        <StateBlock
          variant="empty"
          size="section"
          title={section.emptyTitle}
          description={
            isLoggedIn
              ? canAddContent
                ? section.emptyDescription
                : "Bu derse yalnızca kendi üniversitenizin öğrencileri katkı ekleyebilir."
              : `${section.emptyDescription} Katkı için giriş yapabilirsiniz.`
          }
          primaryAction={
            !isLoggedIn ? (
              <Button asChild size="sm" variant="outline">
                <Link to="/auth">Giriş Yap</Link>
              </Button>
            ) : canAddContent ? (
              <Button size="sm" onClick={onCreate}>
                {section.createLabel}
              </Button>
            ) : (
              <Button asChild size="sm" variant="outline">
                <Link to="/settings">Profili Düzenle</Link>
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-2.5">
          {posts.map((post) => {
            const parsed = extractPostDetailContext(post.content, post.content_type);
            const detailHref = buildPostDetailHref(post.id, {
              courseId,
              tab: resolveCourseTabFromContentType(post.content_type),
            });
            const authorName = post.is_anonymous ? "Anonim" : post.profiles?.username || "Kullanıcı";
            const authorInitial = authorName[0]?.toUpperCase() || "?";

            if (sectionType === "notes") {
              const fileLabel = getFileTypeLabel(post.file_name || "Not");
              return (
                <Link key={post.id} to={detailHref}>
                  <Surface className="transition-colors hover:border-primary/30" variant="raised" border="default" padding="md" radius="xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{post.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-md bg-secondary px-1.5 py-0.5">{fileLabel}</span>
                          <span>{formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}</span>
                          <span className="inline-flex items-center gap-1">
                            <Download className="h-3 w-3" /> {post.download_count ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3" /> {post.helpful_count ?? 0}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <MessageSquare className="h-3 w-3" /> {post.comment_count ?? 0}
                          </span>
                        </div>
                        {parsed.body ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{parsed.body}</p> : null}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">{authorInitial}</AvatarFallback>
                        </Avatar>
                        <span className="max-w-[90px] truncate text-[11px] font-medium text-muted-foreground">{authorName}</span>
                      </div>
                    </div>
                  </Surface>
                </Link>
              );
            }

            if (sectionType === "past_exams") {
              const hasSolution = hasExamSolutionSignal(post, parsed.body);
              return (
                <Link key={post.id} to={detailHref}>
                  <Surface className="transition-colors hover:border-primary/30" variant="raised" border="default" padding="md" radius="xl">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{post.title}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                          {parsed.pastExamMeta?.year ? <Badge variant="outline">Yıl: {parsed.pastExamMeta.year}</Badge> : null}
                          {parsed.pastExamMeta?.period ? <Badge variant="outline">Dönem: {parsed.pastExamMeta.period}</Badge> : null}
                          {hasSolution ? (
                            <Badge className="bg-primary/10 text-primary">Çözüm sinyali</Badge>
                          ) : (
                            <Badge variant="secondary">Soru arşivi</Badge>
                          )}
                          <span className="ml-1 text-muted-foreground">
                            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}
                          </span>
                        </div>
                        {parsed.body ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{parsed.body}</p> : null}
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] font-semibold text-foreground">{post.download_count ?? 0} indirme</p>
                        <p className="text-[11px] text-muted-foreground">{post.comment_count ?? 0} yorum</p>
                      </div>
                    </div>
                  </Surface>
                </Link>
              );
            }

            const resourceHost = parseResourceHost(parsed.resourceMeta?.url || null);

            return (
              <Link key={post.id} to={detailHref}>
                <Surface className="transition-colors hover:border-primary/30" variant="raised" border="default" padding="md" radius="xl">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">{post.title}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {parsed.resourceMeta?.resourceType ? <Badge variant="outline">{parsed.resourceMeta.resourceType}</Badge> : null}
                        {resourceHost ? <Badge variant="secondary">{resourceHost}</Badge> : null}
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: tr })}
                        </span>
                      </div>
                      {parsed.body ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{parsed.body}</p> : null}
                      {parsed.resourceMeta?.url ? (
                        <div className="mt-2">
                          <a
                            href={parsed.resourceMeta.url}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80"
                          >
                            <ExternalLink className="h-3 w-3" /> Kaynağı Aç
                          </a>
                        </div>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] font-semibold text-foreground">{post.helpful_count ?? 0} yararlı</p>
                      <p className="text-[11px] text-muted-foreground">{post.comment_count ?? 0} yorum</p>
                    </div>
                  </div>
                </Surface>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}