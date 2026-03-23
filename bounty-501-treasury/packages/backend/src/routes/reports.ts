import { Router, Request, Response } from 'express';

const router = Router();

/**
 * GET /api/reports/summary
 * Generate treasury summary report
 */
router.get('/summary', (req: Request, res: Response) => {
  const report = {
    generatedAt: new Date().toISOString(),
    period: 'Q1 2026',
    treasury: {
      totalValueUSD: 275000,
      balances: {
        USDT: 125000,
        FNDRY: 5000000,
        SOL: 150.50
      }
    },
    spending: {
      totalSpent: 1425000,
      byCategory: {
        development: 1100000,
        operations: 32000,
        marketing: 45000,
        community: 180000,
        other: 68000
      }
    },
    bounties: {
      totalPaid: 12,
      totalAmount: 1425000,
      pending: 4,
      pendingAmount: 1100000
    },
    metrics: {
      monthlyBurnRate: 45000,
      runwayMonths: 6.1,
      averageBountySize: 118750,
      completionRate: 92
    }
  };
  
  res.json({
    success: true,
    data: report
  });
});

/**
 * GET /api/reports/monthly/:month
 * Generate monthly report
 */
router.get('/monthly/:month', (req: Request, res: Response) => {
  const { month } = req.params;
  
  const report = {
    month,
    generatedAt: new Date().toISOString(),
    income: {
      total: 50000,
      sources: [
        { source: 'Q1 Funding', amount: 50000, currency: 'USDT' }
      ]
    },
    expenses: {
      total: 52000,
      byCategory: {
        bounties: 45000,
        infrastructure: 5000,
        operations: 2000
      }
    },
    netChange: -2000,
    topBounties: [
      { issue: '#604', name: 'TypeScript SDK', amount: 250000, currency: 'FNDRY' },
      { issue: '#606', name: 'Deployment Automation', amount: 250000, currency: 'FNDRY' },
      { issue: '#508', name: 'Webhooks', amount: 275000, currency: 'FNDRY' }
    ]
  };
  
  res.json({
    success: true,
    data: report
  });
});

/**
 * GET /api/reports/bounty/:issueId
 * Generate bounty-specific report
 */
router.get('/bounty/:issueId', (req: Request, res: Response) => {
  const { issueId } = req.params;
  
  const report = {
    issueId,
    generatedAt: new Date().toISOString(),
    bounty: {
      title: 'Treasury Dashboard',
      reward: 275000,
      currency: 'FNDRY',
      status: 'completed',
      submittedAt: '2026-03-23T18:00:00Z'
    },
    timeline: [
      { event: 'Issue Opened', date: '2026-03-15' },
      { event: 'Claimed', date: '2026-03-20' },
      { event: 'Development Started', date: '2026-03-20' },
      { event: 'PR Submitted', date: '2026-03-23' },
      { event: 'Pending Review', date: '2026-03-23' }
    ]
  };
  
  res.json({
    success: true,
    data: report
  });
});

/**
 * GET /api/reports/export
 * Export report data (CSV/JSON)
 */
router.get('/export', (req: Request, res: Response) => {
  const { format = 'json' } = req.query;
  
  const data = {
    transactions: [
      { id: 'tx_001', type: 'inflow', amount: 50000, token: 'USDT', date: '2026-03-20' },
      { id: 'tx_002', type: 'outflow', amount: 250000, token: 'FNDRY', date: '2026-03-23' },
      { id: 'tx_003', type: 'outflow', amount: 250000, token: 'FNDRY', date: '2026-03-23' }
    ],
    budgets: [
      { name: 'T1 Bounties', allocated: 500000, spent: 325000 },
      { name: 'T2 Bounties', allocated: 2000000, spent: 1100000 }
    ]
  };
  
  if (format === 'csv') {
    const csv = 'id,type,amount,token,date\n' + 
      data.transactions.map(t => `${t.id},${t.type},${t.amount},${t.token},${t.date}`).join('\n');
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=treasury-report.csv');
    res.send(csv);
  } else {
    res.json({
      success: true,
      data
    });
  }
});

export { router as reportRoutes };
