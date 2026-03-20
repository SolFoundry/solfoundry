import React from 'react';
import { ArrowRightIcon, SparklesIcon, CpuChipIcon, CurrencyDollarIcon } from '@heroicons/react/24/outline';

interface WelcomeStepProps {
  onNext: () => void;
  onSkip: () => void;
}

export default function WelcomeStep({ onNext, onSkip }: WelcomeStepProps) {
  return (
    <div className="max-w-2xl mx-auto px-6 py-8 text-center">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full mb-4">
          <SparklesIcon className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Welcome to SolFoundry
        </h1>
        <p className="text-lg text-gray-600 leading-relaxed">
          The premier platform where developers earn crypto for contributing to open source projects on Solana
        </p>
      </div>

      {/* Value Props */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <CurrencyDollarIcon className="w-6 h-6 text-green-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Earn $FNDRY Tokens</h3>
          <p className="text-sm text-gray-600">
            Complete bounties and earn cryptocurrency rewards for your contributions to Solana projects
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <CpuChipIcon className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">AI-Powered Reviews</h3>
          <p className="text-sm text-gray-600">
            Our advanced Multi-LLM pipeline ensures fair, thorough code reviews using GPT, Gemini, and Grok
          </p>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center mb-4 mx-auto">
            <SparklesIcon className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-semibold text-gray-900 mb-2">Quality Bounties</h3>
          <p className="text-sm text-gray-600">
            Work on real projects that matter in the Solana ecosystem with clear requirements and fair rewards
          </p>
        </div>
      </div>

      {/* How It Works */}
      <div className="bg-gray-50 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-semibold text-gray-900 mb-4">How SolFoundry Works</h3>
        <div className="space-y-3 text-left max-w-lg mx-auto">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-sm rounded-full flex items-center justify-center font-medium">
              1
            </span>
            <p className="text-sm text-gray-700">Browse available bounties across different Solana projects</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-sm rounded-full flex items-center justify-center font-medium">
              2
            </span>
            <p className="text-sm text-gray-700">Submit your solution via pull request with your Solana wallet address</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-sm rounded-full flex items-center justify-center font-medium">
              3
            </span>
            <p className="text-sm text-gray-700">AI reviews your code and scores it for quality and completeness</p>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-purple-500 text-white text-sm rounded-full flex items-center justify-center font-medium">
              4
            </span>
            <p className="text-sm text-gray-700">Get rewarded in $FNDRY tokens when your PR is merged!</p>
          </div>
        </div>
      </div>

      {/* CTA Buttons */}
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <button
          onClick={onNext}
          className="inline-flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-500 to-blue-500 text-white font-medium rounded-lg hover:from-purple-600 hover:to-blue-600 transition-all duration-200 shadow-lg"
        >
          Get Started
          <ArrowRightIcon className="w-4 h-4 ml-2" />
        </button>
        <button
          onClick={onSkip}
          className="px-6 py-3 text-gray-600 font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors"
        >
          Skip Tutorial
        </button>
      </div>

      {/* Footer Note */}
      <p className="text-xs text-gray-500 mt-6">
        Join thousands of developers already earning on SolFoundry
      </p>
    </div>
  );
}
