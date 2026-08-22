import { describe, it, expect } from 'vitest';
import { VERSION } from '../index';

describe('Package Initialization', () => {
  it('should export correct package VERSION', () => {
    expect(VERSION).toBe('1.2.1');
  });
});
