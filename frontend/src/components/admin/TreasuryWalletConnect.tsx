/**
 * Minimal wallet connect for the admin treasury gate (dark admin shell).
 * Avoids SiteLayout-oriented styling from the main WalletConnect component.
 */
import { useState, useRef, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import type { WalletName } from '@solana/wallet-adapter-base';

function WalletPickerModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { wallets, select } = useWallet();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70"
      role="dialog"
      aria-modal="true"
      aria-label="Connect wallet"
      onClick={e => {
        if (ref.current && !ref.current.contains(e.target as Node)) onClose();
      }}
    >
      <div
        ref={ref}
        className="w-full max-w-sm rounded-xl border border-white/10 bg-[#13131f] p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Connect wallet</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-xs text-gray-500 hover:text-white"
          >
            ✕
          </button>
        </div>
        <ul className="space-y-2" role="list">
          {wallets.map(w => (
            <li key={w.adapter.name}>
              <button
                type="button"
                className="flex w-full items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-gray-200 hover:bg-white/10"
                onClick={() => {
                  select(w.adapter.name as WalletName);
                  onClose();
                }}
              >
                {w.adapter.icon ? (
                  <img
                    src={w.adapter.icon}
                    alt=""
                    className="h-8 w-8 rounded-lg"
                    width={32}
                    height={32}
                  />
                ) : null}
                {w.adapter.name}
              </button>
            </li>
          ))}
        </ul>
        {wallets.length === 0 && (
          <p className="py-6 text-center text-xs text-gray-500">
            No browser wallets found. Install Phantom or Solflare.
          </p>
        )}
      </div>
    </div>
  );
}

export function TreasuryWalletConnect() {
  const { connected, connecting, disconnect, publicKey, wallet } = useWallet();
  const [modalOpen, setModalOpen] = useState(false);

  if (connecting) {
    return (
      <div className="rounded-lg border border-[#14F195]/30 bg-[#14F195]/10 px-4 py-2 text-xs text-[#14F195]">
        Connecting…
      </div>
    );
  }

  if (!connected || !publicKey) {
    return (
      <>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-gradient-to-r from-[#9945FF] to-[#14F195] px-4 py-2 text-xs font-semibold text-white hover:opacity-90"
        >
          Connect wallet
        </button>
        <WalletPickerModal open={modalOpen} onClose={() => setModalOpen(false)} />
      </>
    );
  }

  const addr = publicKey.toBase58();
  const short = `${addr.slice(0, 4)}…${addr.slice(-4)}`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-mono text-gray-300" title={addr}>
        {wallet?.adapter.name ?? 'Wallet'} · {short}
      </span>
      <button
        type="button"
        onClick={() => disconnect().catch(console.error)}
        className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-gray-400 hover:text-white"
      >
        Disconnect
      </button>
    </div>
  );
}
