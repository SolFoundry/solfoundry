/**
 * SolFoundry Program Testing Framework - Basic Test Example
 * 
 * 展示基础单元测试用法
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, runTests } from '../src/index';

// 示例被测试函数
class Calculator {
  private history: number[] = [];

  add(a: number, b: number): number {
    const result = a + b;
    this.history.push(result);
    return result;
  }

  subtract(a: number, b: number): number {
    return a - b;
  }

  multiply(a: number, b: number): number {
    return a * b;
  }

  divide(a: number, b: number): number {
    if (b === 0) {
      throw new Error('Division by zero');
    }
    return a / b;
  }

  getHistory(): number[] {
    return [...this.history];
  }

  clearHistory(): void {
    this.history = [];
  }
}

describe('Calculator', () => {
  let calculator: Calculator;

  beforeAll(() => {
    console.log('🔧 Setting up test suite...');
  });

  afterAll(() => {
    console.log('🧹 Cleaning up test suite...');
  });

  beforeEach(() => {
    calculator = new Calculator();
  });

  afterEach(() => {
    calculator.clearHistory();
  });

  describe('add()', () => {
    it('should add two positive numbers', () => {
      const result = calculator.add(2, 3);
      expect(result).toBe(5);
    });

    it('should add negative numbers', () => {
      const result = calculator.add(-2, -3);
      expect(result).toBe(-5);
    });

    it('should add zero', () => {
      const result = calculator.add(5, 0);
      expect(result).toBe(5);
    });

    it('should record history', () => {
      calculator.add(2, 3);
      calculator.add(4, 5);
      expect(calculator.getHistory()).toEqual([5, 9]);
    });
  });

  describe('subtract()', () => {
    it('should subtract two numbers', () => {
      const result = calculator.subtract(10, 4);
      expect(result).toBe(6);
    });

    it('should handle negative results', () => {
      const result = calculator.subtract(4, 10);
      expect(result).toBe(-6);
    });
  });

  describe('multiply()', () => {
    it('should multiply two numbers', () => {
      const result = calculator.multiply(3, 4);
      expect(result).toBe(12);
    });

    it('should multiply by zero', () => {
      const result = calculator.multiply(100, 0);
      expect(result).toBe(0);
    });
  });

  describe('divide()', () => {
    it('should divide two numbers', () => {
      const result = calculator.divide(10, 2);
      expect(result).toBe(5);
    });

    it('should throw on division by zero', () => {
      expect(() => calculator.divide(10, 0)).toThrow('Division by zero');
    });

    it('should handle decimal results', () => {
      const result = calculator.divide(7, 2);
      expect(result).toBe(3.5);
    });
  });

  describe('getHistory()', () => {
    it('should return empty array initially', () => {
      expect(calculator.getHistory()).toEqual([]);
    });

    it('should return a copy, not the original', () => {
      calculator.add(1, 2);
      const history = calculator.getHistory();
      history.push(999);
      expect(calculator.getHistory()).not.toContain(999);
    });
  });
});

describe('Edge Cases', () => {
  it('should handle large numbers', () => {
    const calc = new Calculator();
    const result = calc.add(Number.MAX_SAFE_INTEGER, 1);
    expect(result).toBeGreaterThan(Number.MAX_SAFE_INTEGER);
  });

  it('should handle floating point precision', () => {
    const calc = new Calculator();
    const result = calc.add(0.1, 0.2);
    expect(result).toBeCloseTo(0.3, 10);
  });
});

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}
