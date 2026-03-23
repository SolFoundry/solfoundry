/**
 * SolFoundry Program Testing Framework - Assertion Library
 * 
 * 提供丰富的断言方法用于测试验证
 */

import { AssertResult } from './types';

export class AssertionError extends Error {
  constructor(message: string, public actual?: any, public expected?: any) {
    super(message);
    this.name = 'AssertionError';
  }
}

export class Expect {
  private actual: any;
  private notFlag: boolean = false;

  constructor(actual: any) {
    this.actual = actual;
  }

  not(): Expect {
    this.notFlag = !this.notFlag;
    return this;
  }

  toBe(expected: any): void {
    const passed = this.actual === expected;
    this.assert(passed, `Expected ${this.format(expected)}, got ${this.format(this.actual)}`, expected, this.actual);
  }

  toEqual(expected: any): void {
    const passed = this.deepEquals(this.actual, expected);
    this.assert(passed, `Expected ${this.format(expected)}, got ${this.format(this.actual)}`, expected, this.actual);
  }

  toBeTruthy(): void {
    const passed = !!this.actual;
    this.assert(passed, `Expected truthy value, got ${this.format(this.actual)}`);
  }

  toBeFalsy(): void {
    const passed = !this.actual;
    this.assert(passed, `Expected falsy value, got ${this.format(this.actual)}`);
  }

  toBeNull(): void {
    const passed = this.actual === null;
    this.assert(passed, `Expected null, got ${this.format(this.actual)}`);
  }

  toBeUndefined(): void {
    const passed = this.actual === undefined;
    this.assert(passed, `Expected undefined, got ${this.format(this.actual)}`);
  }

  toBeDefined(): void {
    const passed = this.actual !== undefined;
    this.assert(passed, `Expected defined value, got undefined`);
  }

  toBeTypeOf(expected: string): void {
    const actualType = typeof this.actual;
    const passed = actualType === expected;
    this.assert(passed, `Expected type "${expected}", got "${actualType}"`);
  }

  toBeInstanceOf(expected: Function): void {
    const passed = this.actual instanceof expected;
    this.assert(passed, `Expected instance of ${expected.name}, got ${this.actual?.constructor?.name}`);
  }

  toContain(expected: any): void {
    const passed = Array.isArray(this.actual) 
      ? this.actual.includes(expected)
      : typeof this.actual === 'string' && this.actual.includes(expected);
    this.assert(passed, `Expected ${this.format(this.actual)} to contain ${this.format(expected)}`);
  }

  toHaveLength(expected: number): void {
    const length = Array.isArray(this.actual) ? this.actual.length : this.actual?.length;
    const passed = length === expected;
    this.assert(passed, `Expected length ${expected}, got ${length}`);
  }

  toHaveProperty(key: string | symbol): void {
    const passed = this.actual != null && key in this.actual;
    this.assert(passed, `Expected property "${String(key)}" to exist`);
  }

  toMatch(expected: string | RegExp): void {
    const regex = typeof expected === 'string' ? new RegExp(expected) : expected;
    const passed = regex.test(String(this.actual));
    this.assert(passed, `Expected ${this.format(this.actual)} to match ${expected}`);
  }

  toThrow(error?: Function | string | RegExp): void {
    let threw = false;
    let thrownError: Error | null = null;

    try {
      if (typeof this.actual === 'function') {
        this.actual();
      } else {
        throw new Error('Expected a function');
      }
    } catch (e) {
      threw = true;
      thrownError = e as Error;
    }

    if (!this.notFlag) {
      this.assert(threw, 'Expected function to throw');
      
      if (error && thrownError) {
        if (typeof error === 'function') {
          this.assert(thrownError instanceof error, `Expected ${error.name} to be thrown`);
        } else if (typeof error === 'string') {
          this.assert(thrownError.message.includes(error), `Expected message to include "${error}"`);
        } else if (error instanceof RegExp) {
          this.assert(error.test(thrownError.message), `Expected message to match ${error}`);
        }
      }
    } else {
      this.assert(!threw, 'Expected function not to throw');
    }
  }

  toBeGreaterThan(expected: number): void {
    const passed = this.actual > expected;
    this.assert(passed, `Expected ${this.actual} > ${expected}`);
  }

  toBeGreaterThanOrEqual(expected: number): void {
    const passed = this.actual >= expected;
    this.assert(passed, `Expected ${this.actual} >= ${expected}`);
  }

  toBeLessThan(expected: number): void {
    const passed = this.actual < expected;
    this.assert(passed, `Expected ${this.actual} < ${expected}`);
  }

  toBeLessThanOrEqual(expected: number): void {
    const passed = this.actual <= expected;
    this.assert(passed, `Expected ${this.actual} <= ${expected}`);
  }

  toBeCloseTo(expected: number, precision: number = 2): void {
    const multiplier = Math.pow(10, precision);
    const passed = Math.abs(Math.round(this.actual * multiplier) - Math.round(expected * multiplier)) < 1;
    this.assert(passed, `Expected ${this.actual} to be close to ${expected} (precision: ${precision})`);
  }

  private assert(passed: boolean, message: string, expected?: any, actual?: any): void {
    if (this.notFlag) {
      passed = !passed;
    }

    if (!passed) {
      throw new AssertionError(message, actual ?? this.actual, expected);
    }

    this.notFlag = false;
  }

  private format(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value, null, 2);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  private deepEquals(a: any, b: any): boolean {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (typeof a !== typeof b) return false;

    if (typeof a === 'object') {
      if (Array.isArray(a) !== Array.isArray(b)) return false;
      
      if (Array.isArray(a)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
          if (!this.deepEquals(a[i], b[i])) return false;
        }
        return true;
      }

      const keysA = Object.keys(a);
      const keysB = Object.keys(b);
      if (keysA.length !== keysB.length) return false;

      for (const key of keysA) {
        if (!keysB.includes(key)) return false;
        if (!this.deepEquals(a[key], b[key])) return false;
      }
      return true;
    }

    return false;
  }
}

export function expect(actual: any): Expect {
  return new Expect(actual);
}

// 便捷断言函数
export function assert(condition: any, message?: string): void {
  if (!condition) {
    throw new AssertionError(message || 'Assertion failed');
  }
}

export function fail(message?: string): never {
  throw new AssertionError(message || 'Test failed');
}
