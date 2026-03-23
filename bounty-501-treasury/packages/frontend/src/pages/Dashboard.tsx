import React from 'react';
import { DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';

const Dashboard: React.FC = () => {
  const metrics = [
    { label: 'Total Balance', value: '$275,000', change: '+12%', icon: <DollarSign size={24} /> },
    { label: 'Monthly Burn Rate', value: '$45,000', change: '-5%', icon: <TrendingUp size={24} /> },
    { label: 'Pending Payouts', value: '$275,000', change: '2 bounties', icon: <AlertCircle size={24} /> },
    { label: 'Completed Bounties', value: '12', change: 'Q1 2026', icon: <CheckCircle size={24} /> }
  ];

  const recentTransactions = [
    { id: 'tx_003', type: 'outflow', amount: '250,000 FNDRY', description: 'Bounty #606 - Deployment Automation', date: '2026-03-23' },
    { id: 'tx_002', type: 'outflow', amount: '250,000 FNDRY', description: 'Bounty #604 - TypeScript SDK', date: '2026-03-23' },
    { id: 'tx_001', type: 'inflow', amount: '50,000 USDT', description: 'Q1 2026 Funding', date: '2026-03-20' }
  ];

  const activeBounties = [
    { issue: '#501', name: 'Treasury Dashboard', reward: '275k FNDRY', status: 'submitted' },
    { issue: '#508', name: 'Webhooks', reward: '275k FNDRY', status: 'review' },
    { issue: '#504', name: 'Anti-gaming', reward: '275k FNDRY', status: 'review' },
    { issue: '#503', name: 'Wallet Session', reward: '275k FNDRY', status: 'review' }
  ];

  return (
    <div className="dashboard">
      <h2>Dashboard Overview</h2>
      
      <div className="metrics-grid">
        {metrics.map((metric, index) => (
          <div key={index} className="metric-card">
            <div className="metric-icon">{metric.icon}</div>
            <div className="metric-content">
              <span className="metric-label">{metric.label}</span>
              <span className="metric-value">{metric.value}</span>
              <span className={`metric-change ${metric.change.startsWith('+') ? 'positive' : 'negative'}`}>
                {metric.change}
              </span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-grid">
        <div className="card">
          <h3>Recent Transactions</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Type</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map(tx => (
                <tr key={tx.id}>
                  <td>{tx.date}</td>
                  <td>{tx.description}</td>
                  <td>{tx.amount}</td>
                  <td className={tx.type}>
                    {tx.type === 'inflow' ? '↑ In' : '↓ Out'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Active Bounties</h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Issue</th>
                <th>Name</th>
                <th>Reward</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {activeBounties.map(bounty => (
                <tr key={bounty.issue}>
                  <td>{bounty.issue}</td>
                  <td>{bounty.name}</td>
                  <td>{bounty.reward}</td>
                  <td>
                    <span className={`status-badge ${bounty.status}`}>
                      {bounty.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
