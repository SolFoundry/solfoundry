import { render, screen, fireEvent } from '@testing-library/react';
import { BountyFilters, FilterState } from './BountyFilters';

const defaultFilters: FilterState = {
  tier: 'all',
  status: 'open',
  skills: [],
  search: '',
  sortBy: 'newest'
};

describe('BountyFilters', () => {
  it('renders search input', () => {
    render(<BountyFilters filters={defaultFilters} onChange={() => {}} />);
    expect(screen.getByPlaceholderText('Search bounties...')).toBeInTheDocument();
  });

  it('renders tier select', () => {
    render(<BountyFilters filters={defaultFilters} onChange={() => {}} />);
    expect(screen.getByLabelText('Tier')).toBeInTheDocument();
  });

  it('calls onChange when search input changes', () => {
    const handleChange = jest.fn();
    render(<BountyFilters filters={defaultFilters} onChange={handleChange} />);
    
    const searchInput = screen.getByPlaceholderText('Search bounties...');
    fireEvent.change(searchInput, { target: { value: 'test' } });
    
    expect(handleChange).toHaveBeenCalled();
  });

  it('toggles skill selection', () => {
    const handleChange = jest.fn();
    render(<BountyFilters filters={defaultFilters} onChange={handleChange} />);
    
    const reactButton = screen.getByText('React');
    fireEvent.click(reactButton);
    
    expect(handleChange).toHaveBeenCalledWith({
      ...defaultFilters,
      skills: ['React']
    });
  });
});