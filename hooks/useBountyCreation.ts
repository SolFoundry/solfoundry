import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

export interface BountyDraft {
  id?: string;
  title: string;
  description: string;
  amount: string;
  currency: 'USD' | 'ETH' | 'BTC';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  requirements: string[];
  acceptanceCriteria: string[];
  timelineWeeks: number;
  githubRepo?: string;
  githubIssue?: string;
  attachments: File[];
  isDraft: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface BountyCreationState {
  currentStep: number;
  totalSteps: number;
  isSubmitting: boolean;
  isDraftSaving: boolean;
  errors: Record<string, string>;
  draft: BountyDraft;
}

const initialDraft: BountyDraft = {
  title: '',
  description: '',
  amount: '',
  currency: 'USD',
  difficulty: 'beginner',
  category: '',
  tags: [],
  requirements: [],
  acceptanceCriteria: [],
  timelineWeeks: 1,
  attachments: [],
  isDraft: true,
};

const TOTAL_STEPS = 5;
const DRAFT_SAVE_DELAY = 2000; // Auto-save after 2 seconds of inactivity

export const useBountyCreation = (draftId?: string) => {
  const router = useRouter();
  const [state, setState] = useState<BountyCreationState>({
    currentStep: 1,
    totalSteps: TOTAL_STEPS,
    isSubmitting: false,
    isDraftSaving: false,
    errors: {},
    draft: initialDraft,
  });

  const [autoSaveTimeout, setAutoSaveTimeout] = useState<NodeJS.Timeout | null>(null);

  // Load draft on mount
  useEffect(() => {
    if (draftId) {
      loadDraft(draftId);
    } else {
      // Load from localStorage if no draftId provided
      const savedDraft = localStorage.getItem('bounty-draft');
      if (savedDraft) {
        try {
          const parsedDraft = JSON.parse(savedDraft);
          setState(prev => ({ ...prev, draft: parsedDraft }));
        } catch (error) {
          console.error('Failed to load draft from localStorage:', error);
        }
      }
    }
  }, [draftId]);

  // Auto-save draft
  useEffect(() => {
    if (autoSaveTimeout) {
      clearTimeout(autoSaveTimeout);
    }

    const timeout = setTimeout(() => {
      saveDraft();
    }, DRAFT_SAVE_DELAY);

    setAutoSaveTimeout(timeout);

    return () => {
      if (timeout) {
        clearTimeout(timeout);
      }
    };
  }, [state.draft]);

  const loadDraft = async (id: string) => {
    try {
      setState(prev => ({ ...prev, isDraftSaving: true }));
      const response = await fetch(`/api/bounties/drafts/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to load draft');
      }

      const draft = await response.json();
      setState(prev => ({
        ...prev,
        draft,
        isDraftSaving: false,
      }));
    } catch (error) {
      console.error('Error loading draft:', error);
      toast.error('Failed to load draft');
      setState(prev => ({ ...prev, isDraftSaving: false }));
    }
  };

  const saveDraft = async () => {
    if (!state.draft.title && !state.draft.description) {
      return; // Don't save empty drafts
    }

    try {
      setState(prev => ({ ...prev, isDraftSaving: true }));

      const draftData = {
        ...state.draft,
        isDraft: true,
        updatedAt: new Date().toISOString(),
      };

      if (draftId) {
        // Update existing draft
        const response = await fetch(`/api/bounties/drafts/${draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        });

        if (!response.ok) {
          throw new Error('Failed to update draft');
        }
      } else {
        // Create new draft
        const response = await fetch('/api/bounties/drafts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(draftData),
        });

        if (!response.ok) {
          throw new Error('Failed to save draft');
        }

        const { id } = await response.json();
        setState(prev => ({
          ...prev,
          draft: { ...prev.draft, id },
        }));

        // Update URL with draft ID
        router.replace(`/bounties/create?draft=${id}`, { scroll: false });
      }

      // Also save to localStorage as backup
      localStorage.setItem('bounty-draft', JSON.stringify(draftData));

      setState(prev => ({ ...prev, isDraftSaving: false }));
    } catch (error) {
      console.error('Error saving draft:', error);
      setState(prev => ({ ...prev, isDraftSaving: false }));
    }
  };

  const updateDraft = useCallback((updates: Partial<BountyDraft>) => {
    setState(prev => ({
      ...prev,
      draft: { ...prev.draft, ...updates },
      errors: {}, // Clear errors when updating
    }));
  }, []);

  const nextStep = useCallback(() => {
    if (state.currentStep < TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep + 1 }));
    }
  }, [state.currentStep]);

  const prevStep = useCallback(() => {
    if (state.currentStep > 1) {
      setState(prev => ({ ...prev, currentStep: prev.currentStep - 1 }));
    }
  }, [state.currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 1 && step <= TOTAL_STEPS) {
      setState(prev => ({ ...prev, currentStep: step }));
    }
  }, []);

  const validateStep = (step: number): boolean => {
    const errors: Record<string, string> = {};

    switch (step) {
      case 1: // Basic Info
        if (!state.draft.title.trim()) {
          errors.title = 'Title is required';
        }
        if (!state.draft.description.trim()) {
          errors.description = 'Description is required';
        }
        if (!state.draft.category) {
          errors.category = 'Category is required';
        }
        break;

      case 2: // Requirements & Criteria
        if (state.draft.requirements.length === 0) {
          errors.requirements = 'At least one requirement is needed';
        }
        if (state.draft.acceptanceCriteria.length === 0) {
          errors.acceptanceCriteria = 'At least one acceptance criteria is needed';
        }
        break;

      case 3: // Reward & Timeline
        if (!state.draft.amount || parseFloat(state.draft.amount) <= 0) {
          errors.amount = 'Valid reward amount is required';
        }
        if (state.draft.timelineWeeks < 1 || state.draft.timelineWeeks > 52) {
          errors.timelineWeeks = 'Timeline must be between 1-52 weeks';
        }
        break;

      case 4: // GitHub Integration (optional)
        if (state.draft.githubRepo && !isValidGitHubRepo(state.draft.githubRepo)) {
          errors.githubRepo = 'Invalid GitHub repository format';
        }
        break;

      case 5: // Review (no validation needed)
        break;
    }

    setState(prev => ({ ...prev, errors }));
    return Object.keys(errors).length === 0;
  };

  const createGitHubIssue = async (): Promise<string | null> => {
    if (!state.draft.githubRepo) {
      return null;
    }

    try {
      const response = await fetch('/api/github/create-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repo: state.draft.githubRepo,
          title: state.draft.title,
          body: formatIssueBody(state.draft),
          labels: ['bounty', ...state.draft.tags],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to create GitHub issue');
      }

      const { issueUrl } = await response.json();
      return issueUrl;
    } catch (error) {
      console.error('Error creating GitHub issue:', error);
      toast.error('Failed to create GitHub issue');
      return null;
    }
  };

  const submitBounty = async (): Promise<boolean> => {
    setState(prev => ({ ...prev, isSubmitting: true }));

    try {
      // Validate all steps
      for (let i = 1; i <= TOTAL_STEPS; i++) {
        if (!validateStep(i)) {
          setState(prev => ({ ...prev, currentStep: i, isSubmitting: false }));
          return false;
        }
      }

      // Create GitHub issue if repository is provided
      let githubIssueUrl = null;
      if (state.draft.githubRepo) {
        githubIssueUrl = await createGitHubIssue();
      }

      // Upload attachments
      const uploadedAttachments = await uploadAttachments(state.draft.attachments);

      // Create bounty
      const bountyData = {
        ...state.draft,
        githubIssue: githubIssueUrl,
        attachments: uploadedAttachments,
        isDraft: false,
        createdAt: new Date().toISOString(),
      };

      const response = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bountyData),
      });

      if (!response.ok) {
        throw new Error('Failed to create bounty');
      }

      const { id: bountyId } = await response.json();

      // Clean up draft
      if (draftId) {
        await fetch(`/api/bounties/drafts/${draftId}`, { method: 'DELETE' });
      }
      localStorage.removeItem('bounty-draft');

      toast.success('Bounty created successfully!');
      router.push(`/bounties/${bountyId}`);
      return true;

    } catch (error) {
      console.error('Error submitting bounty:', error);
      toast.error('Failed to create bounty');
      setState(prev => ({ ...prev, isSubmitting: false }));
      return false;
    }
  };

  const uploadAttachments = async (files: File[]): Promise<string[]> => {
    if (files.length === 0) return [];

    const formData = new FormData();
    files.forEach(file => formData.append('files', file));

    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Failed to upload attachments');
    }

    const { urls } = await response.json();
    return urls;
  };

  const deleteDraft = async () => {
    if (!draftId) {
      localStorage.removeItem('bounty-draft');
      return;
    }

    try {
      await fetch(`/api/bounties/drafts/${draftId}`, { method: 'DELETE' });
      localStorage.removeItem('bounty-draft');
      toast.success('Draft deleted');
      router.push('/bounties/create');
    } catch (error) {
      console.error('Error deleting draft:', error);
      toast.error('Failed to delete draft');
    }
  };

  return {
    ...state,
    updateDraft,
    nextStep,
    prevStep,
    goToStep,
    validateStep,
    submitBounty,
    saveDraft,
    deleteDraft,
  };
};

// Utility functions
const isValidGitHubRepo = (repo: string): boolean => {
  const githubRepoRegex = /^https:\/\/github\.com\/[\w.-]+\/[\w.-]+$/;
  return githubRepoRegex.test(repo);
};

const formatIssueBody = (draft: BountyDraft): string => {
  return `# ${draft.title}

## Description
${draft.description}

## Requirements
${draft.requirements.map(req => `- ${req}`).join('\n')}

## Acceptance Criteria
${draft.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

## Reward
${draft.amount} ${draft.currency}

## Timeline
${draft.timelineWeeks} week(s)

## Difficulty
${draft.difficulty}

## Tags
${draft.tags.join(', ')}

---
*This issue was created automatically from a bounty posting.*`;
};