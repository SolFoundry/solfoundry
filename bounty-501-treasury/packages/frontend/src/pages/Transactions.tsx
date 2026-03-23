import React from 'react';

const Transactions: React.FC = () => {
  const transactions = [
    { id: 'tx_003', type: 'outflow', amount: 250000, token: 'FNDRY', description: 'Bounty #606 - Deployment Automation', date: '2026-03-23', status: 'completed' },
    { id: 'tx_002', type: 'outflow', amount: 250000, token: 'FNDRY', description: 'Bounty #604 - TypeScript SDK', date: '2026-03-23', status: 'completed' },
    { id: 'tx_001', type: 'inflow', amount: 50000, token: 'USDT', description: 'Q1 2026 Funding', date: '2026-03-20', status: 'completed' }
  ];

  return (
    <div className="transactions">
      <h2>Transaction History</h2>
      
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>ID</th>
              <th>Description</th>
              <th>Amount</th>
              <th>Type</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map(tx => (
              <tr key={tx.id}>
                <td>{tx.date}</td>
                <td><code>{tx.id}</code></td>
                <td>{tx.description}</td>
                <td>{tx.amount.toLocaleString()} {tx.token}</td>
                <td className={tx.type}>
                  {tx.type === 'inflow' ? '↑ Inflow' : '↓ Outflow'}
                </td>
                <td>
                  <span className={`status-badge ${tx.status}`}>
                    {tx.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Transactions;
