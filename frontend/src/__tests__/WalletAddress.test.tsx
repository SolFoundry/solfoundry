import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WalletAddress, truncateString } from '../components/wallet/WalletAddress';

const ADDR = '97VihHW2Br7BKUU16c7RxjiEMHsD4dWisGDT2Y3LyJxF';
const SHORT_ADDR = 'AbCd5678';

describe('truncateString', () => {
  it('truncates long strings correctly', () => {
    expect(truncateString(ADDR)).toBe('97Vi...JxF');
    expect(truncateString(ADDR, 6, 6)).toBe('97VihH...3LyJxF');
  });

  it('returns short strings unchanged', () => {
    expect(truncateString(SHORT_ADDR)).toBe(SHORT_ADDR);
    expect(truncateString('')).toBe('');
  });

  it('handles edge cases', () => {
    expect(truncateString('ABCDEFGHIJKL')).toBe('ABCD...IJKL');
    expect(truncateString('ABC', 1, 1)).toBe('ABC');
  });
});

describe('WalletAddress', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders truncated address by default', () => {
    render(<WalletAddress address={ADDR} />);
    expect(screen.getByText('97Vi...JxF')).toBeInTheDocument();
  });

  it('shows full address on hover via title attribute', () => {
    render(<WalletAddress address={ADDR} />);
    const addressSpan = screen.getByText('97Vi...JxF');
    expect(addressSpan).toHaveAttribute('title', ADDR);
  });

  it('does not show tooltip for short addresses', () => {
    render(<WalletAddress address={SHORT_ADDR} />);
    const addressSpan = screen.getByText(SHORT_ADDR);
    expect(addressSpan).not.toHaveAttribute('title');
  });

  it('shows copy button by default', () => {
    render(<WalletAddress address={ADDR} />);
    expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
  });

  it('hides copy button when showCopyButton is false', () => {
    render(<WalletAddress address={ADDR} showCopyButton={false} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('hides tooltip when showTooltip is false', () => {
    render(<WalletAddress address={ADDR} showTooltip={false} />);
    const addressSpan = screen.getByText('97Vi...JxF');
    expect(addressSpan).not.toHaveAttribute('title');
  });

  it('copies address to clipboard on click', async () => {
    const wt = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: wt } });
    
    render(<WalletAddress address={ADDR} />);
    await userEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
    
    expect(wt).toHaveBeenCalledWith(ADDR);
  });

  it('shows checkmark and "Copied!" after successful copy', async () => {
    const wt = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: wt } });
    
    render(<WalletAddress address={ADDR} />);
    await userEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('resets to copy icon after 2 seconds', async () => {
    const wt = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText: wt } });
    
    render(<WalletAddress address={ADDR} />);
    await userEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copied/i })).toBeInTheDocument();
    });
    
    // Fast-forward 2 seconds
    vi.advanceTimersByTime(2000);
    
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /copy to clipboard/i })).toBeInTheDocument();
      expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
    });
  });

  it('uses clipboard fallback when navigator.clipboard fails', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('fail')) } });
    const execCommandMock = vi.spyOn(document, 'execCommand').mockReturnValue(true);
    
    render(<WalletAddress address={ADDR} />);
    await userEvent.click(screen.getByRole('button', { name: /copy to clipboard/i }));
    
    await waitFor(() => {
      expect(execCommandMock).toHaveBeenCalledWith('copy');
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
    
    execCommandMock.mockRestore();
  });

  it('handles empty address gracefully', () => {
    const { container } = render(<WalletAddress address="" />);
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    render(<WalletAddress address={ADDR} className="custom-class" />);
    const wrapper = screen.getByText('97Vi...JxF').parentElement;
    expect(wrapper).toHaveClass('custom-class');
  });

  it('uses custom startChars and endChars', () => {
    render(<WalletAddress address={ADDR} startChars={6} endChars={6} />);
    expect(screen.getByText('97VihH...3LyJxF')).toBeInTheDocument();
  });

  it('has correct aria-label', () => {
    render(<WalletAddress address={ADDR} />);
    expect(screen.getByLabelText(`Address: ${ADDR}`)).toBeInTheDocument();
  });
});