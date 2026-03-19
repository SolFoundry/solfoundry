import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CreateBountyPage from './page';

// Mock next/link
jest.mock('next/link', () => {
  return ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  );
});

describe('CreateBountyPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the create bounty page with step 1', () => {
    render(<CreateBountyPage />);
    
    expect(screen.getByText('Create Bounty')).toBeInTheDocument();
    expect(screen.getByText('Bounty Details')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/e.g., Fix critical bug/)).toBeInTheDocument();
  });

  it('shows progress indicator with 3 steps', () => {
    render(<CreateBountyPage />);
    
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('validates title is required on step 1', async () => {
    render(<CreateBountyPage />);
    
    // Clear the title field
    const titleInput = screen.getByPlaceholderText(/e.g., Fix critical bug/);
    fireEvent.change(titleInput, { target: { value: '' } });
    
    // Click continue
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('validates description minimum length on step 1', async () => {
    render(<CreateBountyPage />);
    
    // Set short description
    const descInput = screen.getByPlaceholderText(/Describe the bounty/);
    fireEvent.change(descInput, { target: { value: 'Short' } });
    
    // Click continue
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Should show error
    await waitFor(() => {
      expect(screen.getByText('Description must be at least 20 characters')).toBeInTheDocument();
    });
  });

  it('navigates to step 2 with valid data', async () => {
    render(<CreateBountyPage />);
    
    // Click continue (pre-filled data should be valid)
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Should show step 2 content
    await waitFor(() => {
      expect(screen.getByText('Reward Amount (FNDRY)')).toBeInTheDocument();
    });
  });

  it('shows wallet connection modal when clicking connect', () => {
    render(<CreateBountyPage />);
    
    // Navigate to step 2
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Click connect wallet
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    // Modal should appear
    expect(screen.getByText('Wallet Address')).toBeInTheDocument();
  });

  it('connects wallet and shows connected state', async () => {
    render(<CreateBountyPage />);
    
    // Navigate to step 2
    const continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Click connect wallet
    const connectButton = screen.getByText('Connect Wallet');
    fireEvent.click(connectButton);
    
    // Enter wallet address
    const addressInput = screen.getByPlaceholderText(/Enter your Solana wallet address/);
    fireEvent.change(addressInput, { target: { value: 'E4UWo5a5QrHFbjnj1UUKdsxixE5pTm3SdZcz7EUag1B7' } });
    
    // Click connect
    const connectSubmitButton = screen.getByRole('button', { name: /Connect/i });
    fireEvent.click(connectSubmitButton);
    
    // Should show connected state
    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('shows review step and success state on submission', async () => {
    render(<CreateBountyPage />);
    
    // Step 1 -> Step 2
    let continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText('Reward Amount (FNDRY)')).toBeInTheDocument();
    });
    
    // Step 2 -> Step 3 (wallet should already be connected from mock data)
    continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Wait for step 3 (review)
    await waitFor(() => {
      expect(screen.getByText('Bounty Details')).toBeInTheDocument();
    });
    
    // Submit
    const submitButton = screen.getByText('Publish Bounty');
    fireEvent.click(submitButton);
    
    // Should show success
    await waitFor(() => {
      expect(screen.getByText('Bounty Created!')).toBeInTheDocument();
    });
  });

  it('allows navigating back to previous steps', async () => {
    render(<CreateBountyPage />);
    
    // Go to step 2
    let continueButton = screen.getByText('Continue →');
    fireEvent.click(continueButton);
    
    // Wait for step 2
    await waitFor(() => {
      expect(screen.getByText('Reward Amount (FNDRY)')).toBeInTheDocument();
    });
    
    // Go back to step 1
    const backButton = screen.getByText('← Back');
    fireEvent.click(backButton);
    
    // Should show step 1 content
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/e.g., Fix critical bug/)).toBeInTheDocument();
    });
  });

  it('pre-fills mock data correctly', () => {
    render(<CreateBountyPage />);
    
    // Check mock data is loaded
    const titleInput = screen.getByPlaceholderText(/e.g., Fix critical bug/) as HTMLInputElement;
    expect(titleInput.value).toBe('Build a Multi-Signature Wallet Interface');
    
    const descInput = screen.getByPlaceholderText(/Describe the bounty/) as HTMLTextAreaElement;
    expect(descInput.value).toContain('multi-sig wallet');
  });
});
