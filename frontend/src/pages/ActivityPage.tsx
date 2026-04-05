import React from 'react';
import { EventFeed } from '../components/activity/EventFeed';

export function ActivityPage() {
  return (
    <div className="min-h-screen bg-[#0a0a14] text-white px-6 py-16 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Live Activity</h1>
        <p className="text-white/50 text-sm">Real-time on-chain events from the Solana network.</p>
      </div>
      <EventFeed />
    </div>
  );
}
