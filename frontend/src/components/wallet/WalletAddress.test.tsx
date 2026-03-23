/** Tests for WalletAddress component - copy-to-clipboard functionality. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletAddress, truncateString } from './WalletAddress';

describe('WalletAddress', () => {
  const mockAddress = 'C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS';

  describe('truncateString', () => {
    it('should truncate long addresses', () => {
      expect(truncateString('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS', 4, 4)).toBe('C2Tv...BAGS');
      expect(truncateString('C2TvY8E8B75EF2UP8cTpTp3EDUjTgjWmpaGnT74VBAGS', 6, 4)).toBe('C2TvY8...BAGS');
    });

    it('should not truncate short addresses', () => {
      expect(truncateString('short', 4, 4)).toBe('short');
      expect(truncateString('C2Tv...BAGS', 4, 4)).toBe('C2Tv...BAGS');
    });

    it('should handle empty strings', () => {
      expect(truncateString('', 4, 4)).toBe('');
      expect(truncateString(null as any, 4, 4)).toBe('');
    });
  });

  describe('rendering', () => {
    it('should render truncated address by default', () => {
      render(<WalletAddress address={mockAddress} />);
      expect(screen.getByText('C2Tv...BAGS')).toBeInTheDocument();
    });

    it('should render with custom startChars and endChars', () => {
      render(<WalletAddress address={mockAddress} startChars={6} endChars={6} />);
      expect(screen.getByText('C2TvY8...4VBAGS')).toBeInTheDocument();
    });

    it('should not render when address is empty', () => {
      const { container } = render(<WalletAddress address="" />);
      expect(container.firstChild).toBeNull();
    });

    it('should apply custom className', () => {
      render(<WalletAddress address={mockAddress} className="custom-class" />);
      expect(screen.getByLabelText(`Address: ${mockAddress}`)).toHaveClass('custom-class');
    });

    it('should show full address in tooltip when truncated', () => {
      render(<WalletAddress address={mockAddress} showTooltip={true} />);
      const addressSpan = screen.getByText('C2Tv...BAGS');
      expect(addressSpan).toHaveAttribute('title', mockAddress);
    });

    it('should not show tooltip when disabled', () => {
      render(<WalletAddress address={mockAddress} showTooltip={false} />);
      const addressSpan = screen.getByText('C2Tv...BAGS');
      expect(addressSpan).not.toHaveAttribute('title');
    });
  });

  describe('copy button', () => {
    beforeEach(() => {
      vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should render copy button by default', () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toBeInTheDocument();
    });

    it('should hide copy button when showCopyButton is false', () => {
      render(<WalletAddress address={mockAddress} showCopyButton={false} />);
      expect(screen.queryByLabelText('Copy to clipboard')).not.toBeInTheDocument();
    });

    it('should copy address to clipboard on click', async () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockAddress);
    });

    it('should show "Copied!" feedback after successful copy', async () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });
    });

    it('should reset copied state after 2 seconds', async () => {
      vi.useFakeTimers();
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByText('Copied!')).toBeInTheDocument();
      });

      vi.advanceTimersByTime(2000);

      await waitFor(() => {
        expect(screen.queryByText('Copied!')).not.toBeInTheDocument();
      });

      vi.useRealTimers();
    });

    it('should change button icon to checkmark when copied', async () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(screen.getByLabelText('Copied!')).toBeInTheDocument();
      });

      // Check for checkmark icon (success state)
      const checkmark = screen.getByTestId('checkmark-icon') as SVGSVGElement | null;
      expect(checkmark).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have proper aria-label on address span', () => {
      render(<WalletAddress address={mockAddress} />);
      expect(screen.getByLabelText(`Address: ${mockAddress}`)).toBeInTheDocument();
    });

    it('should have proper aria-label on copy button', () => {
      render(<WalletAddress address={mockAddress} />);
      expect(screen.getByLabelText('Copy to clipboard')).toBeInTheDocument();
    });

    it('should announce copied state to screen readers', async () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      fireEvent.click(copyButton);

      await waitFor(() => {
        const statusElement = screen.getByRole('status');
        expect(statusElement).toHaveAttribute('aria-live', 'polite');
      });
    });

    it('should be keyboard accessible', () => {
      render(<WalletAddress address={mockAddress} />);
      const copyButton = screen.getByLabelText('Copy to clipboard');
      expect(copyButton).toHaveAttribute('type', 'button');
    });
  });

  describe('edge cases', () => {
    it('should handle very long addresses', () => {
      const longAddress = 'A'.repeat(100);
      render(<WalletAddress address={longAddress} />);
      expect(screen.getByText('AAAA...AAAA')).toBeInTheDocument();
    });

    it('should handle addresses with special characters', () => {
      const specialAddress = 'C2Tv-Y8E8_B75.EF2UP';
      render(<WalletAddress address={specialAddress} />);
      expect(screen.getByText('C2Tv...F2UP')).toBeInTheDocument();
    });

    it('should not copy when address is empty', async () => {
      const mockWriteText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
      render(<WalletAddress address="" />);
      // Component should not render, so no button to click
      expect(screen.queryByLabelText('Copy to clipboard')).not.toBeInTheDocument();
      expect(mockWriteText).not.toHaveBeenCalled();
    });
  });
});
