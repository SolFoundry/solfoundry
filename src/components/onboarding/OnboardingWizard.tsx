import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { ChevronRightIcon, ChevronLeftIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon } from '@heroicons/react/24/solid';

interface OnboardingWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

interface Step {
  id: string;
  title: string;
  subtitle: string;
  component: React.ComponentType<StepProps>;
}

interface StepProps {
  onNext: () => void;
  onPrevious: () => void;
  onSkip?: () => void;
  isLastStep: boolean;
}

const STORAGE_KEY = 'solfoundry_onboarding_progress';

const WelcomeStep: React.FC<StepProps> = ({ onNext, onSkip }) => {
  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-20 h-20 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
        <span className="text-2xl font-bold text-white">SF</span>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Welcome to SolFoundry
        </h2>
        <p className="text-lg text-gray-600 dark:text-gray-300">
          The premier platform for Solana bounties and AI-powered code reviews
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">💰 Earn FNDRY Tokens</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Complete bounties and get rewarded with our native token
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">🤖 AI-Powered Reviews</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Get instant feedback from our Multi-LLM review pipeline
          </p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">🚀 Build on Solana</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Contribute to cutting-edge Solana ecosystem projects
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onNext}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          Get Started
          <ChevronRightIcon className="w-4 h-4" />
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Skip Tutorial
        </button>
      </div>
    </div>
  );
};

