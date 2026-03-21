import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock Solana wallet adapter so tests don't need real crypto libs
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: false, publicKey: null, connect: vi.fn(), disconnect: vi.fn() }),
  useConnection: () => ({ connection: {} }),
}));

vi.mock('../hooks/useFndryToken', () => ({
  useFndryBalance: () => ({ balance: 1000000, rawBalance: BigInt(0), loading: false, error: null, refetch: vi.fn() }),
  useBountyEscrow: () => ({ fundBounty: vi.fn(), transaction: { status: 'idle', signature: null, error: null }, reset: vi.fn() }),
}));

vi.mock('./wallet/WalletProvider', () => ({
  useNetwork: () => ({ network: 'devnet', endpoint: 'https://api.devnet.solana.com', setNetwork: vi.fn(), networkOptions: [] }),
}));

vi.mock('./wallet/FundBountyFlow', () => ({
  FundBountyButton: ({ amount, onFunded, disabled }: any) => (
    <button onClick={() => onFunded('mock-sig')} disabled={disabled} data-testid="fund-button">
      Fund Bounty - {amount}
    </button>
  ),
}));

vi.mock('../config/constants', () => ({
  FNDRY_TOKEN_MINT: 'mock-mint',
  FNDRY_DECIMALS: 9,
  ESCROW_WALLET: 'mock-escrow',
  TOKEN_PROGRAM_ID: 'mock-token-program',
  ASSOCIATED_TOKEN_PROGRAM_ID: 'mock-ata-program',
  solscanTxUrl: (sig: string) => `https://solscan.io/tx/${sig}`,
  findAssociatedTokenAddress: vi.fn(),
}));

import { BountyCreationWizard } from './BountyCreationWizard';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Global test hooks - reset localStorage before every test
beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

/**
 * Navigate the bounty creation wizard to a given step by filling required
 * fields and clicking Next at each stage.
 */
async function navigateToStep(step: number) {
  for (let i = 1; i < step; i++) {
    switch (i) {
      case 1:
        // Select T1 tier
        fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
        break;
      case 2:
        // Fill title and description
        fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
          target: { value: 'Test Title' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
          target: { value: 'Test Description' },
        });
        break;
      case 3: {
        // Fill at least one requirement
        const reqInput = screen.getByPlaceholderText(/Enter requirement/i);
        fireEvent.change(reqInput, { target: { value: 'Must pass tests' } });
        break;
      }
      case 4:
        // Select category and at least one skill
        fireEvent.change(screen.getByDisplayValue('Select a category...'), {
          target: { value: 'Frontend' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'React' }));
        break;
      case 5: {
        // Set deadline (reward has a default)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 14);
        const dateStr = tomorrow.toISOString().split('T')[0];
        fireEvent.change(screen.getByDisplayValue(''), { target: { value: dateStr } });
        break;
      }
    }
    // Click Next to advance
    const nextBtn = screen.queryByText(/Next →/) || screen.queryByText(/Continue to Publish/);
    if (nextBtn) {
      fireEvent.click(nextBtn);
      // Wait for the step transition to render
      await waitFor(() => {
        expect(screen.getByText(new RegExp(`Step ${i + 1} of 7`))).toBeInTheDocument();
      });
    }
  }
}

