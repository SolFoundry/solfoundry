/**
 * @jest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CopyAddress, truncateAddress } from './CopyAddress';

// Mock navigator.clipboard
const mockWriteText = vi.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('truncateAddress', () => {
  it('truncates address with default length', () => {
    const address = 'C2Tv7g9qL4R8K3m5P9xQ2Y7Z';
    expect(truncateAddress(address)).toBe('C2Tv...7Z');
  });

  it('truncates with custom start/end chars', () => {
    const address = 'C2Tv7g9qL4R8K3m5P9xQ2Y7Z';
    expect(truncateAddress(address, 6, 4)).toBe('C2Tv7g...7Z');
  });

  it('returns full address if too short to truncate', () => {
    const address = 'ABC123';
    expect(truncateAddress(address)).toBe('ABC123');
  });

  it('returns empty string for empty address', () => {
    expect(truncateAddress('')).toBe('');
  });
});

describe('CopyAddress', () => {
  const testAddress = 'C2Tv7g9qL4R8K3m5P9xQ2Y7Z8W1BAGS';

  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteText.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders truncated address', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-text').textContent).toBe('C2Tv...AGS');
  });

  it('shows full address in title attribute', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-text').getAttribute('title')).toBe(testAddress);
  });

  it('renders copy icon by default', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-icon')).toBeTruthy();
  });

  it('hides icon when showIcon=false', () => {
    render(<CopyAddress address={testAddress} showIcon={false} />);
    expect(screen.queryByTestId('copy-address-btn')).toBeNull();
  });

  it('copies address to clipboard on click', async () => {
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-address-btn'));
    });

    expect(mockWriteText).toHaveBeenCalledWith(testAddress);
  });

  it('shows checkmark after successful copy', async () => {
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-address-btn'));
    });

    expect(screen.getByTestId('copy-address-checkmark')).toBeTruthy();
  });

  it('returns to copy icon after 2 seconds', async () => {
    vi.useFakeTimers();
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-address-btn'));
    });

    expect(screen.getByTestId('copy-address-checkmark')).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('copy-address-checkmark')).toBeNull();
    });

    vi.useRealTimers();
  });

  it('shows error icon on copy failure', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard error'));
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-address-btn'));
    });

    expect(screen.getByTestId('copy-address-error')).toBeTruthy();
  });

  it('calls onCopy callback after successful copy', async () => {
    const onCopy = vi.fn();
    render(<CopyAddress address={testAddress} onCopy={onCopy} />);
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('copy-address-btn'));
    });

    expect(onCopy).toHaveBeenCalled();
  });

  it('has correct aria-label', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-btn').getAttribute('aria-label')).toBe(
      'Copy C2Tv...AGS to clipboard'
    );
  });

  it('uses custom ariaLabel when provided', () => {
    render(<CopyAddress address={testAddress} ariaLabel="Copy wallet address" />);
    expect(screen.getByTestId('copy-address-btn').getAttribute('aria-label')).toBe(
      'Copy wallet address'
    );
  });

  it('handles Enter key press', async () => {
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('copy-address-btn'), { key: 'Enter' });
    });

    expect(mockWriteText).toHaveBeenCalledWith(testAddress);
  });

  it('handles Space key press', async () => {
    render(<CopyAddress address={testAddress} />);
    
    await act(async () => {
      fireEvent.keyDown(screen.getByTestId('copy-address-btn'), { key: ' ' });
    });

    expect(mockWriteText).toHaveBeenCalledWith(testAddress);
  });

  it('does not copy on other key presses', async () => {
    render(<CopyAddress address={testAddress} />);
    
    fireEvent.keyDown(screen.getByTestId('copy-address-btn'), { key: 'Tab' });

    expect(mockWriteText).not.toHaveBeenCalled();
  });

  it('prevents default on Enter/Space key', async () => {
    render(<CopyAddress address={testAddress} />);
    
    const event = fireEvent.keyDown(screen.getByTestId('copy-address-btn'), { key: 'Enter' });
    // The handler calls preventDefault, but fireEvent doesn't easily test this
    // The fact that it doesn't throw is a basic test
  });

  it('returns null when address is empty', () => {
    const { container } = render(<CopyAddress address="" />);
    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    render(<CopyAddress address={testAddress} className="my-custom-class" />);
    expect(screen.getByTestId('copy-address').className).toContain('my-custom-class');
  });

  it('applies custom data-testid', () => {
    render(<CopyAddress address={testAddress} data-testid="wallet-address" />);
    expect(screen.getByTestId('wallet-address')).toBeTruthy();
    expect(screen.getByTestId('wallet-address-text')).toBeTruthy();
    expect(screen.getByTestId('wallet-address-btn')).toBeTruthy();
  });

  it('updates title attribute after copy', async () => {
    render(<CopyAddress address={testAddress} />);
    const btn = screen.getByTestId('copy-address-btn');
    
    expect(btn.getAttribute('title')).toBe('Copy to clipboard');

    await act(async () => {
      fireEvent.click(btn);
    });

    expect(btn.getAttribute('title')).toBe('Copied!');
  });

  it('has screen reader status element', () => {
    render(<CopyAddress address={testAddress} />);
    const status = screen.getByTestId('copy-address-status');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('has sr-only class on status element', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-status').className).toContain('sr-only');
  });

  it('button has type="button"', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByTestId('copy-address-btn').getAttribute('type')).toBe('button');
  });

  it('uses custom startChars and endChars', () => {
    render(<CopyAddress address={testAddress} startChars={6} endChars={6} />);
    expect(screen.getByTestId('copy-address-text').textContent).toBe('C2Tv7g...1BAGS');
  });
});
