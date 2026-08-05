import { describe, it, expect } from 'vitest';
import { logger } from '../../utils/logger';

describe('logger', () => {
  it('should have info, error, warn methods', () => {
    expect(logger.info).toBe(console.info);
    expect(logger.error).toBe(console.error);
    expect(logger.warn).toBe(console.warn);
  });
});