describe('BountyCreationWizard', () => {
  it('renders the wizard with step 1', () => {
    render(<BountyCreationWizard />);
    expect(screen.getByText('Create Bounty')).toBeInTheDocument();
    expect(screen.getByText('Select Bounty Tier')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 7')).toBeInTheDocument();
  });

  it('shows progress bar correctly with accessibility attributes', () => {
    render(<BountyCreationWizard />);
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
    // 100/7 = 14.2857... — allow for floating-point platform differences
    const valuenow = Number(progressBar.getAttribute('aria-valuenow'));
    expect(Math.abs(valuenow - 100 / 7)).toBeLessThan(0.001);
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('allows tier selection', async () => {
    render(<BountyCreationWizard />);
    
    const t1Button = screen.getByRole('button', { name: /Tier 1 - Open Race/i });
    fireEvent.click(t1Button);
    
    // Should show checkmark for selected tier (border color changes)
    expect(t1Button).toHaveClass('border-green-500');
  });

  it('validates tier selection on step 1', async () => {
    render(<BountyCreationWizard />);
    
    // Click next without selecting tier
    fireEvent.click(screen.getByText('Next →'));
    
    // Should show tier error on step 1
    await waitFor(() => {
      expect(screen.getByText('Please select a tier')).toBeInTheDocument();
    });
  });

  it('validates required fields on step 2', async () => {
    render(<BountyCreationWizard />);
    
    // Select tier first
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    
    // Click next to go to step 2
    fireEvent.click(screen.getByText('Next →'));
    
    // Should be on step 2
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    // Click next without filling title/description
    fireEvent.click(screen.getByText('Next →'));
    
    // Should show title error
    await waitFor(() => {
      expect(screen.getByText('Title is required')).toBeInTheDocument();
    });
  });

  it('navigates between steps', async () => {
    render(<BountyCreationWizard />);
    
    // Select tier
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    
    // Click next
    fireEvent.click(screen.getByText('Next →'));
    
    // Should be on step 2
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    // Click back
    fireEvent.click(screen.getByText('← Back'));
    
    // Should be back on step 1
    await waitFor(() => {
      expect(screen.getByText('Select Bounty Tier')).toBeInTheDocument();
    });
  });

  it('saves draft to localStorage', async () => {
    render(<BountyCreationWizard />);
    
    // Select tier
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    
    // Wait for localStorage to be updated
    await waitFor(() => {
      const draft = localStorageMock.getItem('bounty_creation_draft');
      expect(draft).toBeTruthy();
      expect(JSON.parse(draft!).tier).toBe('T1');
    });
  });

  it('loads draft from localStorage on mount', () => {
    // Pre-populate localStorage with a draft
    const draftData = {
      tier: 'T2',
      title: 'Test Bounty',
      description: 'Test description',
      requirements: ['Req 1'],
      category: 'Frontend',
      skills: ['React'],
      rewardAmount: 50000,
      deadline: '2026-04-01',
    };
    localStorageMock.setItem('bounty_creation_draft', JSON.stringify(draftData));
    
    render(<BountyCreationWizard />);
    
    // Check that T2 is selected (visual indicator would need more specific testing)
    const t2Button = screen.getByRole('button', { name: /Tier 2 - Open Race/i });
    expect(t2Button).toHaveClass('border-yellow-500');
  });

  it('ignores invalid draft data from localStorage', () => {
    // Pre-populate localStorage with invalid draft
    localStorageMock.setItem('bounty_creation_draft', JSON.stringify({
      tier: 'Invalid',
      malicious: 'data',
    }));
    
    render(<BountyCreationWizard />);
    
    // No tier should be selected
    const t1Button = screen.getByRole('button', { name: /Tier 1 - Open Race/i });
    expect(t1Button).not.toHaveClass('border-green-500');
  });

  it('adds and removes requirements', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 3
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    // Fill step 2
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test Title' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test Description' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    // Should be on step 3
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });
    
    // Add a requirement
    const addBtn = screen.getByText('Add Requirement');
    fireEvent.click(addBtn);
    
    // Should have 2 requirement inputs
    let inputs = screen.getAllByPlaceholderText('Enter requirement...');
    expect(inputs.length).toBe(2);
    
    // Remove the second requirement (find the × button adjacent to inputs[1])
    const removeButtons = screen.getAllByTitle('Remove');
    fireEvent.click(removeButtons[1]); // Click the second remove button
    
    // Should be back to 1 requirement
    inputs = screen.getAllByPlaceholderText('Enter requirement...');
    expect(inputs.length).toBe(1);
  });

  it('selects category and skills', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 4
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test Title' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test Description' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    // Select category
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    expect(screen.getByRole('combobox')).toHaveValue('Frontend');
    
    // Select a skill
    const reactButton = screen.getByRole('button', { name: 'React' });
    fireEvent.click(reactButton);
    expect(reactButton).toHaveClass('bg-purple-600');
    
    // Verify skill is in localStorage draft
    await waitFor(() => {
      const draft = JSON.parse(localStorageMock.getItem('bounty_creation_draft') || '{}');
      expect(draft.skills).toContain('React');
    });
  });

  it('sets reward amount with presets', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 5
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test Title' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test Description' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    // Select category and skill
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Reward & Deadline')).toBeInTheDocument();
    });
    
    // Click preset button for 250K
    const preset250K = screen.getByRole('button', { name: '250K' });
    fireEvent.click(preset250K);
    
    // Verify the reward amount input shows 250000
    const rewardInput = screen.getByRole('spinbutton');
    expect(rewardInput).toHaveValue(250000);
  });

  it('shows preview of bounty', async () => {
    const mockAuthState = {
      isGithubAuthenticated: true,
      isWalletConnected: true,
      walletBalance: 1000000,
    };
    
    render(<BountyCreationWizard authState={mockAuthState} />);
    
    // Navigate quickly to step 6 (preview)
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test Bounty Title' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: '**Bold description**' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Reward & Deadline')).toBeInTheDocument();
    });
    
    // Set deadline
    const today = new Date();
    today.setDate(today.getDate() + 10);
    const deadline = today.toISOString().split('T')[0];
    
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: deadline } });
    
    fireEvent.click(screen.getByText('Next →'));
    
    // Should be on preview step
    await waitFor(() => {
      expect(screen.getByText('Preview Bounty')).toBeInTheDocument();
    });
    
    // Verify title appears in preview
    expect(screen.getByText('Test Bounty Title')).toBeInTheDocument();
    // Category should be shown
    expect(screen.getByText('Frontend')).toBeInTheDocument();
  });

  it('shows fund & publish step with wallet status', async () => {
    render(<BountyCreationWizard />);

    // Navigate to step 7 using the helper
    await navigateToStep(7);

    // Should show Fund & Publish heading
    expect(screen.getByText('Fund & Publish')).toBeInTheDocument();

    // Wallet status should be shown (mocked as not connected)
    expect(screen.getByText(/Not connected/)).toBeInTheDocument();

    // Agreement checkbox should be present
    expect(screen.getByRole('checkbox')).toBeInTheDocument();

    // Wallet connect prompt should appear
    expect(screen.getByText(/connect your Solana wallet/i)).toBeInTheDocument();
  });

  it('shows fund button when agreement is checked', async () => {
    render(<BountyCreationWizard />);

    // Navigate to step 7
    await navigateToStep(7);

    // Check agreement
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    // The mocked FundBountyButton should be present (disabled since wallet not connected)
    const fundButton = screen.getByTestId('fund-button');
    expect(fundButton).toBeInTheDocument();
  });
});

