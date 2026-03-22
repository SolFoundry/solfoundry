/**
 * CopyAddress component tests
 * @module components/common/__tests__/CopyAddress.test
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CopyAddress, truncateAddress } from '../CopyAddress';

describe('truncateAddress', () => {
  it('truncates long addresses correctly', () => {
    expect(truncateAddress('C2TvL8XJH2xPBZy8YQ2jK9BAGS', 4, 4)).toBe('C2Tv...BAGS');
    expect(truncateAddress('1234567890abcdef', 6, 6)).toBe('123456...abcdef');
  });

  it('returns short addresses unchanged', () => {
    expect(truncateAddress('short', 4, 4)).toBe('short');
    expect(truncateAddress('123456789', 4, 4)).toBe('123456789');
  });

  it('handles empty or invalid addresses', () => {
    expect(truncateAddress('', 4, 4)).toBe('');
  });

  it('uses custom start/end character counts', () => {
    expect(truncateAddress('C2TvL8XJH2xPBZy8YQ2jK9BAGS', 6, 6)).toBe('C2TvL8...K9BAGS');
    expect(truncateAddress('C2TvL8XJH2xPBZy8YQ2jK9BAGS', 2, 2)).toBe('C2...GS');
  });
});

describe('CopyAddress', () => {
  const mockWriteText = vi.fn();
  const mockClipboard = {
    writeText: mockWriteText,
  };

  beforeEach(() => {
    vi.stubGlobal('navigator', {
      clipboard: mockClipboard,
    });
    mockWriteText.mockResolvedValue(undefined);
  });

  it('renders truncated address', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    expect(screen.getByText('C2Tv...BAGS')).toBeInTheDocument();
  });

  it('shows copy icon initially', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByRole('button');
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('copies full address to clipboard on click', async () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    expect(mockWriteText).toHaveBeenCalledWith('C2TvL8XJH2xPBZy8YQ2jK9BAGS');
  });

  it('shows checkmark after copy', async () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByRole('button');
    
    fireEvent.click(button);
    
    await waitFor(() => {
      expect(button.querySelector('svg')).toHaveClass('text-[#00FF88]');
    });
  });

  it('has correct aria-label', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByLabelText('Copy address C2Tv...BAGS');
    expect(button).toBeInTheDocument();
  });

  it('is keyboard accessible', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByRole('button');
    
    fireEvent.keyDown(button, { key: 'Enter' });
    expect(mockWriteText).toHaveBeenCalled();
  });

  it('has title attribute with full address', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" />);
    const button = screen.getByTitle('C2TvL8XJH2xPBZy8YQ2jK9BAGS');
    expect(button).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<CopyAddress address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" className="custom-class" />);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('custom-class');
  });

  it('uses custom start and end character counts', () => {
    render(
      <CopyAddress 
        address="C2TvL8XJH2xPBZy8YQ2jK9BAGS" 
        startChars={6} 
        endChars={6} 
      />
    );
    expect(screen.getByText('C2TvL8...K9BAGS')).toBeInTheDocument();
  });
});
