/**
 * 404 Not Found Page
 * Displayed when user visits an invalid route.
 * Matches SolFoundry dark theme styling.
 */
import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center">
          <svg
            className="w-10 h-10 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 10V3L4 14h7v7l9-11h-7z"
            />
          </svg>
        </div>
      </div>

      {/* 404 Text */}
      <h1 className="text-6xl font-bold text-white mb-2">404</h1>
      <h2 className="text-xl font-semibold text-gray-300 mb-4">Page not found</h2>
      <p className="text-sm text-gray-500 mb-8 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-semibold hover:opacity-90 transition-opacity"
        >
          <svg
            className="w-5 h-5 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
            />
          </svg>
          Back to Home
        </Link>
        <Link
          to="/bounties"
          className="inline-flex items-center justify-center px-6 py-3 rounded-xl border border-gray-700 text-gray-300 font-semibold hover:bg-gray-800 hover:border-gray-600 transition-colors"
        >
          Browse open bounties
          <svg
            className="w-5 h-5 ml-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 8l4 4m0 0l-4 4m4-4H3"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}

export default NotFoundPage;
