'use client';

import React, { useEffect, useRef, KeyboardEvent }, { useState } from 'react';
import { Agent, MOCK_BOUNTIES, ROLE_LABELS } from '@/lib/agents';

interface HireAgentModalProps {
  agent: Agent | null;
  isOpen: boolean;
  onClose: () => void;
}

type HireStep = 'select-bounty' | 'confirm' | 'success';

export default function HireAgentModal({ agent, isOpen, onClose }: HireAgentModalProps) {
  const [step, setStep] = useState<HireStep>('select-bounty');
  const [selectedBountyId, setSelectedBountyId] = useState<string | null>(null);

  if (!isOpen || !agent) return null;

  const modalRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (isOpen && modalRef.current) {
      modalRef.current.focus();
    }
  }, [isOpen]);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Tab') {
      // Basic focus trap mapping for accessibility
      const focusableElements = modalRef.current?.querySelectorAll(
        'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
      ) as NodeListOf<HTMLElement>;
      
      if (focusableElements && focusableElements.length > 0) {
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) { /* shift + tab */
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else { /* tab */
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    }
  };


  const selectedBounty = MOCK_BOUNTIES.find((b) => b.id === selectedBountyId);

  const handleConfirm = () => {
    // In production, this would call an API to assign the agent to the bounty
    setStep('success');
  };

  const handleClose = () => {
    setStep('select-bounty');
    setSelectedBountyId(null);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="hire-agent-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef} tabIndex={-1} onKeyDown={handleKeyDown} className="relative bg-white outline-none  rounded-2xl shadow-2xl max-w-lg w-full">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">
            {step === 'select-bounty' && 'Select a Bounty'}
            {step === 'confirm' && 'Confirm Hire'}
            {step === 'success' && 'Agent Hired!'}
          </h2>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
            aria-label="Close"
            data-testid="close-hire-modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          {/* Step 1: Select Bounty */}
          {step === 'select-bounty' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 mb-4">
                Choose a bounty for <span className="font-semibold text-gray-900">{agent.name}</span> ({ROLE_LABELS[agent.role]}) to work on:
              </p>
              {MOCK_BOUNTIES.map((bounty) => (
                <button
                  key={bounty.id}
                  onClick={() => setSelectedBountyId(bounty.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedBountyId === bounty.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                  data-testid={`bounty-option-${bounty.id}`}
                >
                  <div className="font-medium text-gray-900 text-sm">{bounty.title}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {bounty.repo} Â· Reward: {bounty.reward}
                  </div>
                </button>
              ))}
              <button
                onClick={() => selectedBountyId && setStep('confirm')}
                disabled={!selectedBountyId}
                className="w-full mt-4 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="proceed-to-confirm"
              >
                Continue
              </button>
            </div>
          )}

          {/* Step 2: Confirm */}
          {step === 'confirm' && selectedBounty && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Agent</span>
                  <span className="font-medium text-gray-900">{agent.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bounty</span>
                  <span className="font-medium text-gray-900">{selectedBounty.title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Repository</span>
                  <span className="font-medium text-gray-900">{selectedBounty.repo}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Bounty Reward</span>
                  <span className="font-medium text-gray-900">{selectedBounty.reward}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Agent Fee</span>
                  <span className="font-medium text-gray-900">
                    {agent.pricing.amount} {agent.pricing.currency} ({agent.pricing.model})
                  </span>
                </div>
                <hr className="border-gray-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Agent Success Rate</span>
                  <span className="font-bold text-green-600">{agent.successRate}%</span>
                </div>
              </div>

              <p className="text-xs text-gray-400">
                By confirming, the agent will claim this bounty and begin working on it. You can track progress in the bounty dashboard.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('select-bounty')}
                  className="flex-1 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                  data-testid="back-to-select"
                >
                  Back
                </button>
                <button
                  onClick={handleConfirm}
                  className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                  data-testid="confirm-hire"
                >
                  Confirm & Hire
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Success */}
          {step === 'success' && (
            <div className="text-center space-y-4 py-4">
              <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900">Agent Hired Successfully!</h3>
              <p className="text-sm text-gray-600">
                <span className="font-semibold">{agent.name}</span> has claimed the bounty and will begin working on it shortly.
              </p>
              <button
                onClick={handleClose}
                className="w-full py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                data-testid="close-success"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
