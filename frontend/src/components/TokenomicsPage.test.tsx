import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TokenomicsPage } from './TokenomicsPage';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock clipboard API
const mockClipboard = {
  writeText: jest.fn(),
};
Object.assign(navigator, {
  clipboard: mockClipboard,
});

describe('TokenomicsPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Basic rendering tests
  it('renders page header', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Tokenomics')).toBeInTheDocument();
    expect(screen.getByText('Transparent, community-driven token economy')).toBeInTheDocument();
  });

  it('renders slogan banner', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText(/No VC\. No presale\. No airdrop\./)).toBeInTheDocument();
    expect(screen.getByText('Earn by building.')).toBeInTheDocument();
  });

  // Token Distribution tests
  it('renders token distribution section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('🎯 Token Distribution')).toBeInTheDocument();
  });

  it('renders distribution legend items', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Treasury')).toBeInTheDocument();
    expect(screen.getByText('Liquidity')).toBeInTheDocument();
    expect(screen.getByText('Team (1% vesting)')).toBeInTheDocument();
  });

  // Buyback Mechanism tests
  it('renders buyback mechanism section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('🔄 Buyback & Burn Mechanism')).toBeInTheDocument();
  });

  it('renders buyback cycle steps', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('5% Fee')).toBeInTheDocument();
    expect(screen.getByText('Buyback')).toBeInTheDocument();
    expect(screen.getByText('Burn')).toBeInTheDocument();
    expect(screen.getByText('Repeat')).toBeInTheDocument();
  });

  it('renders buyback step descriptions', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Transaction fee collected')).toBeInTheDocument();
    expect(screen.getByText('Auto-buy FNDRY from market')).toBeInTheDocument();
    expect(screen.getByText('Permanently remove tokens')).toBeInTheDocument();
    expect(screen.getByText('Deflationary cycle continues')).toBeInTheDocument();
  });

  // Treasury Stats tests
  it('renders treasury stats section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('🏛️ Treasury Stats')).toBeInTheDocument();
  });

  it('renders treasury stat labels', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('SOL Balance')).toBeInTheDocument();
    expect(screen.getByText('FNDRY Balance')).toBeInTheDocument();
    expect(screen.getByText('Total Spent')).toBeInTheDocument();
    expect(screen.getByText('Total Burned')).toBeInTheDocument();
  });

  it('displays loading state initially', () => {
    render(<TokenomicsPage />);
    // Loading spinners should be present during initial load
    const loadingSpinners = document.querySelectorAll('.animate-spin');
    expect(loadingSpinners.length).toBeGreaterThan(0);
  });

  // Supply Analysis tests
  it('renders supply analysis section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('📊 Supply Analysis')).toBeInTheDocument();
  });

  it('renders supply labels', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Circulating')).toBeInTheDocument();
    expect(screen.getByText('Locked')).toBeInTheDocument();
    expect(screen.getByText('Burned')).toBeInTheDocument();
    expect(screen.getByText('Total Supply')).toBeInTheDocument();
  });

  // Price Chart tests
  it('renders price chart section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('📈 Price Chart')).toBeInTheDocument();
  });

  it('renders chart type toggle buttons', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('DexScreener')).toBeInTheDocument();
    expect(screen.getByText('Custom')).toBeInTheDocument();
  });

  it('toggles between chart types', () => {
    render(<TokenomicsPage />);
    
    // Default is DexScreener
    expect(screen.getByText('DexScreener embed will appear here')).toBeInTheDocument();
    
    // Click Custom button
    fireEvent.click(screen.getByText('Custom'));
    expect(screen.getByText('Custom price chart placeholder')).toBeInTheDocument();
  });

  // Token Info tests
  it('renders token info section', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('🪙 Token Info')).toBeInTheDocument();
  });

  it('renders contract address label', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Contract Address')).toBeInTheDocument();
  });

  it('displays contract address', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('FNDRyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX')).toBeInTheDocument();
  });

  it('renders token details', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Chain')).toBeInTheDocument();
    expect(screen.getByText('Decimals')).toBeInTheDocument();
    expect(screen.getByText('Symbol')).toBeInTheDocument();
    expect(screen.getByText('Solana')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('FNDRY')).toBeInTheDocument();
  });

  it('renders token links', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Bags ↗')).toBeInTheDocument();
    expect(screen.getByText('Solscan ↗')).toBeInTheDocument();
    expect(screen.getByText('DexScreener ↗')).toBeInTheDocument();
  });

  // Clipboard functionality
  it('copies contract address to clipboard', async () => {
    render(<TokenomicsPage />);
    
    const copyButton = screen.getByTitle('Copy to clipboard');
    fireEvent.click(copyButton);
    
    expect(mockClipboard.writeText).toHaveBeenCalledWith('FNDRyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX');
    
    // Check for copied state
    await waitFor(() => {
      expect(screen.getByTitle('Copied!')).toBeInTheDocument();
    });
  });

  // Responsive layout tests
  it('has responsive grid layout', () => {
    const { container } = render(<TokenomicsPage />);
    expect(container.querySelector('.grid-cols-1')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:grid-cols-2')).toBeInTheDocument();
  });

  it('has responsive text sizes', () => {
    const { container } = render(<TokenomicsPage />);
    // Check for responsive text classes
    expect(container.querySelector('.text-3xl')).toBeInTheDocument();
    expect(container.querySelector('.sm\\:text-4xl')).toBeInTheDocument();
    expect(container.querySelector('.lg\\:text-5xl')).toBeInTheDocument();
  });

  // Touch-friendly buttons test
  it('has touch-friendly buttons (min 44px)', () => {
    render(<TokenomicsPage />);
    
    // Check chart toggle buttons
    const buttons = screen.getAllByRole('button');
    const touchButtons = buttons.filter(
      (btn) => btn.classList.contains('min-h-[44px]') || btn.closest('.min-h-\\[44px\\]')
    );
    expect(touchButtons.length).toBeGreaterThan(0);
  });

  // Footer test
  it('renders footer text', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('Data updates in real-time from on-chain sources')).toBeInTheDocument();
  });

  // Community text test
  it('renders community-driven text', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText('100% community-driven. Fair launch. No exceptions.')).toBeInTheDocument();
  });

  // Accessibility tests
  it('has proper heading hierarchy', () => {
    render(<TokenomicsPage />);
    
    // Main heading should be h1
    const mainHeading = screen.getByRole('heading', { level: 1 });
    expect(mainHeading).toHaveTextContent('Tokenomics');
  });

  it('external links open in new tab', () => {
    render(<TokenomicsPage />);
    
    const externalLinks = screen.getAllByRole('link').filter(
      (link) => link.getAttribute('target') === '_blank'
    );
    expect(externalLinks.length).toBeGreaterThan(0);
    
    // Should have rel="noopener noreferrer" for security
    externalLinks.forEach((link) => {
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  // Animation tests
  it('renders animated elements', () => {
    const { container } = render(<TokenomicsPage />);
    
    // Check for animation classes
    expect(container.querySelector('.transition-all')).toBeInTheDocument();
    expect(container.querySelector('.duration-700')).toBeInTheDocument();
  });

  // Loading state tests
  it('shows loading spinner during data fetch', () => {
    const { container } = render(<TokenomicsPage />);
    
    const spinner = container.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });

  // Last updated timestamp test
  it('displays last updated timestamp', () => {
    render(<TokenomicsPage />);
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
  });
});