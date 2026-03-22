import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyAddress } from './CopyAddress';

// Mock clipboard API
const mockWriteText = jest.fn();
Object.assign(navigator, {
  clipboard: {
    writeText: mockWriteText,
  },
});

describe('CopyAddress', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const testAddress = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

  it('renders truncated address correctly', () => {
    render(<CopyAddress address={testAddress} />);
    expect(screen.getByText('C2Tv...BAGS')).toBeInTheDocument();
  });

  it('displays full address in tooltip on hover', () => {
    render(<CopyAddress address={testAddress} />);
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('title', 'Click to copy');
  });

  it('copies address to clipboard on click', async () => {
    mockWriteText.mockResolvedValue(undefined);
    
    render(<CopyAddress address={testAddress} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(testAddress);
    });
  });

  it('shows checkmark icon after copying', async () => {
    mockWriteText.mockResolvedValue(undefined);
    
    render(<CopyAddress address={testAddress} />);
    fireEvent.click(screen.getByRole('button'));

    // Wait for checkmark to appear
    await waitFor(() => {
      const checkmark = document.querySelector('svg path[d="M5 13l4 4L19 7"]');
      expect(checkmark).toBeInTheDocument();
    });
  });

  it('resets to copy icon after 2 seconds', async () => {
    mockWriteText.mockResolvedValue(undefined);
    jest.useFakeTimers();
    
    render(<CopyAddress address={testAddress} />);
    fireEvent.click(screen.getByRole('button'));

    // Checkmark should be visible immediately
    await waitFor(() => {
      const checkmark = document.querySelector('svg path[d="M5 13l4 4L19 7"]');
      expect(checkmark).toBeInTheDocument();
    });

    // Fast-forward 2 seconds
    jest.advanceTimersByTime(2000);

    // Checkmark should be gone, copy icon should be back
    await waitFor(() => {
      const checkmark = document.querySelector('svg path[d="M5 13l4 4L19 7"]');
      expect(checkmark).not.toBeInTheDocument();
    });

    jest.useRealTimers();
  });

  it('supports keyboard interaction', async () => {
    mockWriteText.mockResolvedValue(undefined);
    
    render(<CopyAddress address={testAddress} />);
    const button = screen.getByRole('button');
    
    // Enter key
    fireEvent.keyDown(button, { key: 'Enter' });
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(testAddress);
    });

    // Space key
    mockWriteText.mockClear();
    fireEvent.keyDown(button, { key: ' ' });
    await waitFor(() => {
      expect(mockWriteText).toHaveBeenCalledWith(testAddress);
    });
  });

  it('is accessible with proper ARIA attributes', () => {
    render(<CopyAddress address={testAddress} />);
    const button = screen.getByRole('button');
    
    expect(button).toHaveAttribute('tabIndex', '0');
    expect(button).toHaveAttribute('aria-label', `Copy address ${testAddress} to clipboard`);
  });

  it('supports custom truncated length', () => {
    render(<CopyAddress address={testAddress} truncatedLength={6} />);
    expect(screen.getByText('C2TvY8...BAGS')).toBeInTheDocument();
  });

  it('supports custom className', () => {
    render(<CopyAddress address={testAddress} className="custom-class" />);
    expect(screen.getByRole('button')).toHaveClass('custom-class');
  });

  it('handles clipboard API failure gracefully', async () => {
    mockWriteText.mockRejectedValue(new Error('Clipboard API not available'));
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    render(<CopyAddress address={testAddress} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to copy address:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });

  it('announces copy to screen readers', async () => {
    mockWriteText.mockResolvedValue(undefined);
    
    render(<CopyAddress address={testAddress} />);
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      const announcement = document.querySelector('[role="status"][aria-live="polite"]');
      expect(announcement).toHaveTextContent('Address copied to clipboard');
    });
  });
});
