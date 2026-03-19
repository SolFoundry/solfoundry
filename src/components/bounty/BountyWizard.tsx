import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { BountyTier, BountyCategory, BountyTag } from '../../types/bounty';

interface BountyFormData {
  tier: BountyTier | null;
  title: string;
  description: string;
  requirements: string[];
  category: BountyCategory | null;
  tags: BountyTag[];
  reward: number;
  deadline: string;
}

const initialFormData: BountyFormData = {
  tier: null,
  title: '',
  description: '',
  requirements: [''],
  category: null,
  tags: [],
  reward: 0,
  deadline: '',
};

const BOUNTY_TIERS: BountyTier[] = ['T1', 'T2', 'T3'];
const BOUNTY_CATEGORIES: BountyCategory[] = [
  'Development',
  'Design',
  'Content',
  'Research',
  'Testing',
  'Documentation',
];
const BOUNTY_TAGS: BountyTag[] = [
  'Frontend',
  'Backend',
  'UI/UX',
  'Mobile',
  'Web3',
  'API',
  'Database',
  'Security',
  'Performance',
  'Bug Fix',
];

interface BountyWizardProps {
  onSubmit: (data: BountyFormData) => void;
  onCancel: () => void;
}

const BountyWizard: React.FC<BountyWizardProps> = ({ onSubmit, onCancel }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BountyFormData>(initialFormData);

  const totalSteps = 7;

  const updateFormData = (updates: Partial<BountyFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return formData.tier !== null;
      case 2:
        return formData.title.trim() !== '' && formData.description.trim() !== '';
      case 3:
        return formData.requirements.some(req => req.trim() !== '');
      case 4:
        return formData.category !== null && formData.tags.length > 0;
      case 5:
        return formData.reward > 0 && formData.deadline !== '';
      case 6:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = () => {
    onSubmit(formData);
  };

  const addRequirement = () => {
    updateFormData({ requirements: [...formData.requirements, ''] });
  };

  const updateRequirement = (index: number, value: string) => {
    const newRequirements = [...formData.requirements];
    newRequirements[index] = value;
    updateFormData({ requirements: newRequirements });
  };

  const removeRequirement = (index: number) => {
    if (formData.requirements.length > 1) {
      const newRequirements = formData.requirements.filter((_, i) => i !== index);
      updateFormData({ requirements: newRequirements });
    }
  };

  const toggleTag = (tag: BountyTag) => {
    const newTags = formData.tags.includes(tag)
      ? formData.tags.filter(t => t !== tag)
      : [...formData.tags, tag];
    updateFormData({ tags: newTags });
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Select Bounty Tier</h2>
              <p className="text-gray-600">Choose the appropriate tier based on complexity and scope.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {BOUNTY_TIERS.map((tier) => (
                <button
                  key={tier}
                  onClick={() => updateFormData({ tier })}
                  className={`p-6 border-2 rounded-lg text-center transition-colors ${
                    formData.tier === tier
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <div className="text-2xl font-bold mb-2">{tier}</div>
                  <div className="text-sm text-gray-600">
                    {tier === 'T1' && 'Simple tasks (1-5 days)'}
                    {tier === 'T2' && 'Medium complexity (1-2 weeks)'}
                    {tier === 'T3' && 'Complex projects (2+ weeks)'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Title & Description</h2>
              <p className="text-gray-600">Provide a clear title and detailed description of the bounty.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Bounty Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => updateFormData({ title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter a clear, concise title"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => updateFormData({ description: e.target.value })}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Describe the bounty in detail, including context, goals, and expectations"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Requirements</h2>
              <p className="text-gray-600">List the specific requirements and acceptance criteria.</p>
            </div>
            <div className="space-y-4">
              {formData.requirements.map((requirement, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    value={requirement}
                    onChange={(e) => updateRequirement(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={`Requirement ${index + 1}`}
                  />
                  <button
                    onClick={() => removeRequirement(index)}
                    className="px-3 py-2 text-red-600 hover:text-red-800"
                    disabled={formData.requirements.length === 1}
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                onClick={addRequirement}
                className="text-blue-600 hover:text-blue-800 font-medium"
              >
                + Add Requirement
              </button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Category & Tags</h2>
              <p className="text-gray-600">Categorize your bounty and add relevant tags.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={formData.category || ''}
                onChange={(e) => updateFormData({ category: e.target.value as BountyCategory })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Select a category</option>
                {BOUNTY_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags
              </label>
              <div className="flex flex-wrap gap-2">
                {BOUNTY_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => toggleTag(tag)}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      formData.tags.includes(tag)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Reward & Deadline</h2>
              <p className="text-gray-600">Set the reward amount and completion deadline.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reward (USD)
              </label>
              <input
                type="number"
                value={formData.reward}
                onChange={(e) => updateFormData({ reward: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter reward amount"
                min="0"
                step="0.01"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Deadline
              </label>
              <input
                type="datetime-local"
                value={formData.deadline}
                onChange={(e) => updateFormData({ deadline: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Preview</h2>
              <p className="text-gray-600">Review your bounty before submitting.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div>
                <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                  {formData.tier}
                </span>
              </div>
              <h3 className="text-xl font-bold">{formData.title}</h3>
              <p className="text-gray-700">{formData.description}</p>
              <div>
                <h4 className="font-medium mb-2">Requirements:</h4>
                <ul className="list-disc list-inside text-gray-700">
                  {formData.requirements.filter(req => req.trim()).map((req, index) => (
                    <li key={index}>{req}</li>
                  ))}
                </ul>
              </div>
              <div className="flex gap-4">
                <div>
                  <span className="font-medium">Category: </span>
                  <span className="text-gray-700">{formData.category}</span>
                </div>
                <div>
                  <span className="font-medium">Reward: </span>
                  <span className="text-gray-700">${formData.reward}</span>
                </div>
              </div>
              <div>
                <span className="font-medium">Tags: </span>
                {formData.tags.map((tag, index) => (
                  <span key={tag} className="inline-block bg-gray-200 text-gray-700 px-2 py-1 rounded text-sm mr-1">
                    {tag}
                  </span>
                ))}
              </div>
              <div>
                <span className="font-medium">Deadline: </span>
                <span className="text-gray-700">
                  {new Date(formData.deadline).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        );

      case 7:
        return (
          <div className="space-y-6 text-center">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Confirmation</h2>
              <p className="text-gray-600">Are you ready to publish this bounty?</p>
            </div>
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-green-800 mb-2">Ready to Publish</h3>
              <p className="text-green-700">
                Your bounty "{formData.title}" will be published and visible to all contributors.
                You can manage and update it from your dashboard.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-gray-700">
            Step {currentStep} of {totalSteps}
          </span>
          <span className="text-sm text-gray-500">
            {Math.round((currentStep / totalSteps) * 100)}% Complete
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${(currentStep / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-lg p-8 mb-8">
        {renderStep()}
      </div>

      {/* Navigation */}
      <div className="flex justify-between items-center">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>

        <div className="flex gap-4">
          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Previous
          </button>

          {currentStep < totalSteps ? (
            <button
              onClick={nextStep}
              disabled={!canProceedToNextStep()}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRightIcon className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              Publish Bounty
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BountyWizard;