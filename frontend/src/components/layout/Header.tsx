import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-900 text-white px-6 py-4 shadow-md flex justify-between items-center border-b border-gray-800">
      <div className="text-xl font-bold tracking-wider">SolFoundry</div>
      <div className="flex items-center space-x-4">
        <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium transition-colors">
          Connect Wallet
        </button>
      </div>
    </header>
  );
};
