import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { retry } from '../../utils/retry';

describe('retry utility', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should resolve immediately if function succeeds on first try', async () => {
    const fn = vi.fn().mockResolvedValue('success');
    const result = await retry(fn);
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on failure and resolve if it eventually succeeds', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockResolvedValue('success');
      
    const promise = retry(fn, { baseDelay: 10, jitter: false });
    
    // Fast-forward timers for the delays
    await vi.advanceTimersByTimeAsync(10); // attempt 1 delay
    await vi.advanceTimersByTimeAsync(20); // attempt 2 delay (10 * 2)
    
    const result = await promise;
    
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should throw error if maxRetries is exceeded', async () => {
    const error = new Error('persistent failure');
    const fn = vi.fn().mockRejectedValue(error);
      
    const promise = retry(fn, { maxRetries: 2, baseDelay: 10, jitter: false });
    
    const expectPromise = expect(promise).rejects.toThrow('persistent failure');
    
    await vi.advanceTimersByTimeAsync(10); // attempt 1 delay
    await vi.advanceTimersByTimeAsync(20); // attempt 2 delay
    
    await expectPromise;
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it('should not retry if shouldRetry returns false', async () => {
    const error = new Error('auth failure');
    const fn = vi.fn().mockRejectedValue(error);
    const shouldRetry = vi.fn().mockReturnValue(false);
      
    const promise = retry(fn, { shouldRetry, maxRetries: 3 });
    
    await expect(promise).rejects.toThrow('auth failure');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(shouldRetry).toHaveBeenCalledWith(error);
  });

  it('should respect maxDelay', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('fail'));
    const onRetry = vi.fn();
      
    const promise = retry(fn, { 
      maxRetries: 3, 
      baseDelay: 100, 
      maxDelay: 200, 
      factor: 5,
      jitter: false,
      onRetry
    });
    
    const expectPromise = expect(promise).rejects.toThrow('fail');
    
    // First retry delay: min(100 * 5^0, 200) = 100
    await vi.advanceTimersByTimeAsync(100);
    // Second retry delay: min(100 * 5^1, 200) = 200
    await vi.advanceTimersByTimeAsync(200);
    // Third retry delay: min(100 * 5^2, 200) = 200
    await vi.advanceTimersByTimeAsync(200);
    
    await expectPromise;
    
    expect(onRetry).toHaveBeenNthCalledWith(1, expect.any(Error), 1, 100);
    expect(onRetry).toHaveBeenNthCalledWith(2, expect.any(Error), 2, 200);
    expect(onRetry).toHaveBeenNthCalledWith(3, expect.any(Error), 3, 200);
  });
});
