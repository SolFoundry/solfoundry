import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 text-white">
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold tracking-tight">SolFoundry</span>
      </div>
      <div className="flex items-center gap-4">
        <button className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors">
          Connect Wallet
        </button>
      </div>
    </header>
  );
};
