import React from 'react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="w-64 bg-gray-900 text-gray-300 min-h-screen border-r border-gray-800 flex flex-col">
      <nav className="flex-1 px-4 py-6 space-y-2">
        <a href="/" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors">Dashboard</a>
        <a href="/bounties" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors">Bounties</a>
        <a href="/projects" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors">Projects</a>
        <a href="/community" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors">Community</a>
      </nav>
      <div className="p-4 border-t border-gray-800">
        <a href="/settings" className="block px-4 py-2 hover:bg-gray-800 hover:text-white rounded-md transition-colors">Settings</a>
      </div>
    </aside>
  );
};
