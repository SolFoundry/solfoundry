import React, { useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { TierSelection } from './steps/TierSelection';
import { TitleDescription } from './steps/TitleDescription';
import { Requirements } from './steps/Requirements';
import { CategoryTags } from './steps/CategoryTags';
import { RewardDeadline } from './steps/RewardDeadline';
import { Preview } from './steps/Preview';
import { Confirmation } from './steps/Confirmation';

export interface BountyFormData {
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | null;
  title: string;
  description: string;
  requirements: string[];
  category: string;
  tags: string[];
  reward: number;
  deadline: string;
  currency: 'USD' | 'BTC' | 'ETH';
}

const STEPS = [
  { id: 1, title: 'Select Tier', component: TierSelection },
  { id: 2, title: 'Title & Description', component: TitleDescription },
  { id: 3, title: 'Requirements', component: Requirements },
  { id: 4, title: 'Category & Tags', component: CategoryTags },
  { id: 5, title: 'Reward & Deadline', component: RewardDeadline },
  { id: 6, title: 'Preview', component: Preview },
  { id: 7, title: 'Confirmation', component: Confirmation }
];

export const BountyWizard: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<BountyFormData>({
    tier: null,
    title: '',
    description: '',
    requirements: [],
    category: '',
    tags: [],
    reward: 0,
    deadline: '',
    currency: 'USD'
  });

  const updateFormData = (data: Partial<BountyFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.tier !== null;
      case 2:
        return formData.title.trim() !== '' && formData.description.trim() !== '';
      case 3:
        return formData.requirements.length > 0;
      case 4:
        return formData.category !== '' && formData.tags.length > 0;
      case 5:
        return formData.reward > 0 && formData.deadline !== '';
      default:
        return true;
    }
  };

  const CurrentStepComponent = STEPS[currentStep - 1].component;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${currentStep >= step.id
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-600'
                  }`}
              >
                {step.id}
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={`w-full h-1 mx-2 
                    ${currentStep > step.id ? 'bg-blue-600' : 'bg-gray-200'}
                  `}
                />
              )}
            </div>
          ))}
        </div>
        <h2 className="text-2xl font-bold text-gray-900">
          Step {currentStep}: {STEPS[currentStep - 1].title}
        </h2>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <CurrentStepComponent
          formData={formData}
          updateFormData={updateFormData}
          onNext={nextStep}
        />
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={prevStep}
          disabled={currentStep === 1}
          className={`flex items-center px-4 py-2 rounded-md font-medium
            ${currentStep === 1
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          <ChevronLeftIcon className="w-5 h-5 mr-2" />
          Previous
        </button>

        {currentStep < STEPS.length ? (
          <button
            onClick={nextStep}
            disabled={!canProceed()}
            className={`flex items-center px-4 py-2 rounded-md font-medium
              ${!canProceed()
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
          >
            Next
            <ChevronRightIcon className="w-5 h-5 ml-2" />
          </button>
        ) : (
          <button
            onClick={() => {
              // Handle final submission
              console.log('Bounty created:', formData);
            }}
            className="bg-green-600 text-white px-6 py-2 rounded-md font-medium hover:bg-green-700"
          >
            Create Bounty
          </button>
        )}
      </div>
    </div>
  );
};