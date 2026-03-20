'use client';

import React, { useEffect, useRef, KeyboardEvent } from 'react';
import { Agent, ROLE_LABELS, ROLE_COLORS, STATUS_LABELS, STATUS_COLORS } from '@/lib/agents';
import PerformanceChart from './PerformanceChart';

interface AgentComparisonProps {
  agents: Agent[];
  isOpen: boolean;
  onClose: () => void;
  onClear: () => void;
  onHire: (agent: Agent) => void;
}

export default function AgentComparison({ agents, isOpen, onClose, onClear, onHire }: AgentComparisonProps) {
  if (!isOpen || agents.length < 2) return null;

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


  const comparisonRows: { label: string; getValue: (a: Agent) => React.ReactNode }[] = [
    {
      label: 'Role',
      getValue: (a) => (
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[a.role]}`}>
          {ROLE_LABELS[a.role]}
        </span>
      ),
    },
    {
      label: 'Status',
      getValue: (a) => (
        <span className="flex items-center gap-1.5 justify-center">
          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[a.status]}`} />
          <span className="text-sm">{STATUS_LABELS[a.status]}</span>
        </span>
      ),
    },
    {
      label: 'Success Rate',
      getValue: (a) => {
        const best = Math.max(...agents.map((ag) => ag.successRate));
        return (
          <span className={`text-lg font-bold ${a.successRate === best ? 'text-green-600' : 'text-gray-900'}`}>
            {a.successRate}%
          </span>
        );
      },
    },
    {
      label: 'Bounties Completed',
      getValue: (a) => {
        const best = Math.max(...agents.map((ag) => ag.bountiesCompleted));
        return (
          <span className={`text-lg font-bold ${a.bountiesCompleted === best ? 'text-green-600' : 'text-gray-900'}`}>
            {a.bountiesCompleted}
          </span>
        );
      },
    },
    {
      label: 'Pricing',
      getValue: (a) => (
        <div className="text-sm">
          <span className="font-semibold">{a.pricing.amount} {a.pricing.currency}</span>
          <span className="text-gray-400 block text-xs capitalize">{a.pricing.model.replace('-', ' ')}</span>
        </div>
      ),
    },
    {
      label: 'Capabilities',
      getValue: (a) => (
        <div className="flex flex-wrap gap-1 justify-center">
          {a.capabilities.slice(0, 4).map((c) => (
            <span key={c.name} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs text-gray-600">
              {c.name}
            </span>
          ))}
          {a.capabilities.length > 4 && (
            <span className="text-xs text-gray-400">+{a.capabilities.length - 4} more</span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" data-testid="agent-comparison-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={modalRef} tabIndex={-1} onKeyDown={handleKeyDown} className="relative bg-white outline-none  rounded-2xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
          <h2 className="text-xl font-bold text-gray-900">Compare Agents ({agents.length})</h2>
          <div className="flex gap-2">
            <button
              onClick={onClear}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              data-testid="clear-comparison"
            >
              Clear All
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Comparison table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="text-left text-sm font-medium text-gray-500 pb-4 pr-4 w-40"></th>
                  {agents.map((agent) => (
                    <th key={agent.id} className="text-center pb-4 px-4 min-w-[200px]">
                      <div className="flex flex-col items-center gap-2">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl">
                          {agent.name.charAt(0)}
                        </div>
                        <span className="font-semibold text-gray-900">{agent.name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-t border-gray-100">
                    <td className="py-3 pr-4 text-sm font-medium text-gray-500">{row.label}</td>
                    {agents.map((agent) => (
                      <td key={agent.id} className="py-3 px-4 text-center">
                        {row.getValue(agent)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performance charts side by side */}
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Performance History</h3>
            <div className={`grid gap-6 ${agents.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
              {agents.map((agent) => (
                <div key={agent.id}>
                  <h4 className="text-sm font-medium text-gray-700 mb-2 text-center">{agent.name}</h4>
                  <PerformanceChart data={agent.performanceHistory} />
                </div>
              ))}
            </div>
          </div>

          {/* Hire buttons */}
          <div className={`mt-6 grid gap-4 ${agents.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onHire(agent)}
                disabled={agent.status === 'offline'}
                className="py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid={`compare-hire-${agent.id}`}
              >
                Hire {agent.name}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
