/**
 * WalletAuthFlow — silently authenticates against the backend whenever a
 * Solana wallet connects.  Rendered once inside AppLayout so every page
 * benefits without any extra wiring.
 */
import { useEffect, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAuthContext } from '../../contexts/AuthContext';
import { getWalletAuthMessage, authenticateWithWallet } from '../../services/authService';

export function WalletAuthFlow() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = useWallet() as any;
  const publicKey = wallet.publicKey as { toBase58: () => string } | null;
  const connected = wallet.connected as boolean;
  const signMessage = wallet.signMessage as ((msg: Uint8Array) => Promise<Uint8Array>) | undefined;
  const { login, logout, isAuthenticated, user } = useAuthContext();
  const authInProgress = useRef(false);

  // Auto-authenticate when wallet connects (and we don't have a session yet
  // or the session belongs to a different wallet).
  useEffect(() => {
    if (!connected || !publicKey || !signMessage) return;
    const address = publicKey.toBase58();

    // Already authenticated for this wallet
    if (isAuthenticated && user?.wallet_address?.toLowerCase() === address.toLowerCase()) return;

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
        login(result.access_token, result.refresh_token, result.user);
      } catch (err) {
        console.warn('[WalletAuthFlow] auth failed:', err);
      } finally {
        authInProgress.current = false;
      }
    })();
  }, [connected, publicKey, signMessage, isAuthenticated, user, login]);

  // When wallet disconnects, clear the session
  useEffect(() => {
    if (!connected && isAuthenticated) {
      logout();
    }
  }, [connected, isAuthenticated, logout]);

  return null;
}
