import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import OnboardingWizard from '../components/OnboardingWizard';

// Mock localStorage
const mockLocalStorage = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn()
};
Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage
});

// Mock wallet connection
const mockWalletConnect = jest.fn();
const mockWalletDisconnect = jest.fn();
jest.mock('../hooks/useWallet', () => ({
  useWallet: () => ({
    connected: false,
    publicKey: null,
    connect: mockWalletConnect,
    disconnect: mockWalletDisconnect
  })
}));

// Mock router
const mockPush = jest.fn();
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: mockPush,
    query: {},
    pathname: '/'
  })
}));

describe('OnboardingWizard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  test('renders welcome step by default', () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    expect(screen.getByText(/Welcome to SolFoundry/i)).toBeInTheDocument();
    expect(screen.getByText(/bounties are code challenges/i)).toBeInTheDocument();
    expect(screen.getByText(/AI-powered review system/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /next/i })).toBeInTheDocument();
  });

  test('navigates through all wizard steps', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Step 1 - Welcome
    expect(screen.getByText(/Welcome to SolFoundry/i)).toBeInTheDocument();

    // Go to Step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    await waitFor(() => {
      expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument();
    });

    // Go to Step 3
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    await waitFor(() => {
      expect(screen.getByText(/Choose Your Skills/i)).toBeInTheDocument();
    });

    // Go to Step 4
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    await waitFor(() => {
      expect(screen.getByText(/You're All Set!/i)).toBeInTheDocument();
    });
  });

  test('handles wallet connection flow', async () => {
    const mockConnectedWallet = {
      connected: true,
      publicKey: { toString: () => 'ABC123...XYZ789' },
      connect: mockWalletConnect,
      disconnect: mockWalletDisconnect
    };

    jest.doMock('../hooks/useWallet', () => ({
      useWallet: () => mockConnectedWallet
    }));

    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Navigate to wallet step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument();
    });

    // Click connect wallet
    fireEvent.click(screen.getByRole('button', { name: /connect phantom/i }));

    expect(mockWalletConnect).toHaveBeenCalled();
  });

  test('persists onboarding progress in localStorage', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'solfoundry_onboarding_step',
        '2'
      );
    });
  });

  test('resumes from saved step on mount', () => {
    mockLocalStorage.getItem.mockReturnValue('3');

    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    expect(screen.getByText(/Choose Your Skills/i)).toBeInTheDocument();
  });

  test('handles skill selection and validation', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Navigate to skills step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));

    await waitFor(() => {
      expect(screen.getByText(/Choose Your Skills/i)).toBeInTheDocument();
    });

    // Select skills
    fireEvent.click(screen.getByLabelText(/Frontend Development/i));
    fireEvent.click(screen.getByLabelText(/Rust Programming/i));

    expect(screen.getByDisplayValue(/Frontend Development/i)).toBeChecked();
    expect(screen.getByDisplayValue(/Rust Programming/i)).toBeChecked();

    // Continue should be enabled with selections
    const continueBtn = screen.getByRole('button', { name: /continue/i });
    expect(continueBtn).not.toBeDisabled();
  });

  test('closes wizard and marks completion', async () => {
    const mockOnClose = jest.fn();
    render(<OnboardingWizard isOpen={true} onClose={mockOnClose} />);

    // Navigate to final step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    fireEvent.click(screen.getByRole('button', { name: /skip for now/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/You're All Set!/i)).toBeInTheDocument();
    });

    // Complete onboarding
    fireEvent.click(screen.getByRole('button', { name: /start exploring/i }));

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'solfoundry_onboarding_completed',
      'true'
    );
    expect(mockOnClose).toHaveBeenCalled();
  });

  test('handles previous step navigation', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Go to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText(/Connect Your Wallet/i)).toBeInTheDocument();
    });

    // Go back to step 1
    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    await waitFor(() => {
      expect(screen.getByText(/Welcome to SolFoundry/i)).toBeInTheDocument();
    });
  });

  test('responsive behavior on mobile viewport', () => {
    // Mock mobile viewport
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 375,
    });

    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    const wizard = screen.getByRole('dialog');
    expect(wizard).toHaveClass('max-w-md', 'mx-4');
  });

  test('shows progress indicator correctly', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Step 1 - check progress
    expect(screen.getByText('1 of 4')).toBeInTheDocument();

    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText('2 of 4')).toBeInTheDocument();
    });
  });

  test('handles loading states during wallet connection', async () => {
    render(<OnboardingWizard isOpen={true} onClose={() => {}} />);

    // Navigate to wallet step
    fireEvent.click(screen.getByRole('button', { name: /next/i }));

    // Click connect - should show loading
    fireEvent.click(screen.getByRole('button', { name: /connect phantom/i }));

    await waitFor(() => {
      expect(screen.getByText(/connecting/i)).toBeInTheDocument();
    });
  });
});
