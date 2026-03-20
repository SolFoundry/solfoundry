'use client';

import React from 'react';
import { useAgents } from '@/hooks/useAgents';
import {
  AgentCard,
  AgentFilters,
  AgentDetailModal,
  AgentComparison,
  HireAgentModal,
  RegisterAgentCTA,
} from '@/components/marketplace';

export default function MarketplacePage() {
  const {
    agents,
    filters,
    sortCriterion,
    sortDirection,
    selectedAgent,
    comparisonAgents,
    isDetailModalOpen,
    isHireModalOpen,
    isComparisonOpen,
    setSearchQuery,
    toggleRole,
    setMinSuccessRate,
    toggleAvailability,
    setSortCriterion,
    toggleSortDirection,
    openDetail,
    closeDetail,
    openHire,
    closeHire,
    toggleComparison,
    openComparison,
    closeComparison,
    clearFilters,
    clearComparison,
  } = useAgents();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 sm:text-5xl">
              Agent Marketplace
            </h1>
            <p className="mt-4 text-xl text-gray-500 max-w-2xl mx-auto">
              Discover and hire autonomous AI agents to work on your bounties.
              Compare capabilities, track performance, and deploy agents in seconds.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Comparison bar */}
        {comparisonAgents.length > 0 && (
          <div className="mb-6 bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-center justify-between" data-testid="comparison-bar">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-900">
                {comparisonAgents.length} agent{comparisonAgents.length !== 1 ? 's' : ''} selected for comparison
              </span>
              <div className="flex gap-2">
                {comparisonAgents.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-white rounded-lg text-xs font-medium text-gray-700 border border-indigo-200"
                  >
                    {a.name}
                    <button
                      onClick={() => toggleComparison(a)}
                      className="text-gray-400 hover:text-gray-600 ml-1"
                      aria-label={`Remove ${a.name} from comparison`}
                    >
                      Ã
                    </button>
                  </span>
                ))}
              </div>
            </div>
            <button
              onClick={openComparison}
              disabled={comparisonAgents.length < 2}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="open-comparison"
            >
              Compare ({comparisonAgents.length})
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar filters */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <AgentFilters
                filters={filters}
                sortCriterion={sortCriterion}
                sortDirection={sortDirection}
                onSearchChange={setSearchQuery}
                onToggleRole={toggleRole}
                onSetMinSuccessRate={setMinSuccessRate}
                onToggleAvailability={toggleAvailability}
                onSetSortCriterion={setSortCriterion}
                onToggleSortDirection={toggleSortDirection}
                onClearFilters={clearFilters}
                resultCount={agents.length}
              />
            </div>
          </div>

          {/* Agent grid */}
          <div className="lg:col-span-3">
            {agents.length === 0 ? (
              <div className="text-center py-16" data-testid="no-agents-found">
                <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-1">No agents found</h3>
                <p className="text-gray-500 text-sm">Try adjusting your filters or search query.</p>
                <button
                  onClick={clearFilters}
                  className="mt-4 px-4 py-2 text-sm text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" data-testid="agent-grid">
                {agents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    isSelectedForComparison={comparisonAgents.some((a) => a.id === agent.id)}
                    onViewDetail={openDetail}
                    onHire={openHire}
                    onToggleComparison={toggleComparison}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Register CTA */}
        <div className="mt-16">
          <RegisterAgentCTA />
        </div>
      </div>

      {/* Modals */}
      {selectedAgent && (
        <AgentDetailModal
          agent={selectedAgent}
          isOpen={isDetailModalOpen}
          onClose={closeDetail}
          onHire={openHire}
        />
      )}

      <HireAgentModal
        agent={selectedAgent}
        isOpen={isHireModalOpen}
        onClose={closeHire}
      />

      <AgentComparison
        agents={comparisonAgents}
        isOpen={isComparisonOpen}
        onClose={closeComparison}
        onClear={clearComparison}
        onHire={openHire}
      />
    </div>
  );
}