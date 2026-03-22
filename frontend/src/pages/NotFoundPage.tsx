/**
 * NotFoundPage — Custom 404 page matching SolFoundry dark theme.
 * Shown when a user navigates to an unknown route.
 * @module pages/NotFoundPage
 */
import { Link } from 'react-router-dom';
import { SolFoundryLogoMark } from '../components/common/SolFoundryLogoMark';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-16 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <SolFoundryLogoMark size="lg" className="shadow-lg shadow-solana-purple/20" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">SolFoundry</span>
      </div>

      {/* 404 */}
      <p className="text-8xl font-extrabold text-solana-purple leading-none mb-4 select-none">
        404
      </p>

      {/* Message */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Page not found</h1>
      <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm mb-10">
        This page doesn&apos;t exist or has been moved. Head back home or browse open bounties.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/"
          className="px-6 py-2.5 rounded-lg bg-solana-purple text-white font-semibold text-sm hover:bg-violet-700 transition-colors focus:outline-none focus:ring-2 focus:ring-solana-purple focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-black"
        >
          Back to Home
        </Link>
        <Link
          to="/bounties"
          className="px-6 py-2.5 rounded-lg border border-gray-300 bg-gray-100 text-gray-800 font-medium text-sm hover:bg-gray-200 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2 focus:ring-offset-white dark:border-transparent dark:bg-white/10 dark:text-gray-300 dark:hover:bg-white/20 dark:focus:ring-white/30 dark:focus:ring-offset-black"
        >
          Browse open bounties →
        </Link>
      </div>
    </div>
  );
}
