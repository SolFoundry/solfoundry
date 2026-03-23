# SolFoundry Treasury Dashboard

> Complete Treasury Management Dashboard for SolFoundry - Track funds, manage budgets, and visualize spending

## 🎯 Project Overview

This dashboard provides real-time visibility into SolFoundry's treasury operations, including:
- Total treasury balance and token holdings
- Budget allocation tracking
- Spending analytics and trends
- Bounty payout management
- Financial reporting

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm 8+
- Docker & Docker Compose

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Start development server
pnpm dev

# Build for production
pnpm build

# Run with Docker
docker-compose up -d
```

## 📁 Project Structure

```
solfoundry-treasury-dashboard/
├── packages/
│   ├── frontend/          # React/TypeScript Dashboard
│   │   ├── src/
│   │   │   ├── components/  # UI Components
│   │   │   ├── pages/       # Dashboard Pages
│   │   │   ├── hooks/       # Custom Hooks
│   │   │   ├── api/         # API Client
│   │   │   └── types/       # TypeScript Types
│   │   ├── public/
│   │   └── package.json
│   └── backend/           # Node.js API Server
│       ├── src/
│       │   ├── routes/      # API Routes
│       │   ├── services/    # Business Logic
│       │   ├── models/      # Data Models
│       │   └── utils/       # Utilities
│       └── package.json
├── docker-compose.yml
├── .env.example
└── README.md
```

## 🎨 Features

### Dashboard Views
- **Overview**: Total balance, recent transactions, key metrics
- **Budgets**: Track budget allocation and spending by category
- **Transactions**: Full transaction history with filtering
- **Reports**: Generate financial reports (PDF/CSV)
- **Settings**: Configure alerts and notifications

### Key Metrics
- Total Treasury Balance (USDT, $FNDRY, SOL)
- Monthly Burn Rate
- Budget Utilization %
- Pending Payouts
- Active Bounties Cost

## 🔧 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/treasury/balance` | Get current treasury balance |
| GET | `/api/treasury/transactions` | List all transactions |
| POST | `/api/treasury/transactions` | Record new transaction |
| GET | `/api/budgets` | List all budgets |
| POST | `/api/budgets` | Create new budget |
| GET | `/api/reports/summary` | Generate summary report |

## 🧪 Testing

```bash
# Run unit tests
pnpm test

# Run integration tests
pnpm test:integration

# Generate coverage report
pnpm test:coverage
```

## 📊 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `REDIS_URL` | Redis connection string | redis://localhost:6379 |
| `API_PORT` | Backend API port | 3000 |
| `FRONTEND_PORT` | Frontend port | 3001 |
| `SOLANA_RPC_URL` | Solana RPC endpoint | https://api.mainnet-beta.solana.com |
| `TREASURY_WALLET` | Treasury wallet address | Required |

## 🐳 Docker Deployment

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📝 License

MIT License - See LICENSE file for details

## 💰 Bounty Info

- **Issue**: #501
- **Reward**: 275,000 $FNDRY
- **Status**: Complete
