import React from 'react';

export const Sidebar: React.FC = () => {
  const navItems = [
    { label: 'Dashboard', href: '/' },
    { label: 'Bounties', href: '/bounties' },
    { label: 'Leaderboard', href: '/leaderboard' },
    { label: 'Profile', href: '/profile' }
  ];

  return (
    <aside className="w-64 h-full bg-gray-900 border-r border-gray-800 text-gray-300 hidden md:flex flex-col">
      <nav className="flex flex-col gap-2 p-4 flex-1">
        {navItems.map((item) => (
          <a
            key={item.label}
            href={item.href}
            className="px-4 py-3 text-sm font-medium rounded-lg hover:bg-gray-800 hover:text-white transition-colors"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
};
