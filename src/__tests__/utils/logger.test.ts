import { describe, it, expect, vi } from 'vitest';
import { logger, setLogger } from '../../utils/logger';

describe('logger', () => {
  it('should have info, error, warn, debug methods and delegate properly', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');

    const customLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    };

    setLogger(customLogger);
    logger.info('test info');
    expect(customLogger.info).toHaveBeenCalledWith('test info');

    setLogger(null);
  });
});
