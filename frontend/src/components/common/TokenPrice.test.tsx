/**
 * Tests for TokenPrice component
 */
import { render, screen, waitFor } from '@testing-library/react';
import { TokenPrice } from './TokenPrice';

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock API response
const mockTokenData = {
  pairs: [
    {
      priceUsd: '0.0042',
      priceChange: { h24: '5.25' },
      fdv: '24200000',
      volume: { h24: '1500000' },
    },
  ],
};

describe('TokenPrice', () => {
  beforeEach(() => {
    mockFetch.mockClear();
  });

  it('should show loading state initially', () => {
    mockFetch.mockImplementation(() => new Promise(() => {})); // Never resolves
    
    render(<TokenPrice />);
    
    expect(screen.getByLabelText('Loading token price')).toBeInTheDocument();
  });

  it('should display price and change after loading', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTokenData),
    });
    
    render(<TokenPrice />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Token price details')).toBeInTheDocument();
    });
    
    expect(screen.getByText('$0.0042')).toBeInTheDocument();
    expect(screen.getByText('▲ 5.25%')).toBeInTheDocument();
  });

  it('should show error state when API fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    
    render(<TokenPrice />);
    
    await waitFor(() => {
      expect(screen.getByText('Price unavailable')).toBeInTheDocument();
    });
  });

  it('should render compact mode correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTokenData),
    });
    
    render(<TokenPrice compact />);
    
    await waitFor(() => {
      expect(screen.getByLabelText('Token price')).toBeInTheDocument();
    });
    
    expect(screen.getByText('$0.0042')).toBeInTheDocument();
    expect(screen.getByText('▲ 5.25%')).toBeInTheDocument();
  });

  it('should show negative change in red', async () => {
    const negativeData = {
      pairs: [{
        ...mockTokenData.pairs[0],
        priceChange: { h24: '-3.50' },
      }],
    };
    
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(negativeData),
    });
    
    render(<TokenPrice />);
    
    await waitFor(() => {
      expect(screen.getByText('▼ 3.50%')).toBeInTheDocument();
    });
    
    const changeElement = screen.getByText('▼ 3.50%');
    expect(changeElement).toHaveClass('text-red-500');
  });

  it('should format market cap correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTokenData),
    });
    
    render(<TokenPrice />);
    
    await waitFor(() => {
      expect(screen.getByText(/MCap: \$24.20M/)).toBeInTheDocument();
    });
  });
});