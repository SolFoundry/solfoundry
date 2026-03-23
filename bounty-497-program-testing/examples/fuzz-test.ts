/**
 * SolFoundry Program Testing Framework - Fuzz Testing Example
 * 
 * 展示模糊测试用法
 */

import { describe, it, expect, runTests, fuzz, BoundaryValues } from '../src/index';

// 示例被测试函数
function transfer(amount: number, balance: number): { newBalance: number; success: boolean } {
  if (amount < 0) {
    throw new Error('Amount cannot be negative');
  }
  if (amount > balance) {
    return { newBalance: balance, success: false };
  }
  return { newBalance: balance - amount, success: true };
}

function parsePublicKey(key: string): boolean {
  // 简化的公钥验证
  if (typeof key !== 'string') return false;
  if (key.length < 32 || key.length > 44) return false;
  return true;
}

describe('Fuzz Testing Examples', () => {
  it('should demonstrate fuzz testing concept', () => {
    // 基础 fuzz 测试示例
    console.log('\n🔬 Starting fuzz test for transfer function...');
    
    fuzz('transfer function', async (input) => {
      const { amount, balance } = input;
      
      // 确保输入在合理范围内
      const safeAmount = Math.abs(amount);
      const safeBalance = Math.max(0, balance);
      
      try {
        const result = transfer(safeAmount, safeBalance);
        
        // 不变量：余额永远不会是负数
        expect(result.newBalance).toBeGreaterThanOrEqual(0);
        
        // 不变量：如果转账成功，新余额应该等于原余额减去转账金额
        if (result.success && safeAmount <= safeBalance) {
          expect(result.newBalance).toBe(safeBalance - safeAmount);
        }
        
        // 不变量：如果转账失败，余额应该不变
        if (!result.success) {
          expect(result.newBalance).toBe(safeBalance);
        }
      } catch (error) {
        // 负数金额应该抛出错误
        if (safeAmount < 0) {
          expect((error as Error).message).toContain('negative');
        } else {
          throw error;
        }
      }
    }, {
      iterations: 500,
      inputs: {
        amount: { type: 'i32', min: -1000, max: 1000 },
        balance: { type: 'i32', min: 0, max: 10000 },
      },
    });
  });

  it('should test boundary values', () => {
    console.log('\n🎯 Testing boundary values...');
    
    // 测试 u8 边界值
    for (const value of BoundaryValues.u8) {
      const result = transfer(value, 255);
      expect(result.newBalance).toBeGreaterThanOrEqual(0);
    }

    // 测试 u16 边界值
    for (const value of BoundaryValues.u16) {
      if (value >= 0 && value <= 10000) {
        const result = transfer(value, 10000);
        expect(result.newBalance).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe('Public Key Validation Fuzz Test', () => {
  it('should validate public keys', () => {
    console.log('\n🔑 Fuzz testing public key validation...');
    
    fuzz('public key validation', async (input) => {
      const { key } = input;
      
      const isValid = parsePublicKey(key);
      
      // 不变量：空字符串应该无效
      if (key === '') {
        expect(isValid).toBe(false);
      }
      
      // 不变量：非常短的字符串应该无效
      if (key.length > 0 && key.length < 32) {
        expect(isValid).toBe(false);
      }
    }, {
      iterations: 300,
      inputs: {
        key: { type: 'string', length: 50 },
      },
    });
  });
});

describe('Manual Fuzz Testing', () => {
  it('should handle edge cases manually', () => {
    const edgeCases = [
      { amount: 0, balance: 0, expected: { newBalance: 0, success: true } },
      { amount: 0, balance: 100, expected: { newBalance: 100, success: true } },
      { amount: 100, balance: 100, expected: { newBalance: 0, success: true } },
      { amount: 101, balance: 100, expected: { newBalance: 100, success: false } },
      { amount: Number.MAX_SAFE_INTEGER, balance: Number.MAX_SAFE_INTEGER, expected: { newBalance: 0, success: true } },
    ];

    for (const { amount, balance, expected } of edgeCases) {
      const result = transfer(amount, balance);
      expect(result.newBalance).toBe(expected.newBalance);
      expect(result.success).toBe(expected.success);
    }
  });

  it('should reject negative amounts', () => {
    const negativeCases = [-1, -100, -Number.MAX_SAFE_INTEGER];

    for (const amount of negativeCases) {
      expect(() => transfer(amount, 100)).toThrow('negative');
    }
  });
});

// 运行测试
if (require.main === module) {
  runTests().catch(console.error);
}
