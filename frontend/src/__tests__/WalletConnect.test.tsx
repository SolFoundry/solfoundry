import { render, screen } from '@testing-library/react';
import { WalletConnect } from '../components/WalletConnect';
import { WalletProvider } from '../components/WalletProvider';

// Mock wallet adapter
jest.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
    connecting: false,
    disconnect: jest.fn(),
  }),
  useConnection: () => ({
    connection: {
      rpcEndpoint: 'https://api.mainnet-beta.solana.com',
    },
  }),
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@solana/wallet-adapter-react-ui', () => ({
  useWalletModal: () => ({
    setVisible: jest.fn(),
  }),
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('WalletConnect', () => {
  it('renders connect button when disconnected', () => {
    render(
      <WalletProvider>
        <WalletConnect />
      </WalletProvider>
    );
    
    expect(screen.getByText('Connect Wallet')).toBeInTheDocument();
  });

  it('shows network selector', () => {
    render(
      <WalletProvider>
        <WalletConnect />
      </WalletProvider>
    );
    
    expect(screen.getByText('mainnet-beta')).toBeInTheDocument();
  });
});

describe('useWallet hook', () => {
  it('returns correct initial state', () => {
    const { result } = renderHook(() => useWallet());
    
    expect(result.current.connected).toBe(false);
    expect(result.current.connecting).toBe(false);
    expect(result.current.address).toBeNull();
    expect(result.current.balance).toBeNull();
  });
});

describe('WalletProvider', () => {
  it('renders children correctly', () => {
    render(
      <WalletProvider>
        <div data-testid="child">Test Child</div>
      </WalletProvider>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('accepts network prop', () => {
    render(
      <WalletProvider network="devnet">
        <div data-testid="child">Test</div>
      </WalletProvider>
    );
    
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });
});
