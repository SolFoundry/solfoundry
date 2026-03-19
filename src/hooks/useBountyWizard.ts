import { useState, useEffect, useCallback } from 'react';
import { BountyFormData, BountyValidationErrors, GitHubRepository } from '../types/bounty';

const DRAFT_STORAGE_KEY = 'bounty-draft';

interface UseBountyWizardReturn {
  currentStep: number;
  formData: BountyFormData;
  errors: BountyValidationErrors;
  isLoading: boolean;
  repositories: GitHubRepository[];
  updateFormData: (data: Partial<BountyFormData>) => void;
  validateStep: (step: number) => boolean;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  saveDraft: () => void;
  loadDraft: () => void;
  clearDraft: () => void;
  fetchRepositories: () => Promise<void>;
  submitBounty: () => Promise<void>;
  resetWizard: () => void;
}

const initialFormData: BountyFormData = {
  title: '',
  description: '',
  amount: '',
  currency: 'USD',
  tags: [],
  repository: null,
  deadline: '',
  requirements: '',
  deliverables: '',
  contactMethod: 'email',
  contactDetails: '',
};

const initialErrors: BountyValidationErrors = {};

export function useBountyWizard(): UseBountyWizardReturn {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BountyFormData>(initialFormData);
  const [errors, setErrors] = useState<BountyValidationErrors>(initialErrors);
  const [isLoading, setIsLoading] = useState(false);
  const [repositories, setRepositories] = useState<GitHubRepository[]>([]);

  // Load draft on mount
  useEffect(() => {
    loadDraft();
  }, []);

  const updateFormData = useCallback((data: Partial<BountyFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
    
    // Clear errors for updated fields
    const updatedFields = Object.keys(data);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => {
        delete newErrors[field as keyof BountyValidationErrors];
      });
      return newErrors;
    });
  }, []);

  const validateStep = useCallback((step: number): boolean => {
    const newErrors: BountyValidationErrors = {};

    switch (step) {
      case 0: // Basic Information
        if (!formData.title.trim()) {
          newErrors.title = 'Title is required';
        } else if (formData.title.length < 10) {
          newErrors.title = 'Title must be at least 10 characters';
        } else if (formData.title.length > 100) {
          newErrors.title = 'Title must not exceed 100 characters';
        }

        if (!formData.description.trim()) {
          newErrors.description = 'Description is required';
        } else if (formData.description.length < 50) {
          newErrors.description = 'Description must be at least 50 characters';
        }

        if (!formData.amount) {
          newErrors.amount = 'Amount is required';
        } else if (isNaN(Number(formData.amount)) || Number(formData.amount) <= 0) {
          newErrors.amount = 'Amount must be a positive number';
        }

        if (formData.tags.length === 0) {
          newErrors.tags = 'At least one tag is required';
        } else if (formData.tags.length > 10) {
          newErrors.tags = 'Maximum 10 tags allowed';
        }
        break;

      case 1: // Repository & Timeline
        if (!formData.repository) {
          newErrors.repository = 'Repository selection is required';
        }

        if (!formData.deadline) {
          newErrors.deadline = 'Deadline is required';
        } else if (new Date(formData.deadline) <= new Date()) {
          newErrors.deadline = 'Deadline must be in the future';
        }
        break;

      case 2: // Requirements & Deliverables
        if (!formData.requirements.trim()) {
          newErrors.requirements = 'Requirements are required';
        } else if (formData.requirements.length < 20) {
          newErrors.requirements = 'Requirements must be at least 20 characters';
        }

        if (!formData.deliverables.trim()) {
          newErrors.deliverables = 'Deliverables are required';
        } else if (formData.deliverables.length < 20) {
          newErrors.deliverables = 'Deliverables must be at least 20 characters';
        }
        break;

      case 3: // Contact Information
        if (!formData.contactDetails.trim()) {
          newErrors.contactDetails = 'Contact details are required';
        } else if (formData.contactMethod === 'email') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(formData.contactDetails)) {
            newErrors.contactDetails = 'Please enter a valid email address';
          }
        } else if (formData.contactMethod === 'discord') {
          if (!formData.contactDetails.includes('#') && !formData.contactDetails.startsWith('@')) {
            newErrors.contactDetails = 'Please enter a valid Discord username';
          }
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const nextStep = useCallback(() => {
    if (validateStep(currentStep) && currentStep < 4) {
      setCurrentStep(prev => prev + 1);
      saveDraft();
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step: number) => {
    if (step >= 0 && step <= 4) {
      // Validate all previous steps
      let canNavigate = true;
      for (let i = 0; i < step; i++) {
        if (!validateStep(i)) {
          canNavigate = false;
          break;
        }
      }
      
      if (canNavigate) {
        setCurrentStep(step);
      }
    }
  }, [validateStep]);

  const saveDraft = useCallback(() => {
    try {
      const draft = {
        formData,
        currentStep,
        timestamp: Date.now(),
      };
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch (error) {
      console.warn('Failed to save draft to localStorage:', error);
    }
  }, [formData, currentStep]);

  const loadDraft = useCallback(() => {
    try {
      const draftString = localStorage.getItem(DRAFT_STORAGE_KEY);
      if (draftString) {
        const draft = JSON.parse(draftString);
        
        // Check if draft is not too old (24 hours)
        const isRecent = Date.now() - draft.timestamp < 24 * 60 * 60 * 1000;
        
        if (isRecent && draft.formData) {
          setFormData(draft.formData);
          setCurrentStep(draft.currentStep || 0);
        }
      }
    } catch (error) {
      console.warn('Failed to load draft from localStorage:', error);
    }
  }, []);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear draft from localStorage:', error);
    }
  }, []);

  const fetchRepositories = useCallback(async () => {
    setIsLoading(true);
    try {
      // Mock GitHub API call - replace with actual API integration
      const response = await fetch('/api/github/repositories', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('github_token')}`,
        },
      });
      
      if (response.ok) {
        const repos = await response.json();
        setRepositories(repos);
      } else {
        throw new Error('Failed to fetch repositories');
      }
    } catch (error) {
      console.error('Error fetching repositories:', error);
      // Set mock data for development
      setRepositories([
        {
          id: 1,
          name: 'example-repo',
          full_name: 'user/example-repo',
          description: 'Example repository',
          html_url: 'https://github.com/user/example-repo',
          private: false,
          owner: {
            login: 'user',
            avatar_url: 'https://github.com/user.png',
          },
          stargazers_count: 123,
          forks_count: 45,
          language: 'TypeScript',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitBounty = useCallback(async () => {
    // Validate all steps
    const allStepsValid = [0, 1, 2, 3].every(step => validateStep(step));
    
    if (!allStepsValid) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/bounties', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        clearDraft();
        setCurrentStep(4); // Move to success step
      } else {
        throw new Error('Failed to create bounty');
      }
    } catch (error) {
      console.error('Error submitting bounty:', error);
      setErrors({ submit: 'Failed to create bounty. Please try again.' });
    } finally {
      setIsLoading(false);
    }
  }, [formData, validateStep, clearDraft]);

  const resetWizard = useCallback(() => {
    setFormData(initialFormData);
    setErrors(initialErrors);
    setCurrentStep(0);
    clearDraft();
  }, [clearDraft]);

  return {
    currentStep,
    formData,
    errors,
    isLoading,
    repositories,
    updateFormData,
    validateStep,
    nextStep,
    prevStep,
    goToStep,
    saveDraft,
    loadDraft,
    clearDraft,
    fetchRepositories,
    submitBounty,
    resetWizard,
  };
}