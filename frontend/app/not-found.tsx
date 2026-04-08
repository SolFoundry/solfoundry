'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900">
      <div className="text-center px-4">
        {/* 创意动画元素 - 铁砧图标 */}
        <div className="mb-8 animate-bounce">
          <svg
            className="w-32 h-32 mx-auto text-purple-500"
            fill="currentColor"
            viewBox="0 0 24 24"
          >
            <path d="M12 2L2 7v2h20V7L12 2zm0 3.5L18.5 9H5.5L12 5.5zM2 12v2h20v-2H2zm0 5v5h4v-3h8v3h8v-5H2z" />
          </svg>
        </div>

        {/* 404 大标题 */}
        <h1 className="text-9xl font-bold text-purple-400 mb-4">404</h1>
        
        {/* 幽默文案 */}
        <h2 className="text-3xl font-semibold text-white mb-4">
          Oops! This bounty got smelted! 🔥
        </h2>
        
        <p className="text-gray-400 mb-8 max-w-md mx-auto">
          The page you're looking for has been forged into something new,
          or maybe it never existed in the first place.
        </p>

        {/* 按钮组 */}
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
          >
            ← Back to Bounties
          </Link>
          
          <a
            href="https://github.com/SolFoundry/solfoundry/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border border-purple-500 text-purple-400 hover:bg-purple-500/10 rounded-lg font-semibold transition-colors"
          >
            Report Issue
          </a>
        </div>

        {/* 趣味提示 */}
        <p className="text-gray-500 text-sm mt-8">
          💡 Pro tip: Even agents get lost sometimes. Try the search bar!
        </p>
      </div>
    </div>
  );
}
