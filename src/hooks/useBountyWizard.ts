import { useState, useEffect, useCallback } from 'react';
import { useGitHub } from './useGitHub';

export interface BountyFormData {
  title: string;
  description: string;
  amount: number;
  currency: string;
  tags: string[];
  requirements: string;
  deadline: string;
  repository: string;
  issueUrl?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface ValidationErrors {
  title?: string;
  description?: string;
  amount?: string;
  deadline?: string;
  repository?: string;
}

export interface WizardStep {
  id: string;
  title: string;
  isComplete: boolean;
  isValid: boolean;
}

const DRAFT_KEY = 'bounty_draft';
const INITIAL_FORM_DATA: BountyFormData = {
  title: '',
  description: '',
  amount: 0,
  currency: 'USD',
  tags: [],
  requirements: '',
  deadline: '',
  repository: '',
  priority: 'medium',
};

const WIZARD_STEPS: WizardStep[] = [
  { id: 'basic', title: 'Basic Information', isComplete: false, isValid: false },
  { id: 'details', title: 'Details & Requirements', isComplete: false, isValid: false },
  { id: 'github', title: 'GitHub Integration', isComplete: false, isValid: false },
  { id: 'review', title: 'Review & Submit', isComplete: false, isValid: false },
];

export const useBountyWizard = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<BountyFormData>(INITIAL_FORM_DATA);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [steps, setSteps] = useState<WizardStep[]>(WIZARD_STEPS);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  
  const { repositories, searchIssues, createIssue, isLoading: githubLoading } = useGitHub();

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsedDraft = JSON.parse(savedDraft);
        setFormData({ ...INITIAL_FORM_DATA, ...parsedDraft });
        setIsDraftSaved(true);
      } catch (error) {
        console.error('Error loading draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever form data changes
  useEffect(() => {
    if (formData.title || formData.description || formData.amount > 0) {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
      setIsDraftSaved(true);
    }
  }, [formData]);

  const validateStep = useCallback((stepIndex: number): ValidationErrors => {
    const newErrors: ValidationErrors = {};

    switch (stepIndex) {
      case 0: // Basic Information
        if (!formData.title.trim()) {
          newErrors.title = 'Title is required';
        } else if (formData.title.length < 10) {
          newErrors.title = 'Title must be at least 10 characters';
        }

        if (!formData.description.trim()) {
          newErrors.description = 'Description is required';
        } else if (formData.description.length < 50) {
          newErrors.description = 'Description must be at least 50 characters';
        }

        if (!formData.amount || formData.amount <= 0) {
          newErrors.amount = 'Amount must be greater than 0';
        }
        break;

      case 1: // Details & Requirements
        if (!formData.deadline) {
          newErrors.deadline = 'Deadline is required';
        } else if (new Date(formData.deadline) <= new Date()) {
          newErrors.deadline = 'Deadline must be in the future';
        }
        break;

      case 2: // GitHub Integration
        if (!formData.repository) {
          newErrors.repository = 'Repository selection is required';
        }
        break;
    }

    return newErrors;
  }, [formData]);

  // Validate current step and update step status
  useEffect(() => {
    const stepErrors = validateStep(currentStep);
    setErrors(stepErrors);

    setSteps(prevSteps =>
      prevSteps.map((step, index) => ({
        ...step,
        isValid: Object.keys(validateStep(index)).length === 0,
        isComplete: index < currentStep || (index === currentStep && Object.keys(stepErrors).length === 0),
      }))
    );
  }, [currentStep, formData, validateStep]);

  const updateFormData = useCallback((updates: Partial<BountyFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    const stepErrors = validateStep(currentStep);
    if (Object.keys(stepErrors).length === 0 && currentStep < steps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, steps.length, validateStep]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((stepIndex: number) => {
    if (stepIndex >= 0 && stepIndex < steps.length) {
      setCurrentStep(stepIndex);
    }
  }, [steps.length]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setFormData(INITIAL_FORM_DATA);
    setCurrentStep(0);
    setErrors({});
    setIsDraftSaved(false);
    setSteps(WIZARD_STEPS);
  }, []);

  const submitBounty = useCallback(async () => {
    // Final validation
    const allErrors: ValidationErrors = {};
    for (let i = 0; i < steps.length - 1; i++) {
      Object.assign(allErrors, validateStep(i));
    }

    if (Object.keys(allErrors).length > 0) {
      setErrors(allErrors);
      return false;
    }

    setIsSubmitting(true);

    try {
      // Create GitHub issue if needed
      if (!formData.issueUrl && formData.repository) {
        const issueData = {
          title: formData.title,
          body: `${formData.description}\n\n**Bounty Amount:** ${formData.amount} ${formData.currency}\n**Deadline:** ${formData.deadline}\n**Requirements:** ${formData.requirements}`,
          labels: ['bounty', ...formData.tags],
        };

        const issue = await createIssue(formData.repository, issueData);
        if (issue) {
          formData.issueUrl = issue.html_url;
        }
      }

      // Here you would typically submit to your backend API
      // const response = await fetch('/api/bounties', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(formData),
      // });

      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Clear draft on successful submission
      clearDraft();
      
      return true;
    } catch (error) {
      console.error('Error submitting bounty:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, steps.length, validateStep, createIssue, clearDraft]);

  const canProceed = Object.keys(errors).length === 0;
  const isLastStep = currentStep === steps.length - 1;
  const currentStepData = steps[currentStep];

  return {
    // State
    currentStep,
    formData,
    errors,
    steps,
    isSubmitting,
    isDraftSaved,
    githubLoading,
    
    // Computed
    canProceed,
    isLastStep,
    currentStepData,
    
    // Actions
    updateFormData,
    nextStep,
    previousStep,
    goToStep,
    clearDraft,
    submitBounty,
    
    // GitHub integration
    repositories,
    searchIssues,
  };
};