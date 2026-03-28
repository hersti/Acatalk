import React from "react";

const URL_REGEX = /(https?:\/\/[^\s<>"')\]]+)/g;

/**
 * Render text content with clickable links, paragraph spacing, and safe rendering.
 * URLs become blue, underlined, clickable links that open in new tabs.
 */
export function renderContent(text: string): React.ReactNode[] {
  if (!text) return [];

  // Split into paragraphs first
  const paragraphs = text.split(/\n{2,}/);

  return paragraphs.map((paragraph, pi) => {
    // Split lines within a paragraph
    const lines = paragraph.split(/\n/);
    const lineElements = lines.map((line, li) => {
      const parts = line.split(URL_REGEX);
      const rendered = parts.map((part, i) => {
        if (URL_REGEX.test(part)) {
          URL_REGEX.lastIndex = 0; // reset regex state
          return (
            <a
              key={`${pi}-${li}-${i}`}
              href={part}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-primary underline underline-offset-2 hover:text-primary/80 break-all transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              {part.length > 80 ? part.slice(0, 77) + "..." : part}
            </a>
          );
        }
        return <span key={`${pi}-${li}-${i}`}>{part}</span>;
      });

      return (
        <React.Fragment key={`${pi}-${li}`}>
          {rendered}
          {li < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });

    return (
      <p key={pi} className={pi > 0 ? "mt-3" : ""}>
        {lineElements}
      </p>
    );
  });
}

/**
 * Extract all URLs from text content.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Get file extension from filename.
 */
export function getFileExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return ext;
}

/**
 * Get a human-readable file type label from extension.
 */
export function getFileTypeLabel(filename: string): string {
  const ext = getFileExtension(filename);
  const labels: Record<string, string> = {
    pdf: "PDF",
    doc: "Word",
    docx: "Word",
    ppt: "PowerPoint",
    pptx: "PowerPoint",
    xls: "Excel",
    xlsx: "Excel",
    txt: "Metin",
    zip: "ZIP",
    rar: "RAR",
    png: "Görsel",
    jpg: "Görsel",
    jpeg: "Görsel",
    gif: "GIF",
    webp: "Görsel",
    svg: "SVG",
  };
  return labels[ext] || ext.toUpperCase() || "Dosya";
}

/**
 * Get file type icon color class.
 */
export function getFileTypeColor(filename: string): string {
  const ext = getFileExtension(filename);
  const colors: Record<string, string> = {
    pdf: "text-destructive",
    doc: "text-primary",
    docx: "text-primary",
    ppt: "text-accent",
    pptx: "text-accent",
    xls: "text-success",
    xlsx: "text-success",
    txt: "text-muted-foreground",
    zip: "text-warning",
    rar: "text-warning",
    png: "text-info",
    jpg: "text-info",
    jpeg: "text-info",
  };
  return colors[ext] || "text-primary";
}

/**
 * Format file size in human-readable form.
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
