import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

// Helper to navigate through steps
async function navigateToStep(step: number) {
  const nextButtons = screen.getAllByRole('button');
  const nextButton = nextButtons.find(btn => btn.textContent?.includes('Next'));
  
  for (let i = 1; i < step; i++) {
    switch (i) {
      case 1:
        fireEvent.click(screen.getByRole('button', { name: /Tier 1 - Open Race/i }));
        break;
      case 2:
        fireEvent.change(screen.getByPlaceholderText(/Implement User Authentication/i), {
          target: { value: 'Test Title' },
        });
        fireEvent.change(screen.getByPlaceholderText(/Describe the bounty/i), {
          target: { value: 'Test Description' },
        });
        break;
      case 3:
        // Requirements already has one input
        break;
      case 4:
        fireEvent.change(screen.getByRole('combobox'), {
          target: { value: 'Frontend' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'React' }));
        break;
      case 5:
        // Reward and deadline already have defaults
        break;
    }
    if (i < step) {
      fireEvent.click(screen.getByText(/Next|Continue to Publish/));
      await waitFor(() => new Promise(resolve => setTimeout(resolve, 100)));
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
    expect(progressBar).toHaveAttribute('aria-valuenow', '14.285714285714286');
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
    
    const dateInput = screen.getByLabelText(/Deadline/);
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

  it('disables publish until confirmed and authenticated', async () => {
    const mockAuthState = {
      isGithubAuthenticated: false,
      isWalletConnected: false,
      walletBalance: 0,
    };
    
    render(<BountyCreationWizard authState={mockAuthState} />);
    
    // Navigate to step 7
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
    fireEvent.change(screen.getByLabelText(/Deadline/), {
      target: { value: today.toISOString().split('T')[0] },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Preview Bounty')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Continue to Publish'));
    
    await waitFor(() => {
      expect(screen.getByText('Confirm & Publish')).toBeInTheDocument();
    });
    
    // Publish button should be disabled
    const publishButton = screen.getByRole('button', { name: 'Publish Bounty' });
    expect(publishButton).toBeDisabled();
    
    // Check the agreement checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    // Still disabled due to auth
    expect(publishButton).toBeDisabled();
    expect(screen.getByText(/Please connect your GitHub account/)).toBeInTheDocument();
  });

  it('enables publish when authenticated and agreed', async () => {
    const mockAuthState = {
      isGithubAuthenticated: true,
      isWalletConnected: true,
      walletBalance: 1000000,
    };
    
    const onPublish = vi.fn().mockResolvedValue(undefined);
    
    render(<BountyCreationWizard authState={mockAuthState} onPublishBounty={onPublish} />);
    
    // Navigate to step 7
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
    fireEvent.change(screen.getByLabelText(/Deadline/), {
      target: { value: today.toISOString().split('T')[0] },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Preview Bounty')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Continue to Publish'));
    
    await waitFor(() => {
      expect(screen.getByText('Confirm & Publish')).toBeInTheDocument();
    });
    
    // Check the agreement checkbox
    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);
    
    // Now publish should be enabled
    const publishButton = screen.getByRole('button', { name: 'Publish Bounty' });
    expect(publishButton).toBeEnabled();
    
    // Click publish
    fireEvent.click(publishButton);
    
    // Should call onPublish
    await waitFor(() => {
      expect(onPublish).toHaveBeenCalled();
    });
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
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Preview'));
    
    await waitFor(() => {
      expect(screen.getByText('Edit')).toBeInTheDocument();
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
    
    // Click preview
    fireEvent.click(screen.getByText('Preview'));
    
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
    fireEvent.change(screen.getByLabelText(/Deadline/), {
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
    fireEvent.change(screen.getByLabelText(/Deadline/), {
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
  it('shows auth status', async () => {
    const mockAuthState = {
      isGithubAuthenticated: false,
      isWalletConnected: true,
      walletBalance: 50000,
    };
    
    render(<BountyCreationWizard authState={mockAuthState} />);
    
    // Navigate to step 7
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
    fireEvent.change(screen.getByLabelText(/Deadline/), {
      target: { value: today.toISOString().split('T')[0] },
    });
    fireEvent.click(screen.getByText('Next →'));
    
    await waitFor(() => {
      expect(screen.getByText('Preview Bounty')).toBeInTheDocument();
    });
    
    fireEvent.click(screen.getByText('Continue to Publish'));
    
    await waitFor(() => {
      expect(screen.getByText('Confirm & Publish')).toBeInTheDocument();
    });
    
    // Check auth status is shown
    expect(screen.getByText('GitHub Authentication')).toBeInTheDocument();
    expect(screen.getByText('✗ Not connected')).toBeInTheDocument();
    expect(screen.getByText('✓ Connected')).toBeInTheDocument(); // Wallet
  });
});