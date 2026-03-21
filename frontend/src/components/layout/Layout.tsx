import { useState } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { ScrollToTop } from '../common/ScrollToTop';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
  };

  return (
    <div className={`min-h-screen bg-gray-50 dark:bg-gray-950 ${theme === 'dark' ? 'dark' : ''}`}>
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed((prev) => !prev)}
      />
      <div
        className={`flex flex-col transition-all duration-200 ${
          sidebarCollapsed ? 'lg:ml-16' : 'lg:ml-64'
        }`}
      >
        <Header
          sidebarCollapsed={sidebarCollapsed}
          onMenuClick={() => setSidebarCollapsed((prev) => !prev)}
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="flex-1 p-6">{children}</main>
      </div>
      <ScrollToTop />
    </div>
  );
}
