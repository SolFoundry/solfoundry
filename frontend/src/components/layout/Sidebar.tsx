import React from 'react';

export const Sidebar: React.FC = () => {
  return (
    <aside className="bg-gray-900 text-gray-300 w-64 h-full flex flex-col border-r border-gray-800">
      <nav className="flex-1 space-y-2 p-4 mt-4">
        <a href="/" className="block py-2.5 px-4 hover:bg-gray-800 hover:text-white rounded transition-colors">
          Dashboard
        </a>
        <a href="/bounties" className="block py-2.5 px-4 hover:bg-gray-800 hover:text-white rounded transition-colors">
          Bounties
        </a>
        <a href="/projects" className="block py-2.5 px-4 hover:bg-gray-800 hover:text-white rounded transition-colors">
          Projects
        </a>
        <a href="/profile" className="block py-2.5 px-4 hover:bg-gray-800 hover:text-white rounded transition-colors">
          Profile
        </a>
      </nav>
    </aside>
  );
};
