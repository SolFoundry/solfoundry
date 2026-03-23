/**
 * Unit Tests - Assertion Library
 */

import { describe, it, expect, assert, fail, AssertionError } from '../../src/index';

describe('Assertion Library', () => {
  describe('expect().toBe()', () => {
    it('should pass for equal primitives', () => {
      expect(1).toBe(1);
      expect('hello').toBe('hello');
      expect(true).toBe(true);
    });

    it('should fail for unequal values', () => {
      expect(() => expect(1).toBe(2)).toThrow(AssertionError);
    });
  });

  describe('expect().toEqual()', () => {
    it('should pass for equal objects', () => {
      expect({ a: 1, b: 2 }).toEqual({ a: 1, b: 2 });
      expect([1, 2, 3]).toEqual([1, 2, 3]);
    });

    it('should pass for nested objects', () => {
      expect({ a: { b: { c: 1 } } }).toEqual({ a: { b: { c: 1 } } });
    });

    it('should fail for unequal objects', () => {
      expect(() => expect({ a: 1 }).toEqual({ a: 2 })).toThrow(AssertionError);
    });
  });

  describe('expect().toBeTruthy() / expect().toBeFalsy()', () => {
    it('should pass for truthy values', () => {
      expect(1).toBeTruthy();
      expect('hello').toBeTruthy();
      expect({}).toBeTruthy();
    });

    it('should pass for falsy values', () => {
      expect(0).toBeFalsy();
      expect('').toBeFalsy();
      expect(null).toBeFalsy();
      expect(undefined).toBeFalsy();
    });
  });

  describe('expect().toBeNull() / expect().toBeUndefined()', () => {
    it('should pass for null', () => {
      expect(null).toBeNull();
    });

    it('should pass for undefined', () => {
      expect(undefined).toBeUndefined();
    });

    it('should fail for other values', () => {
      expect(() => expect(0).toBeNull()).toThrow(AssertionError);
      expect(() => expect('').toBeUndefined()).toThrow(AssertionError);
    });
  });

  describe('expect().toBeDefined()', () => {
    it('should pass for defined values', () => {
      expect(0).toBeDefined();
      expect('').toBeDefined();
      expect(null).toBeDefined();
    });

    it('should fail for undefined', () => {
      expect(() => expect(undefined).toBeDefined()).toThrow(AssertionError);
    });
  });

  describe('expect().toContain()', () => {
    it('should pass for array contains', () => {
      expect([1, 2, 3]).toContain(2);
      expect(['a', 'b', 'c']).toContain('b');
    });

    it('should pass for string contains', () => {
      expect('hello world').toContain('world');
    });

    it('should fail when not contained', () => {
      expect(() => expect([1, 2]).toContain(3)).toThrow(AssertionError);
    });
  });

  describe('expect().toHaveLength()', () => {
    it('should pass for correct length', () => {
      expect([1, 2, 3]).toHaveLength(3);
      expect('hello').toHaveLength(5);
    });

    it('should fail for wrong length', () => {
      expect(() => expect([1, 2]).toHaveLength(3)).toThrow(AssertionError);
    });
  });

  describe('expect().toMatch()', () => {
    it('should pass for string match', () => {
      expect('hello world').toMatch('world');
      expect('hello world').toMatch(/world/);
    });

    it('should fail for no match', () => {
      expect(() => expect('hello').toMatch('world')).toThrow(AssertionError);
    });
  });

  describe('expect().toThrow()', () => {
    it('should pass when function throws', () => {
      expect(() => { throw new Error('test'); }).toThrow();
    });

    it('should pass for specific error message', () => {
      expect(() => { throw new Error('test error'); }).toThrow('test');
    });

    it('should pass for error type', () => {
      expect(() => { throw new TypeError('test'); }).toThrow(TypeError);
    });

    it('should fail when function does not throw', () => {
      expect(() => expect(() => {}).toThrow()).toThrow(AssertionError);
    });
  });

  describe('expect().toBeGreaterThan() / lessThan()', () => {
    it('should pass for greater than', () => {
      expect(5).toBeGreaterThan(3);
      expect(5).toBeGreaterThanOrEqual(5);
    });

    it('should pass for less than', () => {
      expect(3).toBeLessThan(5);
      expect(5).toBeLessThanOrEqual(5);
    });
  });

  describe('expect().toBeCloseTo()', () => {
    it('should pass for close numbers', () => {
      expect(0.1 + 0.2).toBeCloseTo(0.3);
    });
  });

  describe('expect().not', () => {
    it('should negate assertions', () => {
      expect(1).not.toBe(2);
      expect(false).not.toBeTruthy();
      expect(null).not.toBeDefined();
    });
  });

  describe('assert()', () => {
    it('should pass for true condition', () => {
      assert(true);
      assert(1 === 1);
    });

    it('should fail for false condition', () => {
      expect(() => assert(false, 'custom message')).toThrow('custom message');
    });
  });

  describe('fail()', () => {
    it('should always fail', () => {
      expect(() => fail('test fail')).toThrow(AssertionError);
    });
  });
});
