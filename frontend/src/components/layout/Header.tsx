import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-900 text-white p-4 flex justify-between items-center border-b border-gray-800">
      <div className="text-xl font-bold text-blue-400">SolFoundry</div>
      <nav className="flex items-center space-x-4">
        <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-sm font-medium transition-colors">
          Connect Wallet
        </button>
      </nav>
    </header>
  );
};
