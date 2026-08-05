import { describe, it, expect } from 'vitest';
import { throttle } from '../../utils/throttle';

describe('throttle', () => {
  it('should return the original function as is for now', () => {
    const fn = (x: number) => x * 2;
    const throttled = throttle(fn);
    expect(throttled).toBe(fn);
  });
});
