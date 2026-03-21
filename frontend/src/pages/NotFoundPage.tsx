import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

const NotFoundPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center px-4">
      <div className="text-center max-w-md mx-auto">
        {/* SolFoundry Logo */}
        <div className="mb-8">
          <Link to="/" className="inline-block">
            <div className="flex items-center justify-center">
              <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg
                  className="w-10 h-10 text-white"
                  viewBox="0 0 100 100"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M20 30 L50 10 L80 30 L50 50 Z" opacity="0.8" />
                  <path d="M20 50 L50 30 L80 50 L50 70 Z" />
                  <path d="M20 70 L50 50 L80 70 L50 90 Z" opacity="0.6" />
                </svg>
              </div>
              <div className="ml-3">
                <div className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                  SolFoundry
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* 404 Message */}
        <div className="mb-8">
          <h1 className="text-6xl font-bold text-slate-200 mb-4">404</h1>
          <h2 className="text-2xl font-semibold text-slate-300 mb-2">Page not found</h2>
          <p className="text-slate-400 leading-relaxed">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="space-y-4">
          {/* Back to Home Button */}
          <Link
            to="/"
            className="inline-flex items-center justify-center w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
          >
            <ArrowLeftIcon className="w-5 h-5 mr-2" />
            Back to Home
          </Link>

          {/* Browse Bounties Link */}
          <Link
            to="/bounties"
            className="inline-flex items-center justify-center w-full px-6 py-3 border border-slate-600 hover:border-slate-500 text-slate-300 hover:text-white font-medium rounded-lg transition-all duration-200 hover:bg-slate-800/50"
          >
            Browse open bounties →
          </Link>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-slate-800">
          <p className="text-slate-500 text-sm">
            Need help? Check our{' '}
            <Link to="/docs" className="text-purple-400 hover:text-purple-300 transition-colors">
              documentation
            </Link>{' '}
            or{' '}
            <Link to="/contact" className="text-purple-400 hover:text-purple-300 transition-colors">
              contact support
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;