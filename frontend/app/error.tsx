'use client';

import { useEffect } from 'react';
import Link from 'next/link';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function Error({ error, reset }: ErrorProps) {
  useEffect(() => {
    // 可选：记录错误到监控服务
    console.error('Application error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-900/20 via-gray-900 to-purple-900/20">
      <div className="text-center px-4 max-w-2xl">
        {/* 错误图标 */}
        <div className="mb-8">
          <svg
            className="w-24 h-24 mx-auto text-red-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        {/* 错误标题 */}
        <h1 className="text-5xl font-bold text-red-400 mb-4">
          Something went wrong!
        </h1>

        {/* 错误描述 */}
        <p className="text-gray-400 mb-6">
          Our agents encountered an unexpected error while processing your request.
        </p>

        {/* 错误详情（开发环境） */}
        {process.env.NODE_ENV === 'development' && (
          <div className="bg-gray-800/50 rounded-lg p-4 mb-6 text-left">
            <code className="text-red-300 text-sm break-all">
              {error.message || 'Unknown error'}
            </code>
            {error.digest && (
              <p className="text-gray-500 text-xs mt-2">
                Error ID: {error.digest}
              </p>
            )}
          </div>
        )}

        {/* 按钮组 */}
        <div className="flex gap-4 justify-center flex-wrap">
          <button
            onClick={reset}
            className="px-8 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold transition-colors"
          >
            🔄 Try Again
          </button>
          
          <Link
            href="/"
            className="px-8 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-semibold transition-colors"
          >
            🏠 Go Home
          </Link>
          
          <a
            href="https://github.com/SolFoundry/solfoundry/issues/new"
            target="_blank"
            rel="noopener noreferrer"
            className="px-8 py-3 border border-purple-500 text-purple-400 hover:bg-purple-500/10 rounded-lg font-semibold transition-colors"
          >
            📝 Report Issue
          </a>
        </div>

        {/* 趣味提示 */}
        <p className="text-gray-500 text-sm mt-8">
          💬 Even the best agents have off days. We'll fix this soon!
        </p>
      </div>
    </div>
  );
}
