'use client';

import React, { useState, useEffect } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { BountyFormData, GitHubRepo, ValidationErrors } from '@/types/bounty';

interface Step {
  id: number;
  title: string;
  description: string;
}

const steps: Step[] = [
  { id: 1, title: 'Basic Info', description: 'Title and description' },
  { id: 2, title: 'Requirements', description: 'Technical requirements' },
  { id: 3, title: 'Repository', description: 'GitHub repository selection' },
  { id: 4, title: 'Deliverables', description: 'Expected deliverables' },
  { id: 5, title: 'Timeline', description: 'Timeline and deadlines' },
  { id: 6, title: 'Compensation', description: 'Payment details' },
  { id: 7, title: 'Review', description: 'Review and submit' }
];

const DRAFT_STORAGE_KEY = 'bounty_draft';

export default function BountyCreationWizard() {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BountyFormData>({
    title: '',
    description: '',
    requirements: '',
    repository: null,
    deliverables: [],
    timeline: '',
    deadline: '',
    amount: '',
    currency: 'USD',
    paymentTerms: '',
    tags: []
  });
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Load draft from localStorage on mount
  useEffect(() => {
    const savedDraft = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        setFormData(parsed);
      } catch (error) {
        console.error('Failed to parse saved draft:', error);
      }
    }
  }, []);

  // Save draft to localStorage whenever formData changes
  useEffect(() => {
    const timer = setTimeout(() => {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(formData));
    }, 1000);

    return () => clearTimeout(timer);
  }, [formData]);

  const updateFormData = (updates: Partial<BountyFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
    // Clear errors for updated fields
    const updatedFields = Object.keys(updates);
    setErrors(prev => {
      const newErrors = { ...prev };
      updatedFields.forEach(field => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep = (step: number): boolean => {
    const newErrors: ValidationErrors = {};

    switch (step) {
      case 1:
        if (!formData.title.trim()) newErrors.title = 'Title is required';
        if (!formData.description.trim()) newErrors.description = 'Description is required';
        break;
      case 2:
        if (!formData.requirements.trim()) newErrors.requirements = 'Requirements are required';
        break;
      case 3:
        if (!formData.repository) newErrors.repository = 'Repository selection is required';
        break;
      case 4:
        if (formData.deliverables.length === 0) newErrors.deliverables = 'At least one deliverable is required';
        break;
      case 5:
        if (!formData.timeline.trim()) newErrors.timeline = 'Timeline is required';
        if (!formData.deadline.trim()) newErrors.deadline = 'Deadline is required';
        break;
      case 6:
        if (!formData.amount.trim()) newErrors.amount = 'Amount is required';
        if (!formData.paymentTerms.trim()) newErrors.paymentTerms = 'Payment terms are required';
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, steps.length));
    }
  };

  const handlePrevious = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleStepClick = (step: number) => {
    setCurrentStep(step);
  };

  const searchRepositories = async (query: string) => {
    if (!query.trim()) {
      setRepos([]);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/github/search-repos?q=${encodeURIComponent(query)}`);
      const data = await response.json();
      setRepos(data.items || []);
    } catch (error) {
      console.error('Failed to search repositories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsLoading(true);
    try {
      const response = await fetch('/api/bounties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
        // Redirect to bounty details or list
      } else {
        throw new Error('Failed to create bounty');
      }
    } catch (error) {
      console.error('Failed to create bounty:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const addDeliverable = () => {
    updateFormData({
      deliverables: [...formData.deliverables, { id: Date.now(), title: '', description: '' }]
    });
  };

  const removeDeliverable = (id: number) => {
    updateFormData({
      deliverables: formData.deliverables.filter(d => d.id !== id)
    });
  };

  const updateDeliverable = (id: number, updates: Partial<{ title: string; description: string }>) => {
    updateFormData({
      deliverables: formData.deliverables.map(d => 
        d.id === id ? { ...d, ...updates } : d
      )
    });
  };

  const addTag = (tag: string) => {
    if (tag.trim() && !formData.tags.includes(tag.trim())) {
      updateFormData({ tags: [...formData.tags, tag.trim()] });
    }
  };

  const removeTag = (tag: string) => {
    updateFormData({ tags: formData.tags.filter(t => t !== tag) });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bounty Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${errors.title ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Enter bounty title"
              />
              {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title}</p>}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                rows={4}
                className={`w-full px-3 py-2 border rounded-md ${errors.description ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe the bounty in detail"
              />
              {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.tags.map(tag => (
                  <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-sm flex items-center gap-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="text-blue-600 hover:text-blue-800">×</button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                placeholder="Add tags (press Enter)"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Technical Requirements *
              </label>
              <textarea
                value={formData.requirements}
                onChange={(e) => updateFormData({ requirements: e.target.value })}
                rows={6}
                className={`w-full px-3 py-2 border rounded-md ${errors.requirements ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe the technical requirements, skills needed, etc."
              />
              {errors.requirements && <p className="text-red-500 text-sm mt-1">{errors.requirements}</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                GitHub Repository *
              </label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchRepositories(e.target.value);
                }}
                placeholder="Search for repositories..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              {errors.repository && <p className="text-red-500 text-sm mt-1">{errors.repository}</p>}
            </div>

            {isLoading && <p className="text-gray-500">Searching...</p>}

            {repos.length > 0 && (
              <div className="max-h-64 overflow-y-auto border border-gray-300 rounded-md">
                {repos.map(repo => (
                  <div
                    key={repo.id}
                    onClick={() => updateFormData({ repository: repo })}
                    className={`p-3 cursor-pointer hover:bg-gray-50 border-b border-gray-200 ${
                      formData.repository?.id === repo.id ? 'bg-blue-50 border-blue-200' : ''
                    }`}
                  >
                    <div className="font-medium">{repo.full_name}</div>
                    <div className="text-sm text-gray-600">{repo.description}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      ⭐ {repo.stargazers_count} • {repo.language}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formData.repository && (
              <div className="bg-green-50 border border-green-200 rounded-md p-3">
                <div className="font-medium text-green-800">Selected Repository</div>
                <div className="text-green-700">{formData.repository.full_name}</div>
              </div>
            )}
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-medium">Deliverables *</h3>
              <button
                onClick={addDeliverable}
                className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-700"
              >
                Add Deliverable
              </button>
            </div>

            {errors.deliverables && <p className="text-red-500 text-sm">{errors.deliverables}</p>}

            <div className="space-y-4">
              {formData.deliverables.map((deliverable, index) => (
                <div key={deliverable.id} className="border border-gray-300 rounded-md p-4">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium">Deliverable {index + 1}</h4>
                    <button
                      onClick={() => removeDeliverable(deliverable.id)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </button>
                  </div>
                  
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={deliverable.title}
                      onChange={(e) => updateDeliverable(deliverable.id, { title: e.target.value })}
                      placeholder="Deliverable title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <textarea
                      value={deliverable.description}
                      onChange={(e) => updateDeliverable(deliverable.id, { description: e.target.value })}
                      rows={2}
                      placeholder="Deliverable description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expected Timeline *
              </label>
              <textarea
                value={formData.timeline}
                onChange={(e) => updateFormData({ timeline: e.target.value })}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md ${errors.timeline ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe the expected timeline for completion"
              />
              {errors.timeline && <p className="text-red-500 text-sm mt-1">{errors.timeline}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline *
              </label>
              <input
                type="date"
                value={formData.deadline}
                onChange={(e) => updateFormData({ deadline: e.target.value })}
                className={`w-full px-3 py-2 border rounded-md ${errors.deadline ? 'border-red-500' : 'border-gray-300'}`}
              />
              {errors.deadline && <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>}
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => updateFormData({ amount: e.target.value })}
                  className={`w-full px-3 py-2 border rounded-md ${errors.amount ? 'border-red-500' : 'border-gray-300'}`}
                  placeholder="0"
                />
                {errors.amount && <p className="text-red-500 text-sm mt-1">{errors.amount}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Currency
                </label>
                <select
                  value={formData.currency}
                  onChange={(e) => updateFormData({ currency: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="ETH">ETH</option>
                  <option value="BTC">BTC</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Payment Terms *
              </label>
              <textarea
                value={formData.paymentTerms}
                onChange={(e) => updateFormData({ paymentTerms: e.target.value })}
                rows={3}
                className={`w-full px-3 py-2 border rounded-md ${errors.paymentTerms ? 'border-red-500' : 'border-gray-300'}`}
                placeholder="Describe payment terms, milestones, etc."
              />
              {errors.paymentTerms && <p className="text-red-500 text-sm mt-1">{errors.paymentTerms}</p>}
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-medium mb-4">Review Your Bounty</h3>
            
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Basic Information</h4>
                <p><strong>Title:</strong> {formData.title}</p>
                <p><strong>Description:</strong> {formData.description}</p>
                <p><strong>Tags:</strong> {formData.tags.join(', ')}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Requirements</h4>
                <p>{formData.requirements}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Repository</h4>
                <p>{formData.repository?.full_name}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Deliverables</h4>
                <ul className="list-disc list-inside">
                  {formData.deliverables.map((deliverable, index) => (
                    <li key={deliverable.id}>{deliverable.title}</li>
                  ))}
                </ul>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Timeline</h4>
                <p><strong>Timeline:</strong> {formData.timeline}</p>
                <p><strong>Deadline:</strong> {formData.deadline}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-md">
                <h4 className="font-medium mb-2">Compensation</h4>
                <p><strong>Amount:</strong> {formData.amount} {formData.currency}</p>
                <p><strong>Payment Terms:</strong> {formData.paymentTerms}</p>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => handleStepClick(step.id)}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  currentStep === step.id
                    ? 'bg-blue-600 text-white'
                    : currentStep > step.id
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}
              >
                {step.id}
              </button>
              {index < steps.length - 1 && (
                <div
                  className={`h-1 w-16 mx-2 ${
                    currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-center">
          <h2 className="text-xl font-semibold">{steps[currentStep - 1].title}</h2>
          <p className="text-gray-600">{steps[currentStep - 1].description}</p>
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        {renderStepContent()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={handlePrevious}
          disabled={currentStep === 1}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Previous
        </button>

        {currentStep === steps.length ? (
          <button
            onClick={handleSubmit}
            disabled={isLoading}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Creating...' : 'Create Bounty'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Next
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Draft Indicator */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Draft automatically saved to local storage
      </div>
    </div>
  );
}