/** SolFoundry network selector. */
import { useState, useRef, useEffect } from 'react';
import { useNetwork } from './WalletProvider';
import type { SolanaNetwork } from '../../types/wallet';

/** Network dropdown. */
export function NetworkSelector() {
  const { network, setNetwork, networkOptions } = useNetwork();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [open]);

  const cur = networkOptions.find(o => o.value === network);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-label="Select network"
        aria-expanded={open} aria-haspopup="listbox"
        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-surface-light px-3 py-1.5 text-xs text-gray-800 dark:border-surface-300 dark:bg-surface-100 dark:text-gray-300">
        <span className={`h-2 w-2 rounded-full ${network === 'mainnet-beta' ? 'bg-solana-mint' : 'bg-yellow-500'}`} aria-hidden="true" />
        {cur?.label ?? network}
      </button>
      {open && (
        <ul role="listbox" aria-label="Network options"
          className="absolute right-0 top-full mt-1 z-50 min-w-[140px] rounded-lg border border-gray-200 bg-surface-light py-1 shadow-lg dark:border-surface-300 dark:bg-surface-100 dark:shadow-none">
          {networkOptions.map(opt => (
            <li key={opt.value} role="option" aria-selected={opt.value === network}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-xs ${opt.value === network ? 'text-solana-mint' : 'text-gray-700 hover:bg-surface-light-100 dark:text-gray-300 dark:hover:bg-surface-200'}`}
              onClick={() => { setNetwork(opt.value as SolanaNetwork); setOpen(false); }}>
              <span className={`h-2 w-2 rounded-full ${opt.value === 'mainnet-beta' ? 'bg-solana-mint' : 'bg-yellow-500'}`} aria-hidden="true" />
              {opt.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
