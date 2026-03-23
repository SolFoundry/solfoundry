/**
 * NotFoundPage — Custom 404 page with SolFoundry anvil branding.
 *
 * Features a fun animated anvil drop illustration, witty copy, and clear
 * navigation back to bounties or home. Matches site dark/light theme.
 *
 * @module pages/NotFoundPage
 */
import { Link } from 'react-router-dom';
import { SolFoundryLogoMark } from '../components/common/SolFoundryLogoMark';

/** Animated falling anvil SVG — pure CSS animation, no JS required. */
function AnvilIllustration() {
  return (
    <div className="relative flex items-center justify-center w-40 h-40 mx-auto mb-6 select-none" aria-hidden="true">
      {/* Ground shadow — scales as anvil falls */}
      <div
        className="absolute bottom-2 left-1/2 -translate-x-1/2 w-20 h-4 bg-gray-900/20 dark:bg-black/40 rounded-full"
        style={{ animation: 'sf-shadow 1.6s ease-in-out infinite' }}
      />

      {/* Anvil emoji with bounce + drop animation */}
      <div
        className="text-7xl"
        style={{ animation: 'sf-anvil-drop 1.6s ease-in-out infinite' }}
      >
        🔨
      </div>

      {/* Stars / dust particles on impact */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 text-2xl"
        style={{ animation: 'sf-stars 1.6s ease-in-out infinite' }}
      >
        ✨
      </div>

      <style>{`
        @keyframes sf-anvil-drop {
          0%   { transform: translateY(-60px) rotate(-10deg); opacity: 0; }
          30%  { transform: translateY(-60px) rotate(-10deg); opacity: 1; }
          60%  { transform: translateY(0px) rotate(0deg); }
          70%  { transform: translateY(-8px) rotate(2deg); }
          80%  { transform: translateY(0px) rotate(0deg); }
          100% { transform: translateY(0px) rotate(0deg); opacity: 1; }
        }
        @keyframes sf-shadow {
          0%, 30% { transform: translateX(-50%) scaleX(0.3); opacity: 0; }
          60%      { transform: translateX(-50%) scaleX(1);   opacity: 1; }
          70%      { transform: translateX(-50%) scaleX(0.8); opacity: 0.8; }
          80%      { transform: translateX(-50%) scaleX(1);   opacity: 1; }
          100%     { transform: translateX(-50%) scaleX(1);   opacity: 1; }
        }
        @keyframes sf-stars {
          0%, 55% { opacity: 0; transform: translateX(-50%) scale(0); }
          65%     { opacity: 1; transform: translateX(-50%) scale(1.2); }
          85%     { opacity: 0.6; transform: translateX(-50%) scale(0.8); }
          100%    { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 py-16 text-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-6">
        <SolFoundryLogoMark size="lg" className="shadow-lg shadow-solana-purple/20" />
        <span className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
          SolFoundry
        </span>
      </div>

      {/* Animated anvil */}
      <AnvilIllustration />

      {/* 404 */}
      <p className="text-8xl font-extrabold text-solana-purple leading-none mb-4 select-none tabular-nums">
        404
      </p>

      {/* Witty headline */}
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Bounty not found — it fell off the anvil
      </h1>
      <p className="text-gray-600 dark:text-gray-400 text-sm max-w-sm mb-10">
        This page doesn&apos;t exist or has been moved. The good news? There are
        plenty of real bounties waiting for you.
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <Link
          to="/bounties"
          className="px-6 py-2.5 rounded-lg bg-solana-purple text-white font-semibold text-sm
                     hover:bg-violet-700 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-solana-purple focus:ring-offset-2
                     focus:ring-offset-white dark:focus:ring-offset-black"
        >
          Browse open bounties →
        </Link>
        <Link
          to="/"
          className="px-6 py-2.5 rounded-lg border border-gray-300 bg-gray-100 text-gray-800 font-medium text-sm
                     hover:bg-gray-200 transition-colors
                     focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2
                     focus:ring-offset-white dark:border-transparent dark:bg-white/10 dark:text-gray-300
                     dark:hover:bg-white/20 dark:focus:ring-white/30 dark:focus:ring-offset-black"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
