import React from 'react';

const Budgets: React.FC = () => {
  const budgets = [
    { id: 'budget_001', name: 'T1 Bounties', category: 'development', allocated: 500000, spent: 325000, currency: 'FNDRY' },
    { id: 'budget_002', name: 'T2 Bounties', category: 'development', allocated: 2000000, spent: 1100000, currency: 'FNDRY' },
    { id: 'budget_003', name: 'Infrastructure', category: 'operations', allocated: 50000, spent: 32000, currency: 'USDT' },
    { id: 'budget_004', name: 'Marketing', category: 'growth', allocated: 100000, spent: 45000, currency: 'USDT' },
    { id: 'budget_005', name: 'Community Rewards', category: 'community', allocated: 250000, spent: 180000, currency: 'FNDRY' }
  ];

  return (
    <div className="budgets">
      <h2>Budget Management</h2>
      
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Allocated</th>
              <th>Spent</th>
              <th>Remaining</th>
              <th>Utilization</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map(budget => {
              const remaining = budget.allocated - budget.spent;
              const utilization = ((budget.spent / budget.allocated) * 100).toFixed(1);
              return (
                <tr key={budget.id}>
                  <td>{budget.name}</td>
                  <td>{budget.category}</td>
                  <td>{budget.allocated.toLocaleString()} {budget.currency}</td>
                  <td>{budget.spent.toLocaleString()} {budget.currency}</td>
                  <td>{remaining.toLocaleString()} {budget.currency}</td>
                  <td>
                    <div className="progress-bar">
                      <div 
                        className="progress-fill" 
                        style={{ width: `${utilization}%` }}
                      />
                      <span className="progress-text">{utilization}%</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Budgets;
