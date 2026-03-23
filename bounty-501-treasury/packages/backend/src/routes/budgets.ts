import { Router, Request, Response } from 'express';

const router = Router();

// Mock budget data
const budgets = [
  {
    id: 'budget_001',
    name: 'T1 Bounties',
    category: 'development',
    allocated: 500000,
    spent: 325000,
    currency: 'FNDRY',
    period: 'Q1 2026',
    status: 'active'
  },
  {
    id: 'budget_002',
    name: 'T2 Bounties',
    category: 'development',
    allocated: 2000000,
    spent: 1100000,
    currency: 'FNDRY',
    period: 'Q1 2026',
    status: 'active'
  },
  {
    id: 'budget_003',
    name: 'Infrastructure',
    category: 'operations',
    allocated: 50000,
    spent: 32000,
    currency: 'USDT',
    period: 'Q1 2026',
    status: 'active'
  },
  {
    id: 'budget_004',
    name: 'Marketing',
    category: 'growth',
    allocated: 100000,
    spent: 45000,
    currency: 'USDT',
    period: 'Q1 2026',
    status: 'active'
  },
  {
    id: 'budget_005',
    name: 'Community Rewards',
    category: 'community',
    allocated: 250000,
    spent: 180000,
    currency: 'FNDRY',
    period: 'Q1 2026',
    status: 'active'
  }
];

/**
 * GET /api/budgets
 * List all budgets
 */
router.get('/', (req: Request, res: Response) => {
  const { category, status } = req.query;
  
  let filtered = budgets;
  
  if (category) {
    filtered = filtered.filter(b => b.category === category);
  }
  
  if (status) {
    filtered = filtered.filter(b => b.status === status);
  }
  
  res.json({
    success: true,
    data: filtered,
    summary: {
      totalAllocated: filtered.reduce((sum, b) => sum + b.allocated, 0),
      totalSpent: filtered.reduce((sum, b) => sum + b.spent, 0),
      utilizationRate: (filtered.reduce((sum, b) => sum + b.spent, 0) / filtered.reduce((sum, b) => sum + b.allocated, 0)) * 100
    }
  });
});

/**
 * GET /api/budgets/:id
 * Get specific budget details
 */
router.get('/:id', (req: Request, res: Response) => {
  const budget = budgets.find(b => b.id === req.params.id);
  
  if (!budget) {
    return res.status(404).json({
      success: false,
      error: 'Budget not found'
    });
  }
  
  res.json({
    success: true,
    data: budget
  });
});

/**
 * POST /api/budgets
 * Create new budget
 */
router.post('/', (req: Request, res: Response) => {
  const { name, category, allocated, currency, period } = req.body;
  
  if (!name || !allocated || !currency) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: name, allocated, currency'
    });
  }
  
  const newBudget = {
    id: `budget_${Date.now()}`,
    name,
    category: category || 'general',
    allocated,
    spent: 0,
    currency,
    period: period || 'Q2 2026',
    status: 'active'
  };
  
  budgets.push(newBudget);
  
  res.status(201).json({
    success: true,
    data: newBudget
  });
});

/**
 * PUT /api/budgets/:id
 * Update budget
 */
router.put('/:id', (req: Request, res: Response) => {
  const budgetIndex = budgets.findIndex(b => b.id === req.params.id);
  
  if (budgetIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Budget not found'
    });
  }
  
  const { name, allocated, status } = req.body;
  
  if (name) budgets[budgetIndex].name = name;
  if (allocated) budgets[budgetIndex].allocated = allocated;
  if (status) budgets[budgetIndex].status = status;
  
  res.json({
    success: true,
    data: budgets[budgetIndex]
  });
});

/**
 * GET /api/budgets/analytics
 * Get budget analytics
 */
router.get('/analytics', (req: Request, res: Response) => {
  const analytics = {
    byCategory: {
      development: budgets.filter(b => b.category === 'development'),
      operations: budgets.filter(b => b.category === 'operations'),
      growth: budgets.filter(b => b.category === 'growth'),
      community: budgets.filter(b => b.category === 'community')
    },
    utilizationByCategory: {
      development: 55,
      operations: 64,
      growth: 45,
      community: 72
    },
    alerts: [
      {
        budget: 'Community Rewards',
        message: 'Utilization exceeds 70%',
        severity: 'warning'
      }
    ]
  };
  
  res.json({
    success: true,
    data: analytics
  });
});

export { router as budgetRoutes };