const ConnectWalletStep: React.FC<StepProps> = ({ onNext, onPrevious, onSkip }) => {
  const { connected, publicKey } = useWallet();

  useEffect(() => {
    if (connected && publicKey) {
      const timer = setTimeout(() => onNext(), 1000);
      return () => clearTimeout(timer);
    }
  }, [connected, publicKey, onNext]);

  return (
    <div className="text-center space-y-6">
      <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
        {connected ? (
          <CheckCircleIcon className="w-8 h-8 text-white" />
        ) : (
          <span className="text-2xl">👛</span>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Connect Your Solana Wallet
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Connect your wallet to receive bounty payments and track your contributions
        </p>
      </div>

      {connected && publicKey ? (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-green-800 dark:text-green-200 font-medium">
            ✅ Wallet Connected Successfully!
          </p>
          <p className="text-sm text-green-600 dark:text-green-400 font-mono mt-1">
            {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-center">
            <WalletMultiButton className="!bg-purple-600 hover:!bg-purple-700" />
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400">
            <p>Recommended wallets: Phantom, Solflare, Backpack</p>
          </div>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onPrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Previous
        </button>

        {connected ? (
          <button
            onClick={onNext}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            Continue
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={onSkip}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
};

const PickSkillsStep: React.FC<StepProps> = ({ onNext, onPrevious, onSkip }) => {
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const skillCategories = {
    'Frontend': ['React', 'TypeScript', 'Tailwind CSS', 'Next.js', 'Vue.js'],
    'Backend': ['Node.js', 'Python', 'Rust', 'Go', 'PostgreSQL'],
    'Blockchain': ['Solana', 'Anchor', 'Web3.js', 'Smart Contracts', 'DeFi'],
    'DevOps': ['Docker', 'AWS', 'CI/CD', 'Kubernetes', 'Terraform']
  };

  const toggleSkill = (skill: string) => {
    setSelectedSkills(prev =>
      prev.includes(skill)
        ? prev.filter(s => s !== skill)
        : [...prev, skill]
    );
  };

  const handleNext = () => {
    if (selectedSkills.length > 0) {
      localStorage.setItem('solfoundry_user_skills', JSON.stringify(selectedSkills));
    }
    onNext();
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-full flex items-center justify-center">
          <span className="text-2xl">🎯</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          What's Your Tech Stack?
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Select your skills so we can recommend relevant bounties
        </p>
      </div>

      <div className="space-y-4">
        {Object.entries(skillCategories).map(([category, skills]) => (
          <div key={category} className="space-y-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">{category}</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map(skill => (
                <button
                  key={skill}
                  onClick={() => toggleSkill(skill)}
                  className={`px-3 py-1 rounded-full text-sm transition-colors ${
                    selectedSkills.includes(skill)
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {skill}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400">
        Selected {selectedSkills.length} skills
      </div>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <button
          onClick={onPrevious}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center gap-2"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          Previous
        </button>

        <button
          onClick={handleNext}
          className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          Continue
          <ChevronRightIcon className="w-4 h-4" />
        </button>

        <button
          onClick={onSkip}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

const FirstBountyStep: React.FC<StepProps> = ({ onPrevious, isLastStep }) => {
  const mockBounties = [
    {
      id: 1,
      title: 'Fix TypeScript errors in wallet adapter',
      reward: '50,000 FNDRY',
      difficulty: 'Easy',
      tags: ['TypeScript', 'React'],
      time: '2-4 hours'
    },
    {
      id: 2,
      title: 'Add loading states to bounty list',
      reward: '75,000 FNDRY',
      difficulty: 'Medium',
      tags: ['React', 'Tailwind CSS'],
      time: '4-6 hours'
    },
    {
      id: 3,
      title: 'Implement Solana token balance display',
      reward: '150,000 FNDRY',
      difficulty: 'Hard',
      tags: ['Solana', 'Web3.js'],
      time: '1-2 days'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center space-y-4">
        <div className="mx-auto w-20 h-20 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
          <span className="text-2xl">🎯</span>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Pick Your First Bounty
        </h2>
        <p className="text-gray-600 dark:text-gray-300">
          Here are some bounties that match your skills. Choose one to get started!
        </p>
      </div>

      <div className="space-y-4">
        {mockBounties.map(bounty => (
          <div
            key={bounty.id}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-purple-300 dark:hover:border-purple-600 transition-colors cursor-pointer"
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {bounty.title}
              </h3>
              <span className="text-purple-600 dark:text-purple-400 font-bold">
                {bounty.reward}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-2">
              {bounty.tags.map(tag => (
                <span
                  key={tag}
                  className="px-2 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs rounded"
                >
                  {tag}
                </span>
              ))}
            </div>

            <div className="flex justify-between text-sm text-gray-500 dark:text-gray-400">
              <span>Difficulty: {bounty.difficulty}</span>
              <span>Est. time: {bounty.time}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          You can always browse all bounties later from the dashboard
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onPrevious}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors flex items-center gap-2"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            Previous
          </button>

          <button
            onClick={() => window.location.href = '/bounties'}
            className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            Browse All Bounties
          </button>
        </div>
      </div>
    </div>
  );
};

export const OnboardingWizard: React.FC<OnboardingWizardProps> = ({
  isOpen,
  onClose,
  onComplete
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  const steps: Step[] = [
    {
      id: 'welcome',
      title: 'Welcome',
      subtitle: 'Introduction to SolFoundry',
      component: WelcomeStep
    },
    {
      id: 'wallet',
      title: 'Connect Wallet',
      subtitle: 'Link your Solana wallet',
      component: ConnectWalletStep
    },
    {
      id: 'skills',
      title: 'Pick Skills',
      subtitle: 'Select your tech stack',
      component: PickSkillsStep
    },
    {
      id: 'bounty',
      title: 'First Bounty',
      subtitle: 'Choose your first task',
      component: FirstBountyStep
    }
  ];

  const currentStep = steps[currentStepIndex];
  const StepComponent = currentStep.component;

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { stepIndex } = JSON.parse(saved);
      setCurrentStepIndex(Math.min(stepIndex, steps.length - 1));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ stepIndex: currentStepIndex }));
  }, [currentStepIndex]);

  const handleNext = () => {
    if (currentStepIndex < steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(prev => prev - 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.removeItem(STORAGE_KEY);
    onComplete();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">
              {currentStep.title}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {currentStep.subtitle}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="px-6 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Step {currentStepIndex + 1} of {steps.length}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {Math.round(((currentStepIndex + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-purple-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${((currentStepIndex + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Step Content */}
        <div className="p-6">
          <StepComponent
            onNext={handleNext}
            onPrevious={handlePrevious}
            onSkip={handleSkip}
            isLastStep={currentStepIndex === steps.length - 1}
          />
        </div>
      </div>
    </div>
  );
};

export default OnboardingWizard;
