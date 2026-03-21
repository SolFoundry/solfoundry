import React from 'react';
import { Link } from 'react-router-dom';
import Layout from '../components/Layout';

const NotFoundPage: React.FC = () => {
  return (
    <Layout>
      <div className="min-h-[calc(100vh-200px)] flex flex-col items-center justify-center px-4 py-8">
        {/* Logo */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 bg-clip-text text-transparent">
            SolFoundry
          </h1>
        </div>

        {/* 404 Message */}
        <div className="text-center mb-8">
          <h2 className="text-6xl md:text-8xl font-bold text-gray-200 mb-4">
            404
          </h2>
          <h3 className="text-2xl md:text-3xl font-semibold text-white mb-2">
            Page Not Found
          </h3>
          <p className="text-gray-400 text-lg max-w-md">
            The page you're looking for doesn't exist or has been moved.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
          <Link
            to="/"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center"
            aria-label="Go back to home page"
          >
            Back to Home
          </Link>
          <Link
            to="/bounties"
            className="flex-1 border border-gray-600 hover:border-gray-500 text-gray-300 hover:text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 text-center"
            aria-label="Browse available bounties"
          >
            Browse Bounties
          </Link>
        </div>
      </div>
    </Layout>
  );
};

export default NotFoundPage;