import { describe, expect, it } from 'vitest';
import {
  containsUrl,
  escapeHtml,
  extractUrls,
  extractUrlsFromHtml,
  getDomainFromUrl,
  isEmptyLinkPreview,
  isPublicHttpUrl,
  linkifyHtml,
  normalizeUrl,
  parseLinkPreview,
} from '../linkUtils';

describe('linkUtils', () => {
  describe('normalizeUrl', () => {
    it('keeps a valid https url', () => {
      expect(normalizeUrl('https://example.com/path?a=1')).toBe('https://example.com/path?a=1');
    });

    it('prefixes bare www. urls with https', () => {
      expect(normalizeUrl('www.example.com')).toBe('https://www.example.com/');
    });

    it('strips trailing punctuation', () => {
      expect(normalizeUrl('https://example.com/page.')).toBe('https://example.com/page');
      expect(normalizeUrl('https://example.com!')).toBe('https://example.com/');
    });

    it('balances trailing parentheses', () => {
      expect(normalizeUrl('https://en.wikipedia.org/wiki/Chat_(app))')).toBe(
        'https://en.wikipedia.org/wiki/Chat_(app)'
      );
    });

    it('returns empty string for invalid urls', () => {
      expect(normalizeUrl('')).toBe('');
      expect(normalizeUrl('not a url')).toBe('');
    });
  });

  describe('extractUrls', () => {
    it('extracts multiple urls in order', () => {
      const text = 'Check https://a.com and www.b.com/path plus http://c.io?x=1';
      expect(extractUrls(text)).toEqual([
        'https://a.com/',
        'https://www.b.com/path',
        'http://c.io/?x=1',
      ]);
    });

    it('deduplicates identical urls', () => {
      expect(extractUrls('https://a.com https://a.com/')).toHaveLength(1);
    });

    it('extracts parenthesized urls from sentences', () => {
      expect(extractUrls('(see https://en.wikipedia.org/wiki/Chat_(app))')).toEqual([
        'https://en.wikipedia.org/wiki/Chat_(app)',
      ]);
    });

    it('returns empty array for text without urls', () => {
      expect(extractUrls('hello world')).toEqual([]);
      expect(extractUrls('')).toEqual([]);
    });
  });

  describe('containsUrl', () => {
    it('detects urls', () => {
      expect(containsUrl('see https://a.com')).toBe(true);
      expect(containsUrl('plain text')).toBe(false);
      expect(containsUrl('')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('escapes special characters', () => {
      expect(escapeHtml('<b>&"\'')).toBe('&lt;b&gt;&amp;&quot;&#39;');
    });
  });

  describe('linkifyHtml', () => {
    it('wraps urls in anchor tags with safe attributes', () => {
      const html = linkifyHtml('open https://example.com now');
      expect(html).toContain(
        '<a href="https://example.com/" target="_blank" rel="noopener noreferrer">https://example.com</a>'
      );
      expect(html.startsWith('open ')).toBe(true);
      expect(html.endsWith(' now')).toBe(true);
    });

    it('escapes surrounding text to prevent XSS', () => {
      const html = linkifyHtml('<script>alert("x")</script> https://a.com');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;');
    });

    it('keeps query-string ampersands valid in href', () => {
      const html = linkifyHtml('https://a.com/x?b=1&c=2');
      expect(html).toContain('href="https://a.com/x?b=1&amp;c=2"');
    });

    it('returns plain escaped text when no url present', () => {
      expect(linkifyHtml('a < b')).toBe('a &lt; b');
    });
  });

  describe('extractUrlsFromHtml', () => {
    it('extracts urls from html text content', () => {
      const urls = extractUrlsFromHtml(
        '<div>Visit <b>https://example.com</b><a href="https://ignored.com">link</a></div>'
      );
      expect(urls).toContain('https://example.com/');
    });

    it('returns empty for html without urls', () => {
      expect(extractUrlsFromHtml('<div>hello</div>')).toEqual([]);
    });
  });

  describe('getDomainFromUrl', () => {
    it('returns bare domain', () => {
      expect(getDomainFromUrl('https://www.example.com/path')).toBe('example.com');
      expect(getDomainFromUrl('https://sub.example.com')).toBe('sub.example.com');
    });

    it('returns empty for invalid url', () => {
      expect(getDomainFromUrl('nope')).toBe('');
    });
  });

  describe('parseLinkPreview', () => {
    it('parses a JSON string', () => {
      const value = JSON.stringify({
        url: 'https://a.com',
        title: 'Title',
        description: 'Desc',
        imageUrl: 'https://a.com/i.png',
        siteName: 'A',
        favicon: 'https://a.com/f.ico',
      });
      const preview = parseLinkPreview(value);
      expect(preview).toEqual({
        url: 'https://a.com',
        title: 'Title',
        description: 'Desc',
        imageUrl: 'https://a.com/i.png',
        siteName: 'A',
        favicon: 'https://a.com/f.ico',
      });
    });

    it('parses an object with snake_case / alias keys', () => {
      const preview = parseLinkPreview({
        url: 'https://a.com',
        image: 'https://a.com/i.png',
        site_name: 'A',
        faviconUrl: 'https://a.com/f.ico',
      });
      expect(preview?.imageUrl).toBe('https://a.com/i.png');
      expect(preview?.siteName).toBe('A');
      expect(preview?.favicon).toBe('https://a.com/f.ico');
    });

    it('returns null for invalid json, missing url or invalid input', () => {
      expect(parseLinkPreview('{oops')).toBeNull();
      expect(parseLinkPreview({ title: 'no url' })).toBeNull();
      expect(parseLinkPreview(null)).toBeNull();
      expect(parseLinkPreview(42)).toBeNull();
    });
  });

  describe('isEmptyLinkPreview', () => {
    it('is true when only url is present', () => {
      expect(isEmptyLinkPreview({ url: 'https://a.com' })).toBe(true);
      expect(isEmptyLinkPreview(null)).toBe(true);
    });

    it('is false when enrichment data exists', () => {
      expect(isEmptyLinkPreview({ url: 'https://a.com', title: 'T' })).toBe(false);
      expect(isEmptyLinkPreview({ url: 'https://a.com', imageUrl: 'i.png' })).toBe(false);
    });
  });

  describe('isPublicHttpUrl', () => {
    it('returns true for standard public http and https URLs', () => {
      expect(isPublicHttpUrl('https://example.com/files/doc.docx')).toBe(true);
      expect(isPublicHttpUrl('http://my-storage.blob.core.windows.net/files/doc.docx?token=xyz')).toBe(true);
      expect(isPublicHttpUrl('https://cdn.example.org:8080/presentation.pptx')).toBe(true);
      expect(isPublicHttpUrl('https://sub.domain.co.uk/sheet.xlsx')).toBe(true);
    });

    it('returns false for blob, data, and file URLs', () => {
      expect(isPublicHttpUrl('blob:http://localhost:3000/1234-5678')).toBe(false);
      expect(isPublicHttpUrl('data:application/pdf;base64,JVBERi0xL...')).toBe(false);
      expect(isPublicHttpUrl('file:///path/to/doc.docx')).toBe(false);
    });

    it('returns false for localhost and loopback addresses', () => {
      expect(isPublicHttpUrl('http://localhost:3000/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('https://localhost/file.xlsx')).toBe(false);
      expect(isPublicHttpUrl('http://127.0.0.1:8080/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://0.0.0.0/file.pptx')).toBe(false);
      expect(isPublicHttpUrl('http://[::1]/file.docx')).toBe(false);
    });

    it('returns false for private IPv4 addresses', () => {
      // 10.0.0.0/8
      expect(isPublicHttpUrl('http://10.0.0.1/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('https://10.255.0.5/doc.docx')).toBe(false);

      // 172.16.0.0/12
      expect(isPublicHttpUrl('http://172.16.0.1/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://172.31.255.255/doc.docx')).toBe(false);

      // 192.168.0.0/16
      expect(isPublicHttpUrl('http://192.168.1.1/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://192.168.100.25/doc.docx')).toBe(false);

      // 169.254.0.0/16
      expect(isPublicHttpUrl('http://169.254.1.1/doc.docx')).toBe(false);
    });

    it('returns false for intranet single-label hostnames and local domains', () => {
      expect(isPublicHttpUrl('http://internal-server/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://myserver/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://intranet.local/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://app.internal/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://dev.lan/doc.docx')).toBe(false);
      expect(isPublicHttpUrl('http://corp.corp/doc.docx')).toBe(false);
    });

    it('returns false for empty or invalid inputs', () => {
      expect(isPublicHttpUrl('')).toBe(false);
      expect(isPublicHttpUrl(undefined)).toBe(false);
      expect(isPublicHttpUrl('not a url')).toBe(false);
      expect(isPublicHttpUrl('ftp://example.com/doc.docx')).toBe(false);
    });
  });
});
