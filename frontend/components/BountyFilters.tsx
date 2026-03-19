'use client';

import React from 'react';

export interface FilterState {
  tier: 'all' | 'T1' | 'T2' | 'T3';
  status: 'all' | 'open' | 'in-progress' | 'completed';
  skills: string[];
  search: string;
  sortBy: 'newest' | 'reward' | 'deadline';
}

interface BountyFiltersProps {
  filters: FilterState;
  onChange: (filters: FilterState) => void;
}

const SKILLS = ['TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Rust', 'Solana'];

export function BountyFilters({ filters, onChange }: BountyFiltersProps) {
  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onChange({ ...filters, [key]: value });
  };

  const toggleSkill = (skill: string) => {
    const newSkills = filters.skills.includes(skill)
      ? filters.skills.filter(s => s !== skill)
      : [...filters.skills, skill];
    updateFilter('skills', newSkills);
  };

  return (
    <div className="bg-[#111111] border border-gray-800 rounded-lg p-4 mb-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Search */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Search</label>
          <input
            type="text"
            value={filters.search}
            onChange={(e) => updateFilter('search', e.target.value)}
            placeholder="Search bounties..."
            className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-white placeholder-gray-500 focus:border-[#00FF88] focus:outline-none"
          />
        </div>

        {/* Tier Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tier</label>
          <select
            value={filters.tier}
            onChange={(e) => updateFilter('tier', e.target.value as FilterState['tier'])}
            className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          >
            <option value="all">All Tiers</option>
            <option value="T1">Tier 1 (50-500 FNDRY)</option>
            <option value="T2">Tier 2 (500-5000 FNDRY)</option>
            <option value="T3">Tier 3 (5000+ FNDRY)</option>
          </select>
        </div>

        {/* Status Filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => updateFilter('status', e.target.value as FilterState['status'])}
            className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="in-progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {/* Sort */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Sort By</label>
          <select
            value={filters.sortBy}
            onChange={(e) => updateFilter('sortBy', e.target.value as FilterState['sortBy'])}
            className="w-full bg-[#0a0a0a] border border-gray-700 rounded px-3 py-2 text-white focus:border-[#00FF88] focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="reward">Highest Reward</option>
            <option value="deadline">Deadline</option>
          </select>
        </div>
      </div>

      {/* Skills Filter */}
      <div className="mt-4">
        <label className="block text-sm text-gray-400 mb-2">Skills</label>
        <div className="flex flex-wrap gap-2">
          {SKILLS.map(skill => (
            <button
              key={skill}
              onClick={() => toggleSkill(skill)}
              className={`px-3 py-1 text-sm rounded border transition-colors ${
                filters.skills.includes(skill)
                  ? 'bg-[#00FF88]/20 text-[#00FF88] border-[#00FF88]/50'
                  : 'bg-transparent text-gray-400 border-gray-700 hover:border-gray-500'
              }`}
            >
              {skill}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}