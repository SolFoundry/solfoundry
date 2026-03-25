/**
 * WalletAuthFlow — silently authenticates against the backend whenever a
 * Solana wallet connects.  Rendered once inside AppLayout so every page
 * benefits without any extra wiring.
 */
import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { getWalletAuthMessage, authenticateWithWallet } from '../../services/authService';
import { useToast } from '../../hooks/useToast';

export function WalletAuthFlow() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = useWallet() as any;
  const publicKey = wallet.publicKey as { toBase58: () => string } | null;
  const connected = wallet.connected as boolean;
  const signMessage = wallet.signMessage as ((msg: Uint8Array) => Promise<Uint8Array>) | undefined;
  const { login, logout, isAuthenticated, user } = useAuthContext();
  const authInProgress = useRef(false);
  const toast = useToast();

  // Auto-authenticate when wallet connects (and we don't have a session yet
  // or the session belongs to a different wallet).
  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;
    let cancelled = false;
    const address = publicKey.toBase58();

    // Already authenticated for this wallet — Base58 is case-sensitive
    if (isAuthenticated && user?.wallet_address === address) return;

    // Prevent concurrent auth attempts
    if (authInProgress.current) return;
    authInProgress.current = true;

    (async () => {
      try {
        const { message } = await getWalletAuthMessage(address);
        const encoded = new TextEncoder().encode(message);
        const sigBytes = await signMessage(encoded);
        // Backend expects base64-encoded signature
        const signature = btoa(String.fromCharCode(...sigBytes));
        const result = await authenticateWithWallet({ wallet_address: address, signature, message });
        if (cancelled) return;
        login(result.access_token, result.refresh_token, result.user);
      } catch (err) {
        console.warn('[WalletAuthFlow] auth failed:', err);
        if (!cancelled) {
          toast.error('Wallet authentication failed. Please try reconnecting your wallet.');
        }
      } finally {
        authInProgress.current = false;
      }
    })();

    return () => { cancelled = true; authInProgress.current = false; };
  }, [connected, publicKey, signMessage, isAuthenticated, user, login, toast]);

  // When wallet disconnects (or is not connected on mount), clear the session
  useEffect(() => {
    if (!connected && isAuthenticated) {
      logout();
    }
  }, [connected, isAuthenticated, logout]);

  return null;
}
