import type { LinkPreview } from '../types/message.types';
import type { ChatConfig } from '../types/config.types';
import { fetchBackend } from '../utils/apiClient';
import { getDomainFromUrl, normalizeUrl } from '../utils/linkUtils';
import { logger } from '../utils/logger';
import type { ChatService } from './chatService';

/** Timeout for client-side preview fetches (CORS-friendly sites only). */
const CLIENT_FETCH_TIMEOUT_MS = 8000;
/** Maximum number of HTML characters parsed for meta tags client-side. */
const MAX_HTML_PARSE_LENGTH = 512 * 1024;

/**
 * Service that resolves {@link LinkPreview} metadata for URLs.
 *
 * Resolution order:
 * 1. Backend extraction endpoint: POST /api/link-preview { url } (preferred,
 *    avoids CORS limitations).
 * 2. Client-side fetch + Open Graph/meta parsing (works for CORS-enabled sites).
 * 3. Minimal fallback preview containing only the URL.
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

  private async fetchFromBackend(config: ChatConfig, url: string): Promise<LinkPreview> {
    const response = await fetchBackend<Record<string, unknown>>(config, '/api/link-preview', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    const data = (response.data || {}) as Record<string, unknown>;
    const pickString = (...keys: string[]): string | undefined => {
      for (const key of keys) {
        const value = data[key];
        if (typeof value === 'string' && value !== '') return value;
      }
      return undefined;
    };

    return {
      url: pickString('url') || url,
      title: pickString('title'),
      description: pickString('description'),
      imageUrl: pickString('imageUrl', 'image', 'thumbUrl'),
      siteName: pickString('siteName', 'site_name'),
      favicon: pickString('favicon', 'faviconUrl'),
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
        doc.querySelector(`meta[property="${name}"]`) ||
        doc.querySelector(`meta[name="${name}"]`);
      const content = el?.getAttribute('content')?.trim();
      return content || undefined;
    };

    const title = getMeta('og:title') || doc.querySelector('title')?.textContent?.trim() || undefined;
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
