import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { formatDate, formatTime } from '../../utils/date';

describe('date utils', () => {
  describe('formatDate', () => {
    it('should return ISO string', () => {
      const date = new Date('2023-01-01T12:00:00Z');
      expect(formatDate(date)).toBe(date.toISOString());
    });
  });

  describe('formatTime', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should return empty string if date is not provided', () => {
      expect(formatTime()).toBe('');
    });

    it('should return "Just now" for times less than a minute ago', () => {
      const now = new Date('2023-01-01T12:00:30Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('Just now');
    });

    it('should return minutes for times less than an hour ago', () => {
      const now = new Date('2023-01-01T12:30:00Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('30 mins');
    });

    it('should return hours for times less than a day ago', () => {
      const now = new Date('2023-01-01T15:00:00Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('3 hours');
    });

    it('should return "Yesterday" for times 1 day ago', () => {
      const now = new Date('2023-01-02T12:00:00Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('Yesterday');
    });

    it('should return days for times less than a week ago', () => {
      const now = new Date('2023-01-05T12:00:00Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('4 days');
    });

    it('should return short date for times older than a week', () => {
      const now = new Date('2023-01-15T12:00:00Z');
      vi.setSystemTime(now);
      const past = new Date('2023-01-01T12:00:00Z');
      expect(formatTime(past)).toBe('Jan 1');
    });
  });
});
