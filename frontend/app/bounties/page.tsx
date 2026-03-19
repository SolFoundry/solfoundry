'use client';

import React, { useState, useMemo } from 'react';
import { BountyCard } from '@/components/BountyCard';
import { BountyFilters, FilterState } from '@/components/BountyFilters';
import { mockBounties, Bounty } from '@/data/mockBounties';

export default function BountiesPage() {
  const [filters, setFilters] = useState<FilterState>({
    tier: 'all',
    status: 'open',
    skills: [],
    search: '',
    sortBy: 'newest'
  });

  const filteredBounties = useMemo(() => {
    let result = [...mockBounties];

    // Filter by tier
    if (filters.tier !== 'all') {
      result = result.filter(b => b.tier === filters.tier);
    }

    // Filter by status
    if (filters.status !== 'all') {
      result = result.filter(b => b.status === filters.status);
    }

    // Filter by skills
    if (filters.skills.length > 0) {
      result = result.filter(b => 
        filters.skills.some(skill => b.skills.includes(skill))
      );
    }

    // Search by keyword
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      result = result.filter(b => 
        b.title.toLowerCase().includes(searchLower) ||
        b.description.toLowerCase().includes(searchLower)
      );
    }

    // Sort
    switch (filters.sortBy) {
      case 'newest':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'reward':
        result.sort((a, b) => b.reward - a.reward);
        break;
      case 'deadline':
        result.sort((a, b) => a.deadline - b.deadline);
        break;
    }

    return result;
  }, [filters]);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            <span className="text-[#00FF88]">Bounty</span> Board
          </h1>
          <p className="text-gray-400">
            Find and claim bounties to earn $FNDRY rewards
          </p>
        </div>

        {/* Filters */}
        <BountyFilters filters={filters} onChange={setFilters} />

        {/* Results Count */}
        <div className="mb-4 text-gray-400">
          Showing {filteredBounties.length} bounties
        </div>

        {/* Bounty Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBounties.map(bounty => (
            <BountyCard key={bounty.id} bounty={bounty} />
          ))}
        </div>

        {/* Empty State */}
        {filteredBounties.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No bounties found matching your filters
          </div>
        )}
      </div>
    </div>
  );
}