describe('TierSelection', () => {
  it('displays all three tiers', () => {
    render(<BountyCreationWizard />);
    
    expect(screen.getByText(/Tier 1 - Open Race/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier 2 - Open Race/i)).toBeInTheDocument();
    expect(screen.getByText(/Tier 3 - Claim-Based/i)).toBeInTheDocument();
  });

  it('shows tier rules for each tier', () => {
    render(<BountyCreationWizard />);
    
    expect(screen.getByText('72 hours deadline')).toBeInTheDocument();
    expect(screen.getByText('7 days deadline')).toBeInTheDocument();
    expect(screen.getByText('14 days deadline')).toBeInTheDocument();
  });

  it('shows correct Tier 2 minimum score (7/10)', () => {
    render(<BountyCreationWizard />);
    
    // Tier 2 should show Min score: 7/10
    expect(screen.getByText('Min score: 7/10')).toBeInTheDocument();
  });
});

describe('TitleDescription', () => {
  it('renders title input and description textarea', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Implement User Authentication/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/Describe the bounty/i)).toBeInTheDocument();
    });
  });

  it('toggles markdown preview', async () => {
    render(<BountyCreationWizard />);

    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));

    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });

    // The Preview button is the one inside the description editor
    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    fireEvent.click(previewBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Edit/i })).toBeInTheDocument();
    });
  });

  it('renders markdown in preview mode', async () => {
    render(<BountyCreationWizard />);

    // Navigate to step 2
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));

    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });

    // Enter markdown content
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: '**Bold text** and `code`' },
    });

    // Click preview button
    const previewBtn = screen.getByRole('button', { name: /Preview/i });
    fireEvent.click(previewBtn);

    // Check that markdown is rendered (bold and code elements)
    await waitFor(() => {
      const previewContainer = screen.getByText(/Bold text/).closest('div');
      expect(previewContainer?.innerHTML).toContain('<strong');
      expect(previewContainer?.innerHTML).toContain('<code');
    });
  });
});

