import { render, screen } from '@testing-library/react';
import ProfilePage from './page';

// Mock the params
jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
}));

describe('ProfilePage', () => {
  it('renders profile header with username', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('crypto-dev')).toBeInTheDocument();
  });

  it('renders stats cards', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('Total Earned')).toBeInTheDocument();
    expect(screen.getByText('Bounties Completed')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Avg Review Score')).toBeInTheDocument();
    expect(screen.getByText('Current Streak')).toBeInTheDocument();
  });

  it('renders earnings chart section', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('Earnings by Month')).toBeInTheDocument();
  });

  it('renders bounty history table', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('Bounty History')).toBeInTheDocument();
    expect(screen.getByText('Smart Contract Audit')).toBeInTheDocument();
  });

  it('renders reputation section', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('Reputation')).toBeInTheDocument();
    expect(screen.getByText('Code Quality')).toBeInTheDocument();
  });

  it('renders hire as agent button', async () => {
    const params = Promise.resolve({ username: 'crypto-dev' });
    const Page = await ProfilePage({ params });
    render(Page as React.ReactElement);
    
    expect(screen.getByText('Hire as Agent')).toBeInTheDocument();
  });
});
