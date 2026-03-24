import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Pagination } from '../components/bounties/Pagination';
import { BountyFilters } from '../components/bounties/BountyFilters';
import { DEFAULT_FILTERS } from '../types/bounty';
import type { BountyBoardFilters } from '../types/bounty';

describe('Pagination', () => {
  it('renders page buttons', () => {
    render(<Pagination page={1} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByLabelText('Previous page')).toBeDisabled();
    expect(screen.getByLabelText('Next page')).not.toBeDisabled();
  });

  it('highlights current page', () => {
    render(<Pagination page={3} totalPages={5} onPageChange={() => {}} />);
    const btn = screen.getByText('3');
    expect(btn).toHaveAttribute('aria-current', 'page');
  });

  it('calls onPageChange on click', async () => {
    const fn = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={fn} />);
    await userEvent.click(screen.getByText('3'));
    expect(fn).toHaveBeenCalledWith(3);
  });

  it('prev/next navigation', async () => {
    const fn = vi.fn();
    render(<Pagination page={3} totalPages={5} onPageChange={fn} />);
    await userEvent.click(screen.getByLabelText('Previous page'));
    expect(fn).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByLabelText('Next page'));
    expect(fn).toHaveBeenCalledWith(4);
  });

  it('disables next on last page', () => {
    render(<Pagination page={5} totalPages={5} onPageChange={() => {}} />);
    expect(screen.getByLabelText('Next page')).toBeDisabled();
    expect(screen.getByLabelText('Previous page')).not.toBeDisabled();
  });

  it('shows ellipsis for many pages', () => {
    render(<Pagination page={5} totalPages={20} onPageChange={() => {}} />);
    const nav = screen.getByRole('navigation');
    expect(within(nav).getAllByText('…').length).toBeGreaterThanOrEqual(1);
  });
});

describe('BountyFilters', () => {
  let filters: BountyBoardFilters;
  let onChange: ReturnType<typeof vi.fn>;
  let onReset: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    filters = { ...DEFAULT_FILTERS };
    onChange = vi.fn();
    onReset = vi.fn();
  });

  it('renders category filter chips', () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={10}
        totalCount={50}
      />,
    );
    expect(screen.getByTestId('category-chips')).toBeInTheDocument();
    expect(screen.getByTestId('category-chip-all')).toHaveAttribute('aria-pressed', 'true');
  });

  it('changing category calls onFilterChange', async () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={10}
        totalCount={50}
      />,
    );
    await userEvent.click(screen.getByTestId('category-chip-security'));
    expect(onChange).toHaveBeenCalledWith('category', 'security');
  });

  it('shows deadline filter in advanced section', async () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={10}
        totalCount={50}
      />,
    );
    await userEvent.click(screen.getByTestId('toggle-advanced'));
    expect(screen.getByTestId('deadline-filter')).toBeInTheDocument();
    expect(screen.getByLabelText('Deadline before date')).toBeInTheDocument();
  });

  it('deadline change calls onFilterChange', async () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={10}
        totalCount={50}
      />,
    );
    await userEvent.click(screen.getByTestId('toggle-advanced'));
    const input = screen.getByTestId('deadline-filter');
    await userEvent.type(input, '2026-04-01');
    expect(onChange).toHaveBeenCalledWith('deadlineBefore', expect.any(String));
  });

  it('shows result count', () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={3}
        totalCount={50}
      />,
    );
    expect(screen.getByTestId('result-count')).toHaveTextContent('3 of 50 bounties');
  });

  it('shows Clear all when filters are active', () => {
    const active = { ...DEFAULT_FILTERS, category: 'security' as const };
    render(
      <BountyFilters
        filters={active}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={1}
        totalCount={50}
      />,
    );
    expect(screen.getByTestId('reset-filters')).toBeInTheDocument();
  });

  it('hides Clear all when no filters are active', () => {
    render(
      <BountyFilters
        filters={DEFAULT_FILTERS}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={50}
        totalCount={50}
      />,
    );
    expect(screen.queryByTestId('reset-filters')).not.toBeInTheDocument();
  });

  it('skill pills toggle on click', async () => {
    render(
      <BountyFilters
        filters={filters}
        onFilterChange={onChange}
        onReset={onReset}
        resultCount={10}
        totalCount={50}
      />,
    );
    await userEvent.click(screen.getByTestId('skill-filter-Rust'));
    expect(onChange).toHaveBeenCalledWith('skills', ['Rust']);
  });
});
