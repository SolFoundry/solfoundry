import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface NavigationProps {
  className?: string;
}

const Navigation: React.FC<NavigationProps> = ({ className = '' }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();

  const navigationItems = [
    { path: '/', label: 'Home' },
    { path: '/about', label: 'About' },
    { path: '/services', label: 'Services' },
    { path: '/contact', label: 'Contact' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <nav className={`relative ${className}`}>
      {/* Mobile hamburger button */}
      <button
        type="button"
        className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500 transition-colors duration-200 min-h-[44px] min-w-[44px]"
        aria-expanded={isMobileMenuOpen}
        aria-controls="mobile-menu"
        onClick={toggleMobileMenu}
      >
        <span className="sr-only">Open main menu</span>
        {/* Hamburger icon */}
        <div className="relative w-6 h-6">
          <span
            className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
              isMobileMenuOpen ? 'rotate-45 top-3' : 'top-1'
            }`}
          />
          <span
            className={`absolute block h-0.5 w-6 bg-current transform transition-opacity duration-300 ease-in-out top-3 ${
              isMobileMenuOpen ? 'opacity-0' : 'opacity-100'
            }`}
          />
          <span
            className={`absolute block h-0.5 w-6 bg-current transform transition-all duration-300 ease-in-out ${
              isMobileMenuOpen ? '-rotate-45 top-3' : 'top-5'
            }`}
          />
        </div>
      </button>

      {/* Desktop navigation */}
      <div className="hidden md:flex md:items-center md:space-x-8">
        {navigationItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 min-h-[44px] flex items-center ${
              isActive(item.path)
                ? 'text-blue-600 bg-blue-50'
                : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Mobile navigation menu */}
      <div
        id="mobile-menu"
        className={`md:hidden absolute top-full left-0 right-0 z-50 bg-white shadow-lg border-t transition-all duration-300 ease-in-out ${
          isMobileMenuOpen
            ? 'opacity-100 visible transform translate-y-0'
            : 'opacity-0 invisible transform -translate-y-2'
        }`}
      >
        <div className="px-2 pt-2 pb-3 space-y-1">
          {navigationItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeMobileMenu}
              className={`block px-3 py-3 rounded-md text-base font-medium transition-colors duration-200 min-h-[44px] ${
                isActive(item.path)
                  ? 'text-blue-600 bg-blue-50'
                  : 'text-gray-700 hover:text-blue-600 hover:bg-gray-50'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Mobile menu overlay */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black bg-opacity-25"
          onClick={closeMobileMenu}
          aria-hidden="true"
        />
      )}
    </nav>
  );
};

export default Navigation;