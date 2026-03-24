/**
 * StakingPage — full-page wrapper for the $FNDRY staking interface.
 */
import React from 'react';
import { StakingDashboard } from '../components/staking/StakingDashboard';

export default function StakingPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">Stake $FNDRY</h1>
        <p className="text-gray-400 text-sm sm:text-base">
          Stake your $FNDRY tokens to earn APY rewards and boost your reputation score.
          Higher tiers unlock exclusive bounty access and multiplied reputation gains.
        </p>
      </div>
      <StakingDashboard />
    </main>
  );
}
