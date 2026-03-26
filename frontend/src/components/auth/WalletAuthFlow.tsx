/**
 * WalletAuthFlow — silently authenticates against the backend whenever a
 * Solana wallet connects.  Rendered once inside AppLayout so every page
 * benefits without any extra wiring.
 *
 * Guards against re-auth on navigation: checks both AuthContext state AND
 * localStorage directly to avoid the race where AuthContext hasn't restored
 * from localStorage yet but the wallet effect already fires.
 */
import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { getWalletAuthMessage, authenticateWithWallet } from '../../services/authService';
import { useToast } from '../../hooks/useToast';

/** Check localStorage directly — avoids race with AuthContext hydration. */
function hasExistingSession(walletAddress: string): boolean {
  try {
    const token = localStorage.getItem('sf_access_token');
    const userRaw = localStorage.getItem('sf_user');
    if (!token || !userRaw) return false;
    const user = JSON.parse(userRaw);
    return user?.wallet_address?.toLowerCase() === walletAddress.toLowerCase();
  } catch {
    return false;
  }
}

export function WalletAuthFlow() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = useWallet() as any;
  const publicKey = wallet.publicKey as { toBase58: () => string } | null;
  const connected = wallet.connected as boolean;
  const signMessage = wallet.signMessage as ((msg: Uint8Array) => Promise<Uint8Array>) | undefined;
  const { login, logout, isAuthenticated, isLoading, user } = useAuthContext();
  const authInProgress = useRef(false);
  const lastAuthAddress = useRef<string | null>(null);
  const toast = useToast();

  // Stable ref to avoid re-triggering effect when login/user change
  const loginRef = useRef(login);
  loginRef.current = login;
  const isAuthRef = useRef(isAuthenticated);
  isAuthRef.current = isAuthenticated;
  const userRef = useRef(user);
  userRef.current = user;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // Auto-authenticate when wallet connects — only depends on wallet state,
  // not on auth state (prevents cascade after login updates auth context).
  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;
    let cancelled = false;
    const address = publicKey.toBase58();

    // Wait for AuthContext to finish restoring from localStorage
    if (isLoadingRef.current) return;

    // Already authenticated for this wallet via AuthContext
    if (isAuthRef.current && userRef.current?.wallet_address?.toLowerCase() === address.toLowerCase()) return;

    // Fallback: check localStorage directly in case AuthContext hasn't
    // propagated yet (e.g. rapid navigation between pages)
    if (hasExistingSession(address)) {
      lastAuthAddress.current = address;
      return;
    }

    // Already completed auth for this address in this session
    if (lastAuthAddress.current === address) return;

    // Prevent concurrent auth attempts
    if (authInProgress.current) return;
    authInProgress.current = true;

    (async () => {
      try {
        const { message } = await getWalletAuthMessage(address);
        if (cancelled) return;
        const encoded = new TextEncoder().encode(message);
        const sigBytes = await signMessage(encoded);
        if (cancelled) return;
        // Backend expects base64-encoded signature
        const signature = btoa(String.fromCharCode(...sigBytes));
        const result = await authenticateWithWallet({ wallet_address: address, signature, message });
        if (cancelled) return;
        lastAuthAddress.current = address;
        loginRef.current(result.access_token, result.refresh_token, result.user);
      } catch (err) {
        console.warn('[WalletAuthFlow] auth failed:', err);
        if (!cancelled) {
          toast.error('Wallet authentication failed. Please try reconnecting your wallet.');
        }
      } finally {
        authInProgress.current = false;
      }
    })();

    return () => { cancelled = true; };
  }, [connected, publicKey, signMessage, toast]);

  // When wallet disconnects, clear the session
  useEffect(() => {
    if (!connected && isAuthenticated) {
      lastAuthAddress.current = null;
      logout();
    }
  }, [connected, isAuthenticated, logout]);

  return null;
}
