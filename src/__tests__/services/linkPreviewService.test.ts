import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LinkPreviewService } from '../../services/linkPreviewService';
import { fetchBackend } from '../../utils/apiClient';

vi.mock('../../utils/apiClient', () => ({
  fetchBackend: vi.fn(),
}));

const mockFetchBackend = vi.mocked(fetchBackend);

const ogHtml = `
<html>
  <head>
    <title>Fallback Title</title>
    <meta property="og:title" content="Article Title" />
    <meta property="og:description" content="Article description" />
    <meta property="og:image" content="/og-image.jpg" />
    <meta property="og:site_name" content="Example" />
    <link rel="icon" href="/favicon.ico" />
  </head>
  <body></body>
</html>
`;

describe('LinkPreviewService', () => {
  let service: LinkPreviewService;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    service = new LinkPreviewService();
    mockFetchBackend.mockReset();
    fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns a minimal preview for an invalid url without fetching', async () => {
    const preview = await service.fetchLinkPreview('not a url');
    expect(preview).toEqual({ url: 'not a url' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mockFetchBackend).not.toHaveBeenCalled();
  });

  it('prefers the backend /api/link-preview endpoint when backendUrl is configured', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({ backendUrl: 'https://backend.test' }),
    } as never;
    service.setChatService(mockChatService);

    mockFetchBackend.mockResolvedValueOnce({
      statusCode: 200,
      message: 'ok',
      totalRecord: 0,
      data: {
        url: 'https://example.com/article',
        title: 'Backend Title',
        description: 'Backend description',
        image: 'https://example.com/img.png',
        site_name: 'Example Site',
        faviconUrl: 'https://example.com/f.ico',
      },
    });

    const preview = await service.fetchLinkPreview('https://example.com/article');

    expect(mockFetchBackend).toHaveBeenCalledTimes(1);
    expect(mockFetchBackend).toHaveBeenCalledWith(
      expect.objectContaining({ backendUrl: 'https://backend.test' }),
      '/api/link-preview',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com/article' }),
      })
    );
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(preview).toEqual({
      url: 'https://example.com/article',
      title: 'Backend Title',
      description: 'Backend description',
      imageUrl: 'https://example.com/img.png',
      siteName: 'Example Site',
      favicon: 'https://example.com/f.ico',
    });
  });

  it('falls back to client-side Open Graph parsing when the backend fails', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({ backendUrl: 'https://backend.test' }),
    } as never;
    service.setChatService(mockChatService);

    mockFetchBackend.mockRejectedValueOnce(new Error('backend down'));
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/html; charset=utf-8' },
      text: async () => ogHtml,
    });

    const preview = await service.fetchLinkPreview('https://example.com/article');

    expect(preview).toEqual({
      url: 'https://example.com/article',
      title: 'Article Title',
      description: 'Article description',
      imageUrl: 'https://example.com/og-image.jpg',
      siteName: 'Example',
      favicon: 'https://example.com/favicon.ico',
    });
  });

  it('parses Open Graph meta tags client-side when no backend is configured', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => ogHtml,
    });

    const preview = await service.fetchLinkPreview('www.example.com/article');

    expect(preview.url).toBe('https://www.example.com/article');
    expect(preview.title).toBe('Article Title');
    expect(preview.imageUrl).toBe('https://www.example.com/og-image.jpg');
    expect(preview.favicon).toBe('https://www.example.com/favicon.ico');
  });

  it('returns a minimal fallback preview when every resolution fails', async () => {
    fetchSpy.mockRejectedValueOnce(new Error('CORS'));

    const preview = await service.fetchLinkPreview('https://cors-blocked.example/page');

    expect(preview).toEqual({
      url: 'https://cors-blocked.example/page',
      siteName: 'cors-blocked.example',
    });
  });

  it('skips non-html content types', async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      text: async () => '{"a":1}',
    });

    const preview = await service.fetchLinkPreview('https://api.example/data');
    expect(preview.title).toBeUndefined();
    expect(preview.url).toBe('https://api.example/data');
  });

  it('caches resolved previews per normalized url', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => ogHtml,
    });

    const first = await service.fetchLinkPreview('https://example.com/article');
    const second = await service.fetchLinkPreview('https://example.com/article');

    expect(first).toEqual(second);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(service.getCached('https://example.com/article')).toEqual(first);
  });

  it('clearCache empties the cache', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => ogHtml,
    });

    await service.fetchLinkPreview('https://example.com/article');
    service.clearCache();
    expect(service.getCached('https://example.com/article')).toBeUndefined();
  });
});
