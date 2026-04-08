import type { Database } from "@/integrations/supabase/types";

type ContentType = Database["public"]["Enums"]["content_type"];

type PastExamMeta = {
  year: string | null;
  period: string | null;
};

type ResourceMeta = {
  url: string | null;
  resourceType: string | null;
};

export type PostDetailContext = {
  body: string;
  pastExamMeta: PastExamMeta | null;
  resourceMeta: ResourceMeta | null;
};

const EXAM_META_PATTERN = /^Yıl:\s*(.+?)\s*·\s*Dönem:\s*(.+)$/i;

function normalizeBody(lines: string[]): string {
  return lines.join("\n").trim();
}

export function extractPostDetailContext(content: string | null | undefined, contentType: ContentType): PostDetailContext {
  const raw = content?.trim() || "";
  if (!raw) {
    return {
      body: "",
      pastExamMeta: null,
      resourceMeta: null,
    };
  }

  const lines = raw.split("\n");

  if (contentType === "past_exams") {
    const firstLine = lines[0]?.trim() || "";
    const examMetaMatch = firstLine.match(EXAM_META_PATTERN);
    if (examMetaMatch) {
      const bodyLines = lines.slice(1).filter((line) => line.trim().length > 0);
      return {
        body: normalizeBody(bodyLines),
        pastExamMeta: {
          year: examMetaMatch[1]?.trim() || null,
          period: examMetaMatch[2]?.trim() || null,
        },
        resourceMeta: null,
      };
    }
  }

  if (contentType === "kaynaklar") {
    const firstLine = lines[0]?.trim() || "";
    const secondLine = lines[1]?.trim() || "";

    const hasLink = firstLine.toLowerCase().startsWith("bağlantı:");
    const hasResourceType = secondLine.toLowerCase().startsWith("kaynak türü:");

    if (hasLink || hasResourceType) {
      const url = hasLink ? firstLine.replace(/^Bağlantı:\s*/i, "").trim() : null;
      const resourceType = hasResourceType ? secondLine.replace(/^Kaynak Türü:\s*/i, "").trim() : null;
      const bodyLines = lines.slice(hasResourceType ? 2 : 1).filter((line) => line.trim().length > 0);

      return {
        body: normalizeBody(bodyLines),
        pastExamMeta: null,
        resourceMeta: {
          url: url || null,
          resourceType: resourceType || null,
        },
      };
    }
  }

  return {
    body: raw,
    pastExamMeta: null,
    resourceMeta: null,
  };
}