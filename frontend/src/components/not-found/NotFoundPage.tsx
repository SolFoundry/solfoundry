import React from 'react';
import { Link } from 'react-router-dom';

/**
 * NotFoundPage - 404 error page
 *
 * Features:
 * - SolFoundry dark theme styling
 * - Logo and "Page not found" message
 * - "Back to Home" button
 * - "Browse open bounties" link
 * - Responsive design
 * - No external dependencies
 */

export function NotFoundPage() {
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-[#0a0a0a]">
      <div className="max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
            <span className="text-white font-bold text-lg">SF</span>
          </div>
          <span className="text-2xl font-bold text-white tracking-tight">
            SolFoundry
          </span>
        </div>

        {/* 404 */}
        <h1 className="text-8xl font-bold text-[#9945FF] mb-4">404</h1>

        {/* Message */}
        <h2 className="text-2xl font-semibold text-white mb-2">
          Page not found
        </h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Back to Home Button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195]
                     text-white font-medium hover:opacity-90 transition-opacity shadow-lg shadow-[#9945FF]/20 mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
          </svg>
          Back to Home
        </Link>

        {/* Browse Bounties Link */}
        <div className="mt-4">
          <Link
            to="/bounties"
            className="inline-flex items-center gap-1 text-[#14F195] hover:text-[#9945FF] transition-colors font-medium"
          >
            Browse open bounties →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;