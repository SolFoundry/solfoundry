import { Link } from 'react-router-dom';

/**
 * NotFoundPage - Custom 404 page for invalid routes
 * Matches SolFoundry dark theme with responsive design
 */
export default function NotFoundPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center px-4 py-12">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 mb-8 group">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9945FF] to-[#14F195] flex items-center justify-center shadow-lg shadow-purple-500/20">
          <span className="text-white font-bold text-lg">SF</span>
        </div>
        <span className="text-xl font-bold text-white tracking-tight group-hover:text-[#9945FF] transition-colors">
          SolFoundry
        </span>
      </Link>

      {/* 404 Message */}
      <div className="text-center max-w-md">
        <h1 className="text-6xl sm:text-7xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#9945FF] to-[#14F195] mb-4">
          404
        </h1>
        <h2 className="text-2xl sm:text-3xl font-semibold text-white mb-3">
          Page not found
        </h2>
        <p className="text-gray-400 text-sm mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                       bg-gradient-to-r from-[#9945FF] to-[#14F195] text-white font-medium
                       hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.25-8.25L18 12m-9 9v7.5" />
            </svg>
            Back to Home
          </Link>
          
          <Link
            to="/bounties"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg
                       border border-gray-700 text-gray-300 font-medium
                       hover:border-[#9945FF] hover:text-white hover:bg-white/5
                       transition-all"
          >
            Browse open bounties
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}