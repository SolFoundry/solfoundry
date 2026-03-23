import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Wallet, PieChart, Receipt, FileText, TrendingUp } from 'lucide-react';

const Layout: React.FC = () => {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: <TrendingUp size={20} />, label: 'Dashboard' },
    { path: '/budgets', icon: <PieChart size={20} />, label: 'Budgets' },
    { path: '/transactions', icon: <Receipt size={20} />, label: 'Transactions' },
    { path: '/reports', icon: <FileText size={20} />, label: 'Reports' }
  ];

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <Wallet size={32} />
            <h1>SolFoundry Treasury</h1>
          </div>
          <div className="treasury-balance">
            <span className="label">Total Balance</span>
            <span className="amount">$275,000</span>
          </div>
        </div>
      </header>

      <div className="main-container">
        <nav className="sidebar">
          <ul>
            {navItems.map(item => (
              <li key={item.path}>
                <Link
                  to={item.path}
                  className={location.pathname === item.path ? 'active' : ''}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
