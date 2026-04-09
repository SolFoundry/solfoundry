import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../components/bounty/SearchBar';
import { filterBountiesBySearch } from '../components/bounty/BountyGrid';
import type { Bounty } from '../types/bounty';

describe('SearchBar', () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders with placeholder text', () => {
    render(<SearchBar value="" onChange={mockOnChange} placeholder="Search bounties..." />);
    expect(screen.getByPlaceholderText('Search bounties...')).toBeInTheDocument();
  });

  it('has correct ARIA attributes for accessibility', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    const input = screen.getByRole('searchbox');
    expect(input).toHaveAttribute('aria-label', 'Search bounties');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
  });

  it('displays current value', () => {
    render(<SearchBar value="test query" onChange={mockOnChange} />);
    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('calls onChange when input changes (debounced)', async () => {
    render(<SearchBar value="" onChange={mockOnChange} debounceMs={100} />);
    const input = screen.getByRole('searchbox');
    
    await userEvent.type(input, 'a');
    expect(mockOnChange).not.toHaveBeenCalled();
    
    // Wait for debounce
    await new Promise((resolve) => setTimeout(resolve, 150));
    expect(mockOnChange).toHaveBeenCalledWith('a');
  });

  it('shows clear button when value is present', () => {
    render(<SearchBar value="test" onChange={mockOnChange} />);
    expect(screen.getByLabelText('Clear search')).toBeInTheDocument();
  });

  it('hides clear button when value is empty', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    expect(screen.queryByLabelText('Clear search')).not.toBeInTheDocument();
  });

  it('clears value when clear button is clicked', async () => {
    render(<SearchBar value="test" onChange={mockOnChange} />);
    const clearButton = screen.getByLabelText('Clear search');
    await userEvent.click(clearButton);
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('clears value when Escape key is pressed', async () => {
    render(<SearchBar value="test" onChange={mockOnChange} />);
    const input = screen.getByRole('searchbox');
    await userEvent.type(input, '{Escape}');
    expect(mockOnChange).toHaveBeenCalledWith('');
  });

  it('has sr-only description for screen readers', () => {
    render(<SearchBar value="" onChange={mockOnChange} />);
    const description = screen.getByText(/Type to search bounties by title or description/);
    expect(description).toHaveClass('sr-only');
  });
});

describe('filterBountiesBySearch', () => {
  const mockBounties: Bounty[] = [
    {
      id: '1',
      title: 'Fix TypeScript bug in auth',
      description: 'There is a bug in the authentication flow',
      status: 'open',
      tier: 'T1',
      reward_amount: 100,
      reward_token: 'USDC',
      skills: ['TypeScript'],
      submission_count: 0,
      created_at: '2024-01-01',
    },
    {
      id: '2',
      title: 'Rust smart contract',
      description: 'Build a Solana program',
      status: 'open',
      tier: 'T2',
      reward_amount: 500,
      reward_token: 'USDC',
      skills: ['Rust'],
      submission_count: 2,
      created_at: '2024-01-02',
    },
    {
      id: '3',
      title: 'Update documentation',
      description: 'Fix the TypeScript examples in docs',
      status: 'completed',
      tier: 'T3',
      reward_amount: 50,
      reward_token: 'FNDRY',
      skills: ['TypeScript'],
      submission_count: 1,
      created_at: '2024-01-03',
    },
  ];

  it('returns all bounties when query is empty', () => {
    const result = filterBountiesBySearch(mockBounties, '');
    expect(result).toHaveLength(3);
  });

  it('filters by title match', () => {
    const result = filterBountiesBySearch(mockBounties, 'TypeScript');
    expect(result).toHaveLength(2);
    expect(result.map((b) => b.id)).toContain('1');
    expect(result.map((b) => b.id)).toContain('3');
  });

  it('filters by description match', () => {
    const result = filterBountiesBySearch(mockBounties, 'Solana');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('is case insensitive', () => {
    const result = filterBountiesBySearch(mockBounties, 'TYPESCRIPT');
    expect(result).toHaveLength(2);
  });

  it('trims whitespace from query', () => {
    const result = filterBountiesBySearch(mockBounties, '  typescript  ');
    expect(result).toHaveLength(2);
  });

  it('returns empty array when no matches', () => {
    const result = filterBountiesBySearch(mockBounties, 'nonexistent');
    expect(result).toHaveLength(0);
  });

  it('handles bounties with missing title/description', () => {
    const incompleteBounties: Bounty[] = [
      {
        id: '4',
        title: '',
        description: 'Has description only',
        status: 'open',
        tier: 'T1',
        reward_amount: 100,
        reward_token: 'USDC',
        skills: [],
        submission_count: 0,
        created_at: '2024-01-04',
      },
      {
        id: '5',
        title: 'Has title only',
        description: '',
        status: 'open',
        tier: 'T1',
        reward_amount: 100,
        reward_token: 'USDC',
        skills: [],
        submission_count: 0,
        created_at: '2024-01-05',
      },
    ];
    
    const descResult = filterBountiesBySearch(incompleteBounties, 'description');
    expect(descResult).toHaveLength(1);
    expect(descResult[0].id).toBe('4');

    const titleResult = filterBountiesBySearch(incompleteBounties, 'title');
    expect(titleResult).toHaveLength(1);
    expect(titleResult[0].id).toBe('5');
  });
});
