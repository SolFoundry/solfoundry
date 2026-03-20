/** SolFoundry wallet hook. Persistence: in-memory (MVP); migrate to localStorage. */
import { useCallback, useMemo, useState } from 'react';
import { useWallet as useSolanaWallet, useConnection } from '@solana/wallet-adapter-react';
import type { WalletConnectionStatus, WalletDisplayInfo } from '../types/wallet';

/** Truncate Solana address for display. */
export function truncateAddress(address: string, startChars = 4, endChars = 4): string {
  if (address.length <= startChars + endChars + 3) return address;
  return `${address.slice(0, startChars)}...${address.slice(-endChars)}`;
}

/** SolFoundry wallet connection state and actions. */
export function useWalletConnection() {
  const { publicKey, wallet, connected, connecting, disconnect: adapterDisconnect, select, wallets } = useSolanaWallet();
  const { connection } = useConnection();
  const [copied, setCopied] = useState(false);

  const status: WalletConnectionStatus = useMemo(() => {
    if (connecting) return 'connecting';
    if (connected && publicKey) return 'connected';
    return 'disconnected';
  }, [connecting, connected, publicKey]);

  const displayInfo: WalletDisplayInfo | null = useMemo(() => {
    if (!publicKey || !wallet) return null;
    const address = publicKey.toBase58();
    return { address, truncatedAddress: truncateAddress(address), walletName: wallet.adapter.name, walletIcon: wallet.adapter.icon };
  }, [publicKey, wallet]);

  const copyAddress = useCallback(async () => {
    if (!publicKey) return;
    try {
      await navigator.clipboard.writeText(publicKey.toBase58());
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = publicKey.toBase58();
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    }
  }, [publicKey]);

  const disconnect = useCallback(async () => {
    try { await adapterDisconnect(); } catch (error) { console.error('SolFoundry: wallet disconnect failed:', error); }
  }, [adapterDisconnect]);

  return { status, connected, connecting, publicKey, displayInfo, copied, connection, wallets, wallet, select, disconnect, copyAddress };
}
