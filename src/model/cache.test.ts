import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest';
import Cache from './cache';

vi.mock('./input');

describe('Cache', () => {
  describe('Verification', () => {
    it('does not throw', () => {
      expect(() => Cache.verify()).not.toThrow();
    });
  });
});
