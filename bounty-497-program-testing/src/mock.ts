/**
 * SolFoundry Program Testing Framework - Mock & Stub Utilities
 * 
 * 提供 Mock 和 Stub 功能，用于隔离外部依赖
 */

import { MockConfig, MockCall } from './types';

export class Mock<T extends object> {
  private target: Partial<T>;
  private calls: MockCall[] = [];
  private callCounts: Record<string, number> = {};

  constructor(implementation?: Partial<T>) {
    this.target = implementation ?? {};
  }

  method<K extends keyof T>(methodName: K): MockMethod<T, K> {
    const self = this;
    const methodKey = String(methodName);

    if (!this.callCounts[methodKey]) {
      this.callCounts[methodKey] = 0;
    }

    return {
      returns(...values: any[]) {
        (self.target[methodName] as any) = function (...args: any[]) {
          const callIndex = self.callCounts[methodKey] % values.length;
          self.callCounts[methodKey]++;
          
          self.calls.push({
            methodName: methodKey,
            args,
            result: values[callIndex],
          });

          return values[callIndex];
        };
        return this;
      },

      throws(...errors: Error[]) {
        (self.target[methodName] as any) = function (...args: any[]) {
          const callIndex = self.callCounts[methodKey] % errors.length;
          self.callCounts[methodKey]++;
          
          self.calls.push({
            methodName: methodKey,
            args,
            error: errors[callIndex],
          });

          throw errors[callIndex];
        };
        return this;
      },

      implements(fn: (...args: any[]) => any) {
        (self.target[methodName] as any) = function (...args: any[]) {
          self.callCounts[methodKey]++;
          const result = fn(...args);
          
          self.calls.push({
            methodName: methodKey,
            args,
            result,
          });

          return result;
        };
        return this;
      },
    };
  }

  verify(): MockVerifier {
    return new MockVerifier(this.calls);
  }

  reset(): void {
    this.calls = [];
    this.callCounts = {};
  }

  getObject(): T {
    return this.target as T;
  }
}

export interface MockMethod<T, K extends keyof T> {
  returns(...values: any[]): this;
  throws(...errors: Error[]): this;
  implements(fn: (...args: any[]) => any): this;
}

export class MockVerifier {
  constructor(private calls: MockCall[]) {}

  toHaveBeenCalled(methodName: string): boolean {
    const count = this.calls.filter(c => c.methodName === methodName).length;
    return count > 0;
  }

  toHaveBeenCalledTimes(methodName: string, times: number): boolean {
    const count = this.calls.filter(c => c.methodName === methodName).length;
    return count === times;
  }

  toHaveBeenCalledWith(methodName: string, ...args: any[]): boolean {
    return this.calls.some(
      c => c.methodName === methodName && this.argsMatch(c.args, args)
    );
  }

  toHaveReturned(methodName: string, value: any): boolean {
    return this.calls.some(
      c => c.methodName === methodName && c.result !== undefined && this.deepEquals(c.result, value)
    );
  }

  toHaveThrown(methodName: string): boolean {
    return this.calls.some(
      c => c.methodName === methodName && c.error !== undefined
    );
  }

  private argsMatch(actual: any[], expected: any[]): boolean {
    if (actual.length !== expected.length) return false;
    for (let i = 0; i < actual.length; i++) {
      if (!this.deepEquals(actual[i], expected[i])) return false;
    }
    return true;
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

// 便捷 Mock 创建函数
export function createMock<T extends object>(implementation?: Partial<T>): Mock<T> {
  return new Mock<T>(implementation);
}

// Stub 创建器
export function createStub<T extends object>(): T {
  const stub: any = {};
  return new Proxy(stub, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) {
        target[prop] = function () {
          return undefined;
        };
      }
      return target[prop];
    },
  });
}

// Spy 创建器
export function createSpy<T extends Function>(originalFn?: T): Spy<T> {
  const calls: any[][] = [];
  const results: any[] = [];

  const spy = function (this: any, ...args: any[]) {
    calls.push(args);
    const result = originalFn ? originalFn.apply(this, args) : undefined;
    results.push(result);
    return result;
  } as T & {
    calls: { all(): any[]; count(): number; argsFor(index: number): any[] };
    results: { all(): any[] };
    reset(): void;
  };

  spy.calls = {
    all: () => calls,
    count: () => calls.length,
    argsFor: (index: number) => calls[index],
  };

  spy.results = {
    all: () => results,
  };

  spy.reset = () => {
    calls.length = 0;
    results.length = 0;
  };

  return spy;
}

export interface Spy<T extends Function> extends T {
  calls: {
    all(): any[][];
    count(): number;
    argsFor(index: number): any[];
  };
  results: {
    all(): any[];
  };
  reset(): void;
}
