import { render, screen, fireEvent } from '@testing-library/react';
import MarketplacePage from './page';

describe('MarketplacePage', () => {
  it('renders the marketplace page with title', () => {
    render(<MarketplacePage />);
    expect(screen.getByText('Agent Marketplace')).toBeInTheDocument();
  });

  it('renders agent cards', () => {
    render(<MarketplacePage />);
    expect(screen.getByText('CodeNinja')).toBeInTheDocument();
    expect(screen.getByText('SecureBear')).toBeInTheDocument();
  });

  it('shows register CTA button', () => {
    render(<MarketplacePage />);
    expect(screen.getByText('Register Your Agent')).toBeInTheDocument();
  });

  it('filters agents by role', () => {
    render(<MarketplacePage />);
    
    // Initially should show all agents
    expect(screen.getByText('Showing 12 agents')).toBeInTheDocument();
    
    // Select backend filter
    const roleSelect = screen.getByLabelText('Role:');
    fireEvent.change(roleSelect, { target: { value: 'backend' } });
    
    // Should show only 2 backend agents
    expect(screen.getByText('Showing 2 agents')).toBeInTheDocument();
  });

  it('filters agents by status', () => {
    render(<MarketplacePage />);
    
    // Select available filter
    const statusSelect = screen.getByLabelText('Status:');
    fireEvent.change(statusSelect, { target: { value: 'available' } });
    
    // Should show only available agents (7 available out of 12)
    expect(screen.getByText('Showing 7 agents')).toBeInTheDocument();
  });

  it('opens agent modal on card click', () => {
    render(<MarketplacePage />);
    
    // Click on CodeNinja card
    fireEvent.click(screen.getByText('CodeNinja'));
    
    // Modal should open with agent details
    expect(screen.getByText('Capabilities')).toBeInTheDocument();
    expect(screen.getByText('Solana Programs')).toBeInTheDocument();
  });

  it('shows performance history in modal', () => {
    render(<MarketplacePage />);
    
    // Click on an agent
    fireEvent.click(screen.getByText('CodeNinja'));
    
    // Performance section should be visible
    expect(screen.getByText('Performance History')).toInTheDocument();
  });

  it('shows hire button for available agents', () => {
    render(<MarketplacePage />);
    
    // Click on available agent
    fireEvent.click(screen.getByText('SecureBear'));
    
    // Hire button should be visible
    expect(screen.getByRole('button', { name: 'Hire Agent' })).toBeInTheDocument();
  });

  it('disables hire button for offline agents', () => {
    render(<MarketplacePage />);
    
    // Click on offline agent (CloudRider)
    fireEvent.click(screen.getByText('CloudRider'));
    
    // Agent Offline text should be shown
    expect(screen.getByRole('button', { name: 'Agent Offline' })).toBeInTheDocument();
  });
});
