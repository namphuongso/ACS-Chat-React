import type { LinkPreview } from '../types/message.types';

/**
 * Matches http(s) URLs and www.-prefixed URLs inside plain text.
 * Excludes whitespace and quote characters so URLs embedded in HTML attributes
 * are not matched past their boundaries.
 */
export const URL_REGEX = /(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi;

const HTML_ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/**
 * Normalizes a raw URL match:
 * - trims surrounding whitespace
 * - strips trailing sentence punctuation (e.g. "Check this: https://a.com!")
 * - balances trailing parentheses (e.g. Wikipedia style URLs)
 * - prefixes bare www. URLs with https://
 * Returns an empty string when the result is not a valid URL.
 */
export function normalizeUrl(raw: string): string {
  let url = (raw || '').trim();
  if (!url) return '';

  // Alternately strip trailing punctuation and unbalanced ')' so that
  // parenthesized URLs (e.g. https://en.wikipedia.org/wiki/Chat_(app)) survive.
  let previous = '';
  while (url !== previous) {
    previous = url;
    url = url.replace(/[.,;:!?\]»]+$/, '');
    if (url.endsWith(')')) {
      const openCount = (url.match(/\(/g) || []).length;
      const closeCount = (url.match(/\)/g) || []).length;
      if (closeCount > openCount) {
        url = url.slice(0, -1);
      }
    }
  }

  if (!url) return '';
  if (!/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }

  try {
    // Validate the URL; also rejects protocol-relative garbage
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

/**
 * Extracts unique normalized http(s) URLs from a plain text string, in order.
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  const matches = text.match(URL_REGEX) || [];
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const match of matches) {
    const url = normalizeUrl(match);
    if (url && !seen.has(url)) {
      seen.add(url);
      urls.push(url);
    }
  }
  return urls;
}

/**
 * Returns true when the text contains at least one http(s) URL.
 */
export function containsUrl(text: string): boolean {
  if (!text) return false;
  URL_REGEX.lastIndex = 0;
  return URL_REGEX.test(text);
}

/**
 * Escapes a string for safe interpolation into HTML.
 */
export function escapeHtml(text: string): string {
  if (!text) return '';
  return text.replace(/[&<>"']/g, (ch) => HTML_ESCAPE_MAP[ch] || ch);
}

/**
 * Converts plain text into HTML where every detected URL is wrapped in an
 * anchor tag (<a href target="_blank" rel="noopener noreferrer">).
 * All text (including URLs) is HTML-escaped, so the output is safe to render.
 */
export function linkifyHtml(text: string): string {
  if (!text) return '';
  let result = '';
  let lastIndex = 0;
  const regex = new RegExp(URL_REGEX.source, 'gi');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    result += escapeHtml(text.slice(lastIndex, match.index));
    const rawMatch = match[0];
    const href = normalizeUrl(rawMatch);
    if (href) {
      result += `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(rawMatch)}</a>`;
    } else {
      result += escapeHtml(rawMatch);
    }
    lastIndex = match.index + rawMatch.length;
  }
  result += escapeHtml(text.slice(lastIndex));
  return result;
}

/**
 * Extracts plain text from an HTML string and returns the URLs it contains.
 * Falls back to stripping tags when no DOM is available.
 */
export function extractUrlsFromHtml(html: string): string[] {
  if (!html) return [];
  let text: string;
  if (typeof document !== 'undefined') {
    const container = document.createElement('div');
    container.innerHTML = html;

    // Walk text nodes, inserting whitespace at element boundaries so adjacent
    // nodes cannot merge into a single token (e.g. "...com</b>link").
    const parts: string[] = [];
    const collect = (node: Node): void => {
      if (node.nodeType === Node.TEXT_NODE) {
        parts.push(node.textContent || '');
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        node.childNodes.forEach(collect);
        parts.push(' ');
      }
    };
    collect(container);
    text = parts.join('');
  } else {
    text = html.replace(/<[^>]*>/g, ' ');
  }
  return extractUrls(text);
}

/**
 * Returns the bare domain of a URL (without leading www.), or an empty string.
 */
export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, '');
  } catch {
    return '';
  }
}

/**
 * Parses a LinkPreview from message metadata.
 * Accepts a JSON string (as sent over the wire) or an object.
 * Returns null when the value is missing/invalid or has no url.
 */
export function parseLinkPreview(value: unknown): LinkPreview | null {
  if (!value) return null;
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (typeof parsed !== 'object' || parsed === null) return null;

  const record = parsed as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url : '';
  if (!url) return null;

  const optionalString = (key: string): string | undefined => {
    const val = record[key];
    return typeof val === 'string' && val !== '' ? val : undefined;
  };

  return {
    url,
    title: optionalString('title'),
    description: optionalString('description'),
    imageUrl: optionalString('imageUrl') || optionalString('image'),
    siteName: optionalString('siteName') || optionalString('site_name'),
    favicon: optionalString('favicon') || optionalString('faviconUrl'),
  };
}

/**
 * True when a preview carries no enrichment data (only the url).
 */
export function isEmptyLinkPreview(preview: LinkPreview | null | undefined): boolean {
  if (!preview) return true;
  return !preview.title && !preview.description && !preview.imageUrl;
}
