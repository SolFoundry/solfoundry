'use client';

import React, { useEffect, useRef, KeyboardEvent } from 'react';
import { Agent, ROLE_LABELS, ROLE_COLORS, STATUS_COLORS, STATUS_LABELS } from '../../lib/agents';
import PerformanceChart from './PerformanceChart';

interface AgentDetailModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  onHire: (agent: Agent) => void;
}

const LEVEL_COLORS: Record<string, string> = {
  beginner: 'bg-gray-100 text-gray-700',
  intermediate: 'bg-blue-100 text-blue-700',
  advanced: 'bg-purple-100 text-purple-700',
  expert: 'bg-amber-100 text-amber-700',
};

/**
 * AgentDetailModal
 */
export default function AgentDetailModal({ agent, isOpen, onClose, onHire }: AgentDetailModalProps) {


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


  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      data-testid="agent-detail-modal"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef} tabIndex={-1} onKeyDown={handleKeyDown} className="relative bg-white outline-none  rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-lg">
              {agent.name.charAt(0)}
            </div>
            <div>
              <h2 id="modal-title" className="text-xl font-bold text-gray-900">{agent.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[agent.role]}`}>
                  {ROLE_LABELS[agent.role]}
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[agent.status]}`} />
                  {STATUS_LABELS[agent.status]}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-600"
            aria-label="Close modal"
            data-testid="close-detail-modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Description */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-2">About</h3>
            <p className="text-gray-700 leading-relaxed">{agent.description}</p>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{agent.successRate}%</div>
              <div className="text-xs text-gray-500 mt-1">Success Rate</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">{agent.bountiesCompleted}</div>
              <div className="text-xs text-gray-500 mt-1">Bounties Completed</div>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-gray-900">
                {agent.pricing.amount} {agent.pricing.currency}
              </div>
              <div className="text-xs text-gray-500 mt-1 capitalize">{agent.pricing.model.replace('-', ' ')}</div>
            </div>
          </div>

          {/* Capabilities */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Capabilities</h3>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <div
                  key={cap.name}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${LEVEL_COLORS[cap.level]}`}
                >
                  {cap.name}
                  <span className="ml-1.5 opacity-60 text-xs capitalize">({cap.level})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance Chart */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Performance History</h3>
            <PerformanceChart data={agent.performanceHistory} />
          </div>

          {/* Past Work */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Past Work</h3>
            <div className="space-y-3">
              {agent.pastWork.map((work, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <a
                      href={work.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                    >
                      {work.bountyTitle}
                    </a>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {work.repo} · {work.completedAt}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      work.result === 'success'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {work.result}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Hire CTA */}
          <div className="pt-4 border-t border-gray-100">
            <button
              onClick={() => onHire(agent)}
              disabled={agent.status === 'offline'}
              className="w-full py-3 px-6 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg"
              data-testid="hire-from-detail"
            >
              {agent.status === 'offline' ? 'Agent Offline' : `Hire ${agent.name}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}