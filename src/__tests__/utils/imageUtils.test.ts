import { describe, it, expect } from 'vitest';
import { isLargeImage, formatFileSize } from '../../utils/imageUtils';

describe('imageUtils', () => {
  describe('isLargeImage', () => {
    it('should return false for missing or invalid input', () => {
      expect(isLargeImage(undefined)).toBe(false);
      expect(isLargeImage(null)).toBe(false);
      expect(isLargeImage(0)).toBe(false);
      expect(isLargeImage(-100)).toBe(false);
    });

    it('should return false for files smaller than 10MB', () => {
      // 1MB
      expect(isLargeImage(1 * 1024 * 1024)).toBe(false);
      // 3MB
      expect(isLargeImage(3 * 1024 * 1024)).toBe(false);
      // 9.9MB
      expect(isLargeImage(9.9 * 1024 * 1024)).toBe(false);

      const smallFile = new File(['x'], 'photo.jpg', { type: 'image/jpeg' });
      Object.defineProperty(smallFile, 'size', { value: 3 * 1024 * 1024 });
      expect(isLargeImage(smallFile)).toBe(false);
    });

    it('should return true for files >= 10MB', () => {
      // 10MB exactly
      expect(isLargeImage(10 * 1024 * 1024)).toBe(true);
      // 50MB
      expect(isLargeImage(50 * 1024 * 1024)).toBe(true);
      // 100MB
      expect(isLargeImage(100 * 1024 * 1024)).toBe(true);

      const largeFile = new File(['x'], 'large_photo.png', { type: 'image/png' });
      Object.defineProperty(largeFile, 'size', { value: 50 * 1024 * 1024 });
      expect(isLargeImage(largeFile)).toBe(true);
    });

    it('should support custom threshold', () => {
      // With 5MB threshold
      expect(isLargeImage(4 * 1024 * 1024, 5 * 1024 * 1024)).toBe(false);
      expect(isLargeImage(6 * 1024 * 1024, 5 * 1024 * 1024)).toBe(true);
    });
  });

  describe('formatFileSize', () => {
    it('should return empty string for empty input', () => {
      expect(formatFileSize(undefined)).toBe('');
      expect(formatFileSize(null)).toBe('');
      expect(formatFileSize('')).toBe('');
    });

    it('should return 0 B for 0 or negative', () => {
      expect(formatFileSize(0)).toBe('0 B');
      expect(formatFileSize(-10)).toBe('0 B');
    });

    it('should format bytes properly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.00 KB');
      expect(formatFileSize(1024 * 512)).toBe('512.00 KB');
      expect(formatFileSize(100.36 * 1024 * 1024)).toBe('100.36 MB');
      expect(formatFileSize(1.5 * 1024 * 1024 * 1024)).toBe('1.50 GB');
    });
  });
});

