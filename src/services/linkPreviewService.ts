import type { LinkPreview } from '../types/message.types';
import type { ChatConfig, LinkPreviewConfig } from '../types/config.types';
import { fetchBackend } from '../utils/apiClient';
import { getDomainFromUrl, normalizeUrl } from '../utils/linkUtils';
import { logger } from '../utils/logger';
import type { ChatService } from './chatService';

/** Timeout for client-side preview fetches (CORS-friendly sites only). */
const CLIENT_FETCH_TIMEOUT_MS = 5000;
/** Maximum number of HTML characters parsed for meta tags client-side. */
const MAX_HTML_PARSE_LENGTH = 512 * 1024;

/**
 * Type guard that narrows an unknown value to a non-null object so callers
 * can avoid bare `as Record<string, unknown>` casts.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Picks the first non-empty string value among the given keys on a record.
 */
function pickString(
  record: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return undefined;
}


/**
 * Service that resolves {@link LinkPreview} metadata for URLs.
 *
 * Resolution order:
 * 1. Custom link-preview crawler (config.linkPreview) when configured.
 * 2. Backend extraction endpoint: POST /api/link-preview { url } (preferred,
 *    avoids CORS limitations).
 * 3. Client-side fetch + Open Graph/meta parsing (works for CORS-enabled sites).
 * 4. Minimal fallback preview containing only the URL.
 *
 * Results are cached in memory per normalized URL and in-flight requests are
 * de-duplicated.
 */
export class LinkPreviewService {
  private chatServiceRef: ChatService | null = null;
  private cache = new Map<string, LinkPreview>();
  private inflight = new Map<string, Promise<LinkPreview>>();

  /**
   * Set the ChatService reference (injected after initialization).
   */
  public setChatService(service: ChatService): void {
    this.chatServiceRef = service;
  }

  /**
   * Returns a cached preview for a URL if available.
   */
  public getCached(url: string): LinkPreview | undefined {
    const normalized = normalizeUrl(url);
    if (!normalized) return undefined;
    return this.cache.get(normalized);
  }

  /**
   * Clears the in-memory preview cache.
   */
  public clearCache(): void {
    this.cache.clear();
  }

  /**
   * Resolve a preview for the given URL. Always resolves (never rejects);
   * at minimum it returns a preview containing the URL itself.
   */
  public async fetchLinkPreview(url: string): Promise<LinkPreview> {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      return { url: url || '' };
    }

    const cached = this.cache.get(normalized);
    if (cached) return cached;

    const pending = this.inflight.get(normalized);
    if (pending) return pending;

    const promise = this.load(normalized)
      .then((preview) => {
        this.cache.set(normalized, preview);
        return preview;
      })
      .finally(() => {
        this.inflight.delete(normalized);
      });

