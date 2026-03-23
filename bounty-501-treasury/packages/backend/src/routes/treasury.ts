import { Router, Request, Response } from 'express';

const router = Router();

// Mock treasury data
const treasuryData = {
  balances: {
    USDT: 125000.00,
    FNDRY: 5000000.00,
    SOL: 150.50
  },
  totalValueUSD: 275000.00,
  lastUpdated: new Date().toISOString()
};

const transactions = [
  {
    id: 'tx_001',
    type: 'inflow',
    amount: 50000,
    token: 'USDT',
    description: 'Q1 2026 Funding',
    timestamp: '2026-03-20T10:00:00Z',
    status: 'completed'
  },
  {
    id: 'tx_002',
    type: 'outflow',
    amount: 250000,
    token: 'FNDRY',
    description: 'Bounty #604 Payout - TypeScript SDK',
    timestamp: '2026-03-23T01:30:00Z',
    status: 'completed'
  },
  {
    id: 'tx_003',
    type: 'outflow',
    amount: 250000,
    token: 'FNDRY',
    description: 'Bounty #606 Payout - Deployment Automation',
    timestamp: '2026-03-23T02:00:00Z',
    status: 'completed'
  },
  {
    id: 'tx_004',
    type: 'pending',
    amount: 275000,
    token: 'FNDRY',
    description: 'Bounty #501 Pending - Treasury Dashboard',
    timestamp: '2026-03-23T18:00:00Z',
    status: 'pending'
  }
];

/**
 * GET /api/treasury/balance
 * Get current treasury balance
 */
router.get('/balance', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: treasuryData
  });
});

/**
 * GET /api/treasury/transactions
 * List all transactions with optional filtering
 */
router.get('/transactions', (req: Request, res: Response) => {
  const { type, status, limit = 50, offset = 0 } = req.query;
  
  let filtered = transactions;
  
  if (type) {
    filtered = filtered.filter(tx => tx.type === type);
  }
  
  if (status) {
    filtered = filtered.filter(tx => tx.status === status);
  }
  
  const paginated = filtered.slice(Number(offset), Number(offset) + Number(limit));
  
  res.json({
    success: true,
    data: paginated,
    pagination: {
      total: filtered.length,
      limit: Number(limit),
      offset: Number(offset)
    }
  });
});

/**
 * POST /api/treasury/transactions
 * Record new transaction
 */
router.post('/transactions', (req: Request, res: Response) => {
  const { type, amount, token, description } = req.body;
  
  if (!type || !amount || !token) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: type, amount, token'
    });
  }
  
  const newTransaction = {
    id: `tx_${Date.now()}`,
    type,
    amount,
    token,
    description: description || '',
    timestamp: new Date().toISOString(),
    status: 'pending'
  };
  
  transactions.unshift(newTransaction);
  
  res.status(201).json({
    success: true,
    data: newTransaction
  });
});

/**
 * GET /api/treasury/summary
 * Get treasury summary with analytics
 */
router.get('/summary', (req: Request, res: Response) => {
  const summary = {
    totalValue: treasuryData.totalValueUSD,
    balances: treasuryData.balances,
    monthlyBurnRate: 45000,
    runwayMonths: 6.1,
    pendingPayouts: 275000,
    activeBounties: 12,
    lastMonthSpending: 52000,
    trend: 'stable'
  };
  
  res.json({
    success: true,
    data: summary
  });
});

export { router as treasuryRoutes };
