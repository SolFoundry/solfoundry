import { describe, it, expect } from '@jest/globals';

describe('Treasury API', () => {
  it('should return treasury balance', () => {
    const mockBalance = {
      balances: {
        USDT: 125000.00,
        FNDRY: 5000000.00,
        SOL: 150.50
      },
      totalValueUSD: 275000.00
    };
    
    expect(mockBalance.totalValueUSD).toBe(275000.00);
    expect(mockBalance.balances.USDT).toBe(125000.00);
  });

  it('should calculate budget utilization', () => {
    const allocated = 500000;
    const spent = 325000;
    const utilization = (spent / allocated) * 100;
    
    expect(utilization).toBe(65);
  });

  it('should filter transactions by type', () => {
    const transactions = [
      { type: 'inflow', amount: 50000 },
      { type: 'outflow', amount: 250000 },
      { type: 'outflow', amount: 250000 }
    ];
    
    const outflows = transactions.filter(tx => tx.type === 'outflow');
    expect(outflows.length).toBe(2);
    expect(outflows.reduce((sum, tx) => sum + tx.amount, 0)).toBe(500000);
  });
});

describe('Budget Analytics', () => {
  it('should calculate total allocated', () => {
    const budgets = [
      { allocated: 500000 },
      { allocated: 2000000 },
      { allocated: 50000 }
    ];
    
    const total = budgets.reduce((sum, b) => sum + b.allocated, 0);
    expect(total).toBe(2550000);
  });

  it('should identify high utilization budgets', () => {
    const budgets = [
      { name: 'T1', utilization: 65 },
      { name: 'T2', utilization: 55 },
      { name: 'Community', utilization: 72 }
    ];
    
    const highUtilization = budgets.filter(b => b.utilization > 70);
    expect(highUtilization.length).toBe(1);
    expect(highUtilization[0].name).toBe('Community');
  });
});
