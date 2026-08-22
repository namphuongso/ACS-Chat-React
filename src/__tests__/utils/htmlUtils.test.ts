import { describe, it, expect, vi } from 'vitest';
import { sanitizeHtml, normalizeFormattingHtml, safeNormalizeFormattingElement } from '../../utils/htmlUtils';
import DOMPurify from 'dompurify';

describe('htmlUtils', () => {
  describe('sanitizeHtml', () => {
    it('should strip malicious script tags and event handlers', () => {
      const malicious = '<script>alert(1)</script><p>Hello</p><img src="x" onerror="alert(2)" />';
      const sanitized = sanitizeHtml(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('onerror');
      expect(sanitized).toContain('<p>Hello</p>');
    });

    it('should fail closed and return empty string if DOMPurify throws an exception', () => {
      const spy = vi.spyOn(DOMPurify, 'sanitize').mockImplementation(() => {
        throw new Error('DOMPurify failure');
      });

      const untrusted = '<p>Some potentially dangerous payload</p>';
      const result = sanitizeHtml(untrusted);
      expect(result).toBe('');

      spy.mockRestore();
    });
  });

  describe('normalizeFormattingHtml', () => {
    it('should normalize strikethrough wrapping font size elements', () => {
      const input = '<s><font size="5">Big text</font></s>';
      const output = normalizeFormattingHtml(input);
      expect(output).toContain('<font size="5"><s>Big text</s></font>');
    });

    it('should handle empty or null inputs gracefully', () => {
      expect(normalizeFormattingHtml('')).toBe('');
      expect(normalizeFormattingHtml(null)).toBeNull();
    });
  });

  describe('safeNormalizeFormattingElement', () => {
    it('should safely process elements in DOM without throwing', () => {
      const container = document.createElement('div');
      container.innerHTML = '<font size="4">Text</font>';
      expect(() => safeNormalizeFormattingElement(container)).not.toThrow();
    });
  });
});
