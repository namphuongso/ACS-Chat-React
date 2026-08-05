import { describe, it, expect } from 'vitest';
import { debounce } from '../../utils/debounce';

describe('debounce', () => {
  it('should return the original function as is for now', () => {
    const fn = (x: number) => x * 2;
    const debounced = debounce(fn);
    expect(debounced).toBe(fn);
  });
});
