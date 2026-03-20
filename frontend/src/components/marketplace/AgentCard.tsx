'use client';

import React from 'react';
import { Agent, ROLE_LABELS, ROLE_COLORS, STATUS_COLORS, STATUS_LABELS } from '@/lib/agents';

interface AgentCardProps {
  agent: Agent;
  isSelectedForComparison: boolean;
  onViewDetail: (agent: Agent) => void;
  onHire: (agent: Agent) => void;
  onToggleComparison: (agent: Agent) => void;
}

export default function AgentCard({
  agent,
  isSelectedForComparison,
  onViewDetail,
  onHire,
  onToggleComparison,
}: AgentCardProps) {
  return (
    <div
      className={`relative rounded-xl border-2 transition-all duration-200 hover:shadow-lg ${
        isSelectedForComparison
          ? 'border-indigo-500 shadow-indigo-100 bg-indigo-50/30'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
      data-testid={`agent-card-${agent.id}`}
    >
      {/* Status indicator */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[agent.status]}`} />
        <span className="text-xs text-gray-500 font-medium">{STATUS_LABELS[agent.status]}</span>
      </div>

      <div className="p-6">
        {/* Avatar + Name */}
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white font-bold text-xl shadow-md overflow-hidden relative" data-testid={`agent-avatar-${agent.id}`}>
            {agent.avatar ? (
              <img 
                src={agent.avatar} 
                alt={`${agent.name} avatar`} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                  const nextSibling = e.currentTarget.nextElementSibling;
                  if (nextSibling) {
                    nextSibling.classList.remove('hidden');
                  }
                }}
              />
            ) : null}
            <span className={agent.avatar ? "hidden text-xl" : "text-xl"}>{agent.name.charAt(0)}</span>
          </div>
          <div>
            <h3 className="font-semibold text-lg text-gray-900">{agent.name}</h3>
            <span
              className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium ${ROLE_COLORS[agent.role]}`}
            >
              {ROLE_LABELS[agent.role]}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{agent.successRate}%</div>
            <div className="text-xs text-gray-500">Success Rate</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-gray-900">{agent.bountiesCompleted}</div>
            <div className="text-xs text-gray-500">Bounties Done</div>
          </div>
        </div>

        {/* Pricing */}
        <div className="mb-4 text-sm text-gray-600">
          <span className="font-medium text-gray-900">{agent.pricing.amount} {agent.pricing.currency}</span>
          <span className="text-gray-400"> / {agent.pricing.model === 'per-bounty' ? 'bounty' : agent.pricing.model === 'hourly' ? 'hour' : 'flat rate'}</span>
        </div>

        {/* Description truncated */}
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{agent.description}</p>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={() => onViewDetail(agent)}
            className="flex-1 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            data-testid={`view-detail-${agent.id}`}
          >
            View Details
          </button>
          <button
            onClick={() => onHire(agent)}
            disabled={agent.status === 'offline'}
            className="flex-1 px-3 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid={`hire-${agent.id}`}
          >
            Hire Agent
          </button>
        </div>

        {/* Comparison toggle */}
        <button
          onClick={() => onToggleComparison(agent)}
          className={`mt-3 w-full px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
            isSelectedForComparison
              ? 'border-indigo-500 text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
          }`}
          data-testid={`compare-toggle-${agent.id}`}
        >
          {isSelectedForComparison ? 'â Selected for Comparison' : '+ Compare'}
        </button>
      </div>
    </div>
  );
}
