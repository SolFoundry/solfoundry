/** SolFoundry wallet connect -- $FNDRY Header integration. */
import { useState, useRef, useEffect } from 'react';
import { useWallet as useSolanaWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';
import { useWalletConnection } from '../../hooks/useWallet';
import { NetworkSelector } from './NetworkSelector';

export const SOLFOUNDRY_GREEN = '#00FF88';
export const SOLANA_PURPLE = '#9945FF';

/** Wallet selector modal with SolFoundry branding. */
function WalletModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, select } = useSolanaWallet();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      role="dialog" aria-modal="true" aria-label="Connect wallet"
      onClick={e => { if (ref.current && !ref.current.contains(e.target as Node)) onClose(); }}>
      <div ref={ref} className="w-full max-w-sm rounded-2xl border border-gray-700 bg-surface-50 p-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white"><span className="text-solana-mint">SolFoundry</span> Wallet</h2>
          <button type="button" onClick={onClose} aria-label="Close wallet selector"
            className="h-8 w-8 rounded-lg text-gray-400 hover:text-white inline-flex items-center justify-center">X</button>
        </div>
        <ul className="space-y-2" role="list" aria-label="Available wallets">
          {wallets.map(w => (
            <li key={w.adapter.name}>
              <button type="button" aria-label={`Connect with ${w.adapter.name}`}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-700 bg-surface-100 px-4 py-3 text-sm text-gray-200 hover:text-white"
                onClick={() => { select(w.adapter.name as WalletName); onClose(); }}>
                <img src={w.adapter.icon} alt={`${w.adapter.name} icon`} className="h-8 w-8 rounded-lg" width={32} height={32} />
                {w.adapter.name}
              </button>
            </li>
          ))}
        </ul>
        {wallets.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-500">No wallet extensions detected. Install Phantom, Solflare, or Backpack to interact with $FNDRY bounties on SolFoundry.</p>
        )}
      </div>
    </div>
  );
}

/** SolFoundry wallet connect for Header. */
export function WalletConnect() {
  const { status, displayInfo, copied, disconnect, copyAddress } = useWalletConnection();
  const [modalOpen, setModalOpen] = useState(false);

  if (status === 'disconnected') return (
    <div className="flex items-center gap-2">
      <NetworkSelector />
      <button type="button" onClick={() => setModalOpen(true)} aria-label="Connect wallet"
        className="rounded-lg bg-solana-mint px-4 py-2 text-sm font-semibold text-surface hover:bg-solana-mint/90">Connect Wallet</button>
      <WalletModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );

  if (status === 'connecting') return (
    <div className="flex items-center gap-2">
      <NetworkSelector />
      <div className="rounded-lg border border-solana-mint/30 bg-solana-mint/10 px-4 py-2 text-sm text-solana-mint"
        role="status" aria-label="Connecting wallet">Connecting...</div>
    </div>
  );

  return (
    <div className="flex items-center gap-2">
      <NetworkSelector />
      <div className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-surface-100 pl-3 pr-1 py-1">
        {displayInfo && (
          <>
            <img src={displayInfo.walletIcon} alt={displayInfo.walletName} className="h-4 w-4" width={16} height={16} />
            <span className="mx-1 text-xs font-mono text-gray-300" title={displayInfo.address}
              aria-label={`Wallet address: ${displayInfo.address}`}>{displayInfo.truncatedAddress}</span>
          </>
        )}
        <button type="button" onClick={copyAddress} aria-label={copied ? 'Address copied' : 'Copy wallet address'}
          className="h-7 w-7 rounded-md text-gray-400 hover:text-solana-mint inline-flex items-center justify-center">
          {copied ? '\u2713' : '\u2398'}
        </button>
        <button type="button" onClick={disconnect} aria-label="Disconnect wallet"
          className="h-7 w-7 rounded-md text-gray-400 hover:text-red-400 inline-flex items-center justify-center">
          \u23FB
        </button>
      </div>
    </div>
  );
}
