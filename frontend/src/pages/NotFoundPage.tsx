/** Route entry point for 404 Not Found page */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      {/* Logo */}
      <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center mb-6">
        <span className="text-white font-bold text-xl">SF</span>
      </div>

      {/* 404 Text */}
      <h1 className="text-6xl font-bold text-white mb-2">404</h1>
      
      {/* Page not found message */}
      <h2 className="text-xl font-semibold text-white mb-3">Page not found</h2>
      
      {/* Description */}
      <p className="text-gray-500 max-w-md mb-8">
        The page you're looking for doesn't exist or has been moved.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Link
          to="/"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-medium hover:opacity-90 transition-opacity"
        >
          ← Back to Home
        </Link>
        <Link
          to="/bounties"
          className="inline-flex items-center justify-center px-6 py-3 rounded-lg border border-white/20 text-white font-medium hover:bg-white/10 transition-colors"
        >
          Browse open bounties →
        </Link>
      </div>
    </div>
  );
}