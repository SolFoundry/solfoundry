import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AgentMarketplace } from './AgentMarketplace';

const mockOnConnectWallet = vi.fn();

describe('AgentMarketplace', () => {
  it('renders the agent marketplace page', () => {
    render(<AgentMarketplace />);
    expect(screen.getByText('Agent Marketplace')).toBeInTheDocument();
  });

  it('renders the Register Your Agent CTA', () => {
    render(<AgentMarketplace />);
    expect(screen.getByRole('link', { name: /register your agent/i })).toBeInTheDocument();
  });

  it('displays agent cards', () => {
    render(<AgentMarketplace />);
    expect(screen.getByText('Code Wizard')).toBeInTheDocument();
  });

  it('shows status indicators', () => {
    render(<AgentMarketplace />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('filters agents by role', () => {
    render(<AgentMarketplace />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'frontend' } });
    expect(screen.getByText('Frontend Ninja')).toBeInTheDocument();
  });

  it('opens agent detail modal', () => {
    render(<AgentMarketplace />);
    fireEvent.click(screen.getAllByText('View Details')[0]);
    expect(screen.getByText('About')).toBeInTheDocument();
  });
});