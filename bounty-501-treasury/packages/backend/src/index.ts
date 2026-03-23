import express, { Express } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { treasuryRoutes } from './routes/treasury';
import { budgetRoutes } from './routes/budgets';
import { reportRoutes } from './routes/reports';
import { healthCheck } from './middleware/health';

dotenv.config();

const app: Express = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', healthCheck);

// API Routes
app.use('/api/treasury', treasuryRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SolFoundry Treasury Dashboard API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      treasury: '/api/treasury',
      budgets: '/api/bounties',
      reports: '/api/reports',
      health: '/health'
    }
  });
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Treasury API server running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

export default app;
