/**
 * NotFoundPage — Custom 404 page matching SolFoundry dark theme.
 * Shown when a user navigates to an unknown route.
 * @module pages/NotFoundPage
 */
import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-16 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-[#9945FF]/20">
          <span className="text-white font-bold text-xl">SF</span>
        </div>
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">SolFoundry</span>
      </div>

      {/* 404 */}
      <p className="text-8xl font-extrabold text-[#9945FF] leading-none mb-4 select-none">
        404
      </p>

      {/* Message */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm mb-10">
        This page doesn&apos;t exist or has been moved. Head back home or browse open bounties.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-lg bg-[#9945FF] text-white font-semibold text-sm hover:bg-[#7c2de8] transition-colors focus:outline-none focus:ring-2 focus:ring-[#9945FF] focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
        >
          Back to Home
        </Link>
        <Link
          to="/bounties"
          className="px-6 py-2.5 rounded-lg bg-gray-100 dark:bg-white/10 text-gray-600 dark:text-gray-300 font-medium text-sm hover:bg-gray-200 dark:hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300 dark:focus:ring-white/30 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
        >
          Browse open bounties →
        </Link>
      </div>
    </div>
  );
}
