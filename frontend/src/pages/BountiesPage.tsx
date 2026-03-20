import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { BountyBoard } from '../components/bounties/BountyBoard';
/** Integrates BountyBoard with the existing Sidebar layout. Route: /bounties */
export function BountiesPage() {
  const [c, setC] = useState(false);
  return (
    <div className="flex min-h-screen bg-surface dark">
      <Sidebar collapsed={c} onToggle={() => setC(p => !p)} />
      <main className={'flex-1 transition-all ' + (c ? 'ml-16' : 'ml-64')} role="main" aria-label="Bounty board content"><BountyBoard /></main>
    </div>);
}
export default BountiesPage;
