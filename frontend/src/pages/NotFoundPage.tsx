import { Link } from 'react-router-dom';

/**
 * 404 Not Found Page
 * Displayed when a user navigates to an invalid route.
 */
export function NotFoundPage() {
  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col items-center justify-center px-4 py-12">
      <div className="text-center">
        {/* Logo */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-purple-600">
          <span className="text-2xl font-bold text-white">SF</span>
        </div>

        {/* 404 Text */}
        <h1 className="mb-2 text-6xl font-bold text-gray-900 dark:text-white">404</h1>

        {/* Page not found message */}
        <h2 className="mb-4 text-xl font-semibold text-gray-700 dark:text-gray-300">
          Page not found
        </h2>

        <p className="mb-8 max-w-md text-sm text-gray-500 dark:text-gray-400">
          The page you're looking for doesn't exist or has been moved.
        </p>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-6 py-2.5
                       text-sm font-medium text-white transition-colors
                       hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-brand-500 focus-visible:ring-offset-2
                       dark:focus-visible:ring-offset-gray-900"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18"
              />
            </svg>
            Back to Home
          </Link>

          <Link
            to="/bounties"
            className="inline-flex items-center justify-center rounded-lg border border-gray-300
                       dark:border-gray-700 bg-transparent px-6 py-2.5 text-sm font-medium
                       text-gray-700 dark:text-gray-300 transition-colors
                       hover:bg-gray-100 dark:hover:bg-gray-800
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500
                       focus-visible:ring-offset-2 dark:focus-visible:ring-offset-gray-900"
          >
            Browse open bounties
            <svg
              className="ml-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3"
              />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;