describe('RequirementsBuilder', () => {
  it('starts with one empty requirement', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 3
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Implement User Authentication/i)).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });
    
    const inputs = screen.getAllByPlaceholderText('Enter requirement...');
    expect(inputs.length).toBe(1);
  });

  it('validates at least one requirement needed', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 3 with empty requirement
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });
    
    // Try to go next without filling requirement
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('At least one requirement is required')).toBeInTheDocument();
    });
  });
});

describe('CategorySkills', () => {
  it('displays all categories when on step 4', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 4
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    // Check category dropdown exists
    const categorySelect = screen.getByRole('combobox');
    expect(categorySelect).toBeInTheDocument();
  });

  it('displays skill tags', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 4
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    // Check skill buttons exist
    expect(screen.getByRole('button', { name: 'TypeScript' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'React' })).toBeInTheDocument();
  });
});

describe('RewardDeadline', () => {
  it('displays preset reward amounts when on step 5', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 5
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Reward & Deadline')).toBeInTheDocument();
    });
    
    // Check preset buttons
    expect(screen.getByRole('button', { name: '50K' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '100K' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '250K' })).toBeInTheDocument();
  });

  it('validates Tier 2 minimum reward', async () => {
    render(<BountyCreationWizard />);
    
    // Select Tier 2
    fireEvent.click(screen.getByRole('button', { name: /Tier 2 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Test' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Test' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Reward & Deadline')).toBeInTheDocument();
    });
    
    // Set a low reward (below 500K for Tier 2)
    const rewardInput = screen.getByRole('spinbutton');
    fireEvent.change(rewardInput, { target: { value: '100000' } });
    
    // Set a deadline
    const today = new Date();
    today.setDate(today.getDate() + 10);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: today.toISOString().split('T')[0] },
    });
    
    // Try to go next
    fireEvent.click(screen.getByText('Next →'));
    
    // Should show Tier 2 reward error
    await waitFor(() => {
      expect(screen.getByText(/Tier 2 requires minimum reward of 500,000/)).toBeInTheDocument();
    });
  });
});

describe('PreviewBounty', () => {
  it('renders bounty preview card when on step 6', async () => {
    render(<BountyCreationWizard />);
    
    // Navigate to step 6
    fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Title & Description')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
      target: { value: 'Preview Test Bounty' },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
      target: { value: 'Preview description' },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Requirements Checklist')).toBeInTheDocument();
    });

    // Fill at least one requirement to pass validation
    const reqInputs = screen.getAllByPlaceholderText('Enter requirement...');
    fireEvent.change(reqInputs[0], { target: { value: 'Must pass all tests' } });

    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Category & Skills')).toBeInTheDocument();
    });
    
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'Frontend' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'React' }));
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Reward & Deadline')).toBeInTheDocument();
    });
    
    const today = new Date();
    today.setDate(today.getDate() + 10);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: today.toISOString().split('T')[0] },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    // Should show preview
    await waitFor(() => {
      expect(screen.getByText('Preview Bounty')).toBeInTheDocument();
      expect(screen.getByText('Preview Test Bounty')).toBeInTheDocument();
    });
  });
});

describe('ConfirmPublish', () => {
  it('shows wallet and escrow status on fund step', async () => {
    render(<BountyCreationWizard />);

    // Navigate to step 7
    await navigateToStep(7);

    // Fund & Publish heading
    expect(screen.getByText('Fund & Publish')).toBeInTheDocument();

    // Wallet status section should be visible
    expect(screen.getByText('Wallet')).toBeInTheDocument();

    // Escrow funding status
    expect(screen.getByText('Escrow Funding')).toBeInTheDocument();

    // Summary section with bounty tier and title
    expect(screen.getByText('Bounty Tier')).toBeInTheDocument();
    expect(screen.getByText('Staking Amount')).toBeInTheDocument();
  });
});