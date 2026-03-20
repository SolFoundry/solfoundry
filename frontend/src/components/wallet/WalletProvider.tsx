/** SolFoundry wallet provider. Persistence: in-memory (MVP); migrate to localStorage. */
import { type ReactNode, useMemo, useState, createContext, useContext, useCallback } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter, BackpackWalletAdapter } from '@solana/wallet-adapter-wallets';
import { clusterApiUrl } from '@solana/web3.js';
import type { SolanaNetwork, NetworkOption } from '../../types/wallet';

export const NETWORK_OPTIONS: NetworkOption[] = [
  { label: 'Mainnet', value: 'mainnet-beta', endpoint: clusterApiUrl('mainnet-beta') },
  { label: 'Devnet', value: 'devnet', endpoint: clusterApiUrl('devnet') },
];
const DEFAULT_NETWORK: SolanaNetwork = 'devnet';

interface NetworkCtx { network: SolanaNetwork; endpoint: string; setNetwork: (n: SolanaNetwork) => void; networkOptions: NetworkOption[]; }
const NetworkContext = createContext<NetworkCtx>({ network: DEFAULT_NETWORK, endpoint: clusterApiUrl(DEFAULT_NETWORK), setNetwork: () => {}, networkOptions: NETWORK_OPTIONS });
/** Access current network and switch clusters. */
export const useNetwork = () => useContext(NetworkContext);

/** Root provider: Solana wallet adapter + network context. */
export function WalletProvider({ children, defaultNetwork = DEFAULT_NETWORK }: { children: ReactNode; defaultNetwork?: SolanaNetwork }) {
  const [network, setNetworkState] = useState<SolanaNetwork>(defaultNetwork);
  const endpoint = useMemo(() => NETWORK_OPTIONS.find(o => o.value === network)?.endpoint ?? clusterApiUrl(network), [network]);
  const wallets = useMemo(() => [new PhantomWalletAdapter(), new SolflareWalletAdapter(), new BackpackWalletAdapter()], []);
  const setNetwork = useCallback((n: SolanaNetwork) => setNetworkState(n), []);
  const ctx = useMemo<NetworkCtx>(() => ({ network, endpoint, setNetwork, networkOptions: NETWORK_OPTIONS }), [network, endpoint, setNetwork]);

  return (
    <NetworkContext.Provider value={ctx}>
      <ConnectionProvider endpoint={endpoint}>
        <SolanaWalletProvider wallets={wallets} autoConnect>{children}</SolanaWalletProvider>
      </ConnectionProvider>
    </NetworkContext.Provider>
  );
}
