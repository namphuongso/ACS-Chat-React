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

  it('uses the custom crawler with a function requestBody and maps the response', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({
        linkPreview: {
          url: 'https://crawl-seo-info.vercel.app/seo-crawler/crawl',
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          requestBody: (url: string) => ({ url }),
        },
      }),
    } as never;
    service.setChatService(mockChatService);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: 'https://github.com/thaoanhhaa1',
        title: 'thaoanhhaa1 (Hà Anh Thảo) · GitHubLinkedInFacebook',
        description: 'thaoanhhaa1 has 100 repositories available.',
        ogTags: {
          image: 'https://avatars.githubusercontent.com/u/81128952?v=4',
          site_name: 'GitHub',
        },
        twitterTags: {
          site: '@github',
          image: 'https://avatars.githubusercontent.com/u/81128952?v=4',
        },
      }),
    });

    const preview = await service.fetchLinkPreview('https://github.com/thaoanhhaa1');

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [input, init] = fetchSpy.mock.calls[0];
    expect(input).toBe('https://crawl-seo-info.vercel.app/seo-crawler/crawl');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ url: 'https://github.com/thaoanhhaa1' });
    expect(preview).toEqual({
      url: 'https://github.com/thaoanhhaa1',
      title: 'thaoanhhaa1 (Hà Anh Thảo) · GitHubLinkedInFacebook',
      description: 'thaoanhhaa1 has 100 repositories available.',
      imageUrl: 'https://avatars.githubusercontent.com/u/81128952?v=4',
      siteName: 'GitHub',
    });
  });

  it('uses the custom crawler with a static requestBody and a responseMapper', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({
        linkPreview: {
          url: 'https://your-crawler.example/crawl',
          method: 'POST',
          requestBody: { target: 'https://example.com' },
          responseMapper: (data: unknown) => {
            const d = data as { result?: { title?: string; thumb?: string; desc?: string } };
            return {
              title: d.result?.title,
              imageUrl: d.result?.thumb,
              description: d.result?.desc,
            };
          },
        },
      }),
    } as never;
    service.setChatService(mockChatService);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        result: {
          title: 'Custom Title',
          thumb: 'https://example.com/thumb.png',
          desc: 'Custom description',
        },
      }),
    });

    const preview = await service.fetchLinkPreview('https://example.com');

    const [input, init] = fetchSpy.mock.calls[0];
    expect(input).toBe('https://your-crawler.example/crawl');
    expect(JSON.parse(init.body)).toEqual({ target: 'https://example.com' });
    expect(preview).toEqual({
      url: 'https://example.com/',
      title: 'Custom Title',
      description: 'Custom description',
      imageUrl: 'https://example.com/thumb.png',
    });
  });

  it('falls back to the backend /api/link-preview when the custom crawler fails', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({
        backendUrl: 'https://backend.test',
        linkPreview: {
          url: 'https://crawler.example/crawl',
        },
      }),
    } as never;
    service.setChatService(mockChatService);

    fetchSpy.mockRejectedValueOnce(new Error('crawler down'));
    mockFetchBackend.mockResolvedValueOnce({
      statusCode: 200,
      message: 'ok',
      totalRecord: 0,
      data: {
        url: 'https://example.com/article',
        title: 'Backend Title',
      },
    });

    const preview = await service.fetchLinkPreview('https://example.com/article');

    expect(preview).toEqual({
      url: 'https://example.com/article',
      title: 'Backend Title',
    });
    expect(mockFetchBackend).toHaveBeenCalledTimes(1);
  });

  it('correctly maps rich SEO crawler response with ogTags, twitterTags, images, and keywords', async () => {
    const mockChatService = {
      isInitialized: vi.fn().mockReturnValue(true),
      getConfig: vi.fn().mockReturnValue({
        linkPreview: {
          url: 'https://crawl-seo-info.vercel.app/seo-crawler/crawl',
          method: 'POST',
        },
      }),
    } as never;
    service.setChatService(mockChatService);

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        url: 'https://www.npmjs.com/package/link-preview-js',
        title: 'link-preview-js - npm',
        description:
          'Javascript module to extract and fetch HTTP link information from blocks of text.',
        keywords: ['javascript', 'link', 'url', 'http', 'preview', 'npm', 'package'],
        ogTags: {
          site_name: 'npm',
          title: 'link-preview-js',
          description:
            'Javascript module to extract and fetch HTTP link information from blocks of text.',
          url: 'https://www.npmjs.com/package/link-preview-js',
          image: 'https://static.npmjs.com/338e4905a2684ca96e08b7780fc68412.png',
        },
        twitterTags: {
          card: 'summary',
          title: 'link-preview-js',
          description:
            'Javascript module to extract and fetch HTTP link information from blocks of text.',
          site: 'npm',
        },
        canonicalUrl: 'https://www.npmjs.com/package/link-preview-js',
        images: ['https://static.npmjs.com/338e4905a2684ca96e08b7780fc68412.png'],
      }),
    });

    const preview = await service.fetchLinkPreview('https://www.npmjs.com/package/link-preview-js');

    expect(preview).toEqual({
      url: 'https://www.npmjs.com/package/link-preview-js',
      title: 'link-preview-js - npm',
      description:
        'Javascript module to extract and fetch HTTP link information from blocks of text.',
      imageUrl: 'https://static.npmjs.com/338e4905a2684ca96e08b7780fc68412.png',
      siteName: 'npm',
      favicon: undefined,
      keywords: ['javascript', 'link', 'url', 'http', 'preview', 'npm', 'package'],
      canonicalUrl: 'https://www.npmjs.com/package/link-preview-js',
    });
  });
});
