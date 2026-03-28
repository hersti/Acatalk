/**
 * Input sanitization utilities for XSS protection.
 */

const DANGEROUS_TAGS = /<\s*(script|iframe|object|embed|form|style|link|meta|base)[^>]*>/gi;
const EVENT_HANDLERS = /\s*on\w+\s*=\s*(['"])[^'"]*\1/gi;
const JAVASCRIPT_URLS = /javascript\s*:/gi;
const DATA_URLS = /data\s*:\s*text\/html/gi;

/**
 * Strip dangerous HTML elements and attributes from user input.
 * For use before rendering or storing user-generated content.
 */
export function sanitizeInput(input: string): string {
  if (!input) return input;
  
  return input
    .replace(DANGEROUS_TAGS, "")
    .replace(EVENT_HANDLERS, "")
    .replace(JAVASCRIPT_URLS, "")
    .replace(DATA_URLS, "");
}

/**
 * Escape HTML entities for safe rendering in text contexts.
 */
export function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return str.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Validate and sanitize a URL - only allow http(s) and relative URLs.
 */
export function sanitizeUrl(url: string): string {
  const trimmed = url.trim();
  if (/^(https?:\/\/|\/)/i.test(trimmed)) return trimmed;
  return "";
}
