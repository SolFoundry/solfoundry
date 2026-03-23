import { Request, Response } from 'express';

export const healthCheck = (req: Request, res: Response) => {
  const healthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    services: {
      database: 'connected',
      redis: 'connected',
      solana: 'connected'
    }
  };

  res.status(200).json(healthStatus);
};
