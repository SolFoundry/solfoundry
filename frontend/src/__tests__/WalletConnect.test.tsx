import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { truncateAddress } from '../hooks/useWallet';

const mockDisconnect = vi.fn().mockResolvedValue(undefined);
const mockSelect = vi.fn();
let ws: Record<string, unknown> = {};
const W = [
  { adapter: { name: 'Phantom', icon: 'https://phantom.app/icon.png' }, readyState: 'Installed' },
  { adapter: { name: 'Solflare', icon: 'https://solflare.com/icon.png' }, readyState: 'Installed' },
  { adapter: { name: 'Backpack', icon: 'https://backpack.app/icon.png' }, readyState: 'Installed' },
];
const ADDR = '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF';
const PK = { toBase58: () => ADDR };

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ws,
  useConnection: () => ({ connection: { rpcEndpoint: 'https://api.devnet.solana.com' } }),
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  WalletProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@solana/wallet-adapter-wallets', () => ({
  PhantomWalletAdapter: vi.fn(() => ({ name: 'Phantom' })),
  SolflareWalletAdapter: vi.fn(() => ({ name: 'Solflare' })),
  BackpackWalletAdapter: vi.fn(() => ({ name: 'Backpack' })),
}));
vi.mock('@solana/web3.js', () => ({ clusterApiUrl: (n: string) => `https://api.${n}.solana.com` }));

import { WalletConnect, SOLFOUNDRY_GREEN, SOLANA_PURPLE } from '../components/wallet';
import { WalletProvider, NetworkSelector } from '../components/wallet';

const rw = (ui: React.ReactElement) => render(<WalletProvider>{ui}</WalletProvider>);
const C = () => { ws = { publicKey: PK, wallet: { adapter: { name: 'Phantom', icon: 'https://phantom.app/icon.png' } }, connected: true, connecting: false, disconnect: mockDisconnect, select: mockSelect, connect: vi.fn(), wallets: W }; };
const D = () => { ws = { publicKey: null, wallet: null, connected: false, connecting: false, disconnect: mockDisconnect, select: mockSelect, connect: vi.fn(), wallets: W }; };

describe('truncateAddress', () => {
  it('handles all cases', () => {
    expect(truncateAddress(ADDR)).toBe('97Vi...JxF');
    expect(truncateAddress('AbCd5678')).toBe('AbCd5678');
    expect(truncateAddress(ADDR, 6, 6)).toBe('97VihH...3LyJxF');
    expect(truncateAddress('')).toBe('');
    expect(truncateAddress('ABCDEFGHIJKL')).toBe('ABCD...IJKL');
  });
});

describe('WalletConnect', () => {
  beforeEach(() => { vi.clearAllMocks(); D(); });

  it('exports $FNDRY brand colors', () => { expect(SOLFOUNDRY_GREEN).toBe('#00FF88'); expect(SOLANA_PURPLE).toBe('#9945FF'); });

  it('disconnected: shows connect button + network selector', () => {
    rw(<WalletConnect />);
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select network/i })).toBeInTheDocument();
  });

  it('connect flow: modal with SolFoundry branding -> select Phantom', async () => {
    rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    const d = screen.getByRole('dialog');
    expect(d).toHaveAttribute('aria-modal', 'true');
    expect(within(d).getByText('SolFoundry')).toBeInTheDocument();
    expect(within(d).getByText('Phantom')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /connect with phantom/i }));
    expect(mockSelect).toHaveBeenCalledWith('Phantom');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('connected: address chip + icon + disconnect', async () => {
    C(); rw(<WalletConnect />);
    expect(screen.getByText('97Vi...JxF')).toBeInTheDocument();
    expect(screen.getByAltText('Phantom')).toHaveAttribute('src', 'https://phantom.app/icon.png');
    expect(screen.getByLabelText(new RegExp(`Wallet address: ${ADDR}`))).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /disconnect wallet/i }));
    expect(mockDisconnect).toHaveBeenCalledOnce();
  });

  it('copy address: clipboard + confirmation', async () => {
    const wt = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: wt } });
    C(); rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /copy wallet address/i }));
    expect(wt).toHaveBeenCalledWith(ADDR);
    await waitFor(() => expect(screen.getByRole('button', { name: /address copied/i })).toBeInTheDocument());
  });

  it('connecting shows status indicator', () => {
    ws = { ...ws, connecting: true, publicKey: null, connected: false };
    rw(<WalletConnect />);
    expect(screen.getByRole('status', { name: /connecting/i })).toBeInTheDocument();
  });

  it('Escape closes modal', async () => {
    rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('clipboard fallback uses execCommand', async () => {
    C(); Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('x')) } });
    const s = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /copy wallet address/i }));
    await waitFor(() => expect(s).toHaveBeenCalledWith('copy'));
    s.mockRestore();
  });

  it('disconnect error logged not thrown', async () => {
    C(); const s = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockDisconnect.mockRejectedValueOnce(new Error('fail'));
    rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /disconnect wallet/i }));
    await waitFor(() => expect(s).toHaveBeenCalledWith('SolFoundry: wallet disconnect failed:', expect.any(Error)));
    s.mockRestore();
  });

  it('no wallets shows $FNDRY install prompt', async () => {
    ws = { ...ws, wallets: [] }; rw(<WalletConnect />);
    await userEvent.click(screen.getByRole('button', { name: /connect wallet/i }));
    expect(screen.getByText(/\$FNDRY/i)).toBeInTheDocument();
  });
});

describe('NetworkSelector', () => {
  it('Devnet default + dropdown + select Mainnet', async () => {
    rw(<NetworkSelector />);
    expect(screen.getByText('Devnet')).toBeInTheDocument();
    const b = screen.getByRole('button', { name: /select network/i });
    expect(b).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(b);
    expect(b).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    const opt = screen.getAllByRole('option').find(o => o.textContent?.includes('Devnet'));
    expect(opt).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(screen.getByText('Mainnet'));
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });
});

describe('WalletProvider', () => {
  it('renders children', () => {
    render(<WalletProvider><span data-testid="c">OK</span></WalletProvider>);
    expect(screen.getByTestId('c')).toBeInTheDocument();
  });
});