    this.inflight.set(normalized, promise);
    return promise;
  }

  private async load(url: string): Promise<LinkPreview> {
    const config = this.getConfig();

    if (config?.linkPreview) {
      try {
        return await this.fetchFromCustomCrawler(config.linkPreview, url);
      } catch (error) {
        logger.warn(`[LinkPreviewService] Custom crawler extraction failed for ${url}`, error);
      }
    }

    if (config?.backendUrl) {
      try {
        return await this.fetchFromBackend(config, url);
      } catch (error) {
        logger.warn(`[LinkPreviewService] Backend preview extraction failed for ${url}`, error);
      }
    }

    try {
      return await this.fetchClientSide(url);
    } catch (error) {
      logger.debug(`[LinkPreviewService] Client-side preview fetch failed for ${url}`, error);
    }

    return {
      url,
      siteName: getDomainFromUrl(url) || undefined,
    };
  }

  private getConfig(): ChatConfig | null {
    try {
      if (this.chatServiceRef && this.chatServiceRef.isInitialized()) {
        return this.chatServiceRef.getConfig() || null;
      }
    } catch {
      // Not initialized yet — fall through to client-side resolution
    }
    return null;
  }

  /**
   * Fetch a preview using a custom crawler endpoint. The endpoint URL, HTTP
   * method, headers, request body and response mapping are fully configurable
   * via {@link LinkPreviewConfig}.
   */
  private async fetchFromCustomCrawler(
    linkPreviewConfig: LinkPreviewConfig,
    url: string
  ): Promise<LinkPreview> {
    if (typeof fetch === 'undefined') {
      throw new Error('fetch is not available in this environment');
    }

    const method = linkPreviewConfig.method || 'POST';
    const headers = new Headers(linkPreviewConfig.headers || {});
    const body = this.buildCrawlerRequestBody(linkPreviewConfig, url);
    if (body !== undefined && !headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(linkPreviewConfig.url, {
        method,
        headers,
        signal: controller.signal,
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: unknown = await response.json();
      const mapped = linkPreviewConfig.responseMapper?.(data);
      if (mapped) {
        return {
          url: mapped.url || url,
          title: mapped.title,
          description: mapped.description,
          imageUrl: mapped.imageUrl,
          siteName: mapped.siteName,
          favicon: mapped.favicon,
          keywords: mapped.keywords,
          canonicalUrl: mapped.canonicalUrl,
        };
      }

      return this.mapCrawlerResponse(data, url);
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Build the request body for the crawler. Supports a static object or a
   * function receiving the URL to crawl.
   */
  private buildCrawlerRequestBody(
    linkPreviewConfig: LinkPreviewConfig,
    url: string
  ): Record<string, unknown> | undefined {
    if (typeof linkPreviewConfig.requestBody === 'function') {
      return linkPreviewConfig.requestBody(url);
    }
    return linkPreviewConfig.requestBody;
  }

  /**
   * Map a raw crawler response into a {@link LinkPreview}. Handles both
   * flat responses and responses wrapped in a `data` field, picking up common
   * crawler field names (e.g. title, description, ogTags.image, headings...).
   */
  private mapCrawlerResponse(data: unknown, fallbackUrl: string): LinkPreview {
    const root = isRecord(data) ? data : {};
    const payload =
      root.data && typeof root.data === 'object' && !Array.isArray(root.data)
        ? (root.data as Record<string, unknown>)
        : root;

    const ogTags =
      payload.ogTags && typeof payload.ogTags === 'object'
        ? (payload.ogTags as Record<string, unknown>)
        : undefined;
    const twitterTags =
      payload.twitterTags && typeof payload.twitterTags === 'object'
        ? (payload.twitterTags as Record<string, unknown>)
        : undefined;

    const images = Array.isArray(payload.images)
      ? (payload.images as unknown[]).filter((x): x is string => typeof x === 'string' && x !== '')
      : [];

    const favicons = Array.isArray(payload.favicons)
      ? (payload.favicons as unknown[]).filter(
          (x): x is string => typeof x === 'string' && x !== ''
        )
      : [];

    const keywords = Array.isArray(payload.keywords)
      ? (payload.keywords as unknown[]).filter(
          (x): x is string => typeof x === 'string' && x !== ''
        )
      : undefined;

    return {
      url:
        pickString(payload, 'url', 'canonicalUrl') ||
        (ogTags && typeof ogTags.url === 'string' ? ogTags.url : undefined) ||
        fallbackUrl,
      title:
        pickString(payload, 'title') ||
        (ogTags && typeof ogTags.title === 'string' ? ogTags.title : undefined) ||
        (twitterTags && typeof twitterTags.title === 'string' ? twitterTags.title : undefined),
      description:
        pickString(payload, 'description') ||
        (ogTags && typeof ogTags.description === 'string' ? ogTags.description : undefined) ||
        (twitterTags && typeof twitterTags.description === 'string'
          ? twitterTags.description
          : undefined),
      imageUrl:
        pickString(payload, 'image', 'imageUrl', 'thumbUrl') ||
        (ogTags && typeof ogTags.image === 'string' ? ogTags.image : undefined) ||
        (twitterTags && typeof twitterTags.image === 'string' ? twitterTags.image : undefined) ||
        images[0] ||
        undefined,
      siteName:
        pickString(payload, 'siteName', 'site_name') ||
        (ogTags && typeof ogTags.site_name === 'string' ? ogTags.site_name : undefined) ||
        (twitterTags && typeof twitterTags.site === 'string' ? twitterTags.site : undefined),
      favicon:
        pickString(payload, 'favicon', 'faviconUrl') ||
        favicons[0] ||
        (ogTags && typeof ogTags.favicon === 'string' ? ogTags.favicon : undefined),
      keywords,
      canonicalUrl: pickString(payload, 'canonicalUrl'),
    };
  }

  private async fetchFromBackend(config: ChatConfig, url: string): Promise<LinkPreview> {
    const response = await fetchBackend<Record<string, unknown>>(config, '/api/link-preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    const data = isRecord(response.data) ? response.data : {};

    return {
      url: pickString(data, 'url') || url,
      title: pickString(data, 'title'),
      description: pickString(data, 'description'),
      imageUrl: pickString(data, 'imageUrl', 'image', 'thumbUrl'),
      siteName: pickString(data, 'siteName', 'site_name'),
      favicon: pickString(data, 'favicon', 'faviconUrl'),
    };
  }

  private async fetchClientSide(url: string): Promise<LinkPreview> {
    if (typeof fetch === 'undefined') {
      throw new Error('fetch is not available in this environment');
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: { Accept: 'text/html,application/xhtml+xml' },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType && !contentType.includes('text/html')) {
        throw new Error(`Unsupported content-type: ${contentType}`);
      }

      let html = await response.text();
      if (html.length > MAX_HTML_PARSE_LENGTH) {
        html = html.slice(0, MAX_HTML_PARSE_LENGTH);
      }
      return this.parseHtmlMeta(html, url);
    } finally {
      clearTimeout(timer);
    }
  }

  private parseHtmlMeta(html: string, baseUrl: string): LinkPreview {
    if (typeof DOMParser === 'undefined') {
      throw new Error('DOMParser is not available in this environment');
    }

    const doc = new DOMParser().parseFromString(html, 'text/html');

    const getMeta = (name: string): string | undefined => {
      const el =
        doc.querySelector(`meta[property="${name}"]`) || doc.querySelector(`meta[name="${name}"]`);
      const content = el?.getAttribute('content')?.trim();
      return content || undefined;
    };

    const title =
      getMeta('og:title') || doc.querySelector('title')?.textContent?.trim() || undefined;
    const description = getMeta('og:description') || getMeta('description');
    const siteName = getMeta('og:site_name');
    const imageUrl = this.resolveUrl(
      getMeta('og:image') || getMeta('og:image:url') || getMeta('twitter:image'),
      baseUrl
    );

    const faviconEl =
      doc.querySelector('link[rel="icon"]') ||
      doc.querySelector('link[rel="shortcut icon"]') ||
      doc.querySelector('link[rel="apple-touch-icon"]');
    const favicon = this.resolveUrl(faviconEl?.getAttribute('href'), baseUrl);

    return {
      url: baseUrl,
      title,
      description,
      imageUrl,
      siteName: siteName || getDomainFromUrl(baseUrl) || undefined,
      favicon,
    };
  }

  private resolveUrl(value: string | undefined | null, baseUrl: string): string | undefined {
    if (!value) return undefined;
    try {
      return new URL(value, baseUrl).toString();
    } catch {
      return undefined;
    }
  }
}

/**
 * Singleton instance of LinkPreviewService for global application usage.
 */
export const linkPreviewService = new LinkPreviewService();
