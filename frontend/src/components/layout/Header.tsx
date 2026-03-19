import React from 'react';
import { Link } from 'react-router-dom';

export const Header = () => {
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link to="/" className="text-xl font-bold text-indigo-600">
                SolFoundry
              </Link>
            </div>
            <nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/bounties"
                className="border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
              >
                Bounties
              </Link>
              <div className="border-transparent text-gray-500 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                PR Status: <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">In Review</span>
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
};
