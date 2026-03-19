'use client';

import { useState } from 'react';
import { BountyCard } from '@/components/bounties/BountyCard';
import { BountyFilters } from '@/components/bounties/BountyFilters';
import { SearchBar } from '@/components/ui/SearchBar';
import { Button } from '@/components/ui/Button';
import { PlusIcon } from '@heroicons/react/24/outline';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  category: string;
  tags: string[];
  deadline: string;
  poster: {
    name: string;
    avatar: string;
  };
  status: 'Open' | 'In Progress' | 'Completed';
  applicants: number;
}

const mockBounties: Bounty[] = [
  {
    id: '1',
    title: 'Build a React Component Library',
    description: 'Create a modern, accessible component library with TypeScript support and comprehensive documentation.',
    reward: '$2,500',
    difficulty: 'Hard',
    category: 'Frontend',
    tags: ['React', 'TypeScript', 'UI/UX'],
    deadline: '2024-02-15',
    poster: {
      name: 'John Doe',
      avatar: '/avatars/john.jpg'
    },
    status: 'Open',
    applicants: 5
  },
  {
    id: '2',
    title: 'API Integration for Mobile App',
    description: 'Integrate REST APIs with error handling and offline support for a React Native application.',
    reward: '$800',
    difficulty: 'Medium',
    category: 'Backend',
    tags: ['API', 'React Native', 'Mobile'],
    deadline: '2024-01-30',
    poster: {
      name: 'Sarah Smith',
      avatar: '/avatars/sarah.jpg'
    },
    status: 'Open',
    applicants: 12
  },
  {
    id: '3',
    title: 'Logo Design for Startup',
    description: 'Design a modern, minimalist logo for a tech startup. Must be scalable and work in various formats.',
    reward: '$300',
    difficulty: 'Easy',
    category: 'Design',
    tags: ['Logo', 'Branding', 'Graphic Design'],
    deadline: '2024-02-01',
    poster: {
      name: 'Mike Johnson',
      avatar: '/avatars/mike.jpg'
    },
    status: 'Open',
    applicants: 23
  },
  {
    id: '4',
    title: 'Database Optimization',
    description: 'Optimize PostgreSQL database queries and improve performance for high-traffic application.',
    reward: '$1,200',
    difficulty: 'Hard',
    category: 'Backend',
    tags: ['PostgreSQL', 'Performance', 'Database'],
    deadline: '2024-02-20',
    poster: {
      name: 'Emily Chen',
      avatar: '/avatars/emily.jpg'
    },
    status: 'Open',
    applicants: 8
  },
  {
    id: '5',
    title: 'Content Writing for Blog',
    description: 'Write 5 technical blog posts about web development best practices. SEO optimized content required.',
    reward: '$400',
    difficulty: 'Easy',
    category: 'Content',
    tags: ['Writing', 'SEO', 'Technical'],
    deadline: '2024-02-10',
    poster: {
      name: 'David Wilson',
      avatar: '/avatars/david.jpg'
    },
    status: 'Open',
    applicants: 15
  }
];

export default function BountiesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('newest');

  const categories = ['All', 'Frontend', 'Backend', 'Design', 'Content', 'Mobile'];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];
  const sortOptions = [
    { value: 'newest', label: 'Newest First' },
    { value: 'reward_high', label: 'Highest Reward' },
    { value: 'reward_low', label: 'Lowest Reward' },
    { value: 'deadline', label: 'Deadline Soon' }
  ];

  const filteredBounties = mockBounties.filter(bounty => {
    const matchesSearch = bounty.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bounty.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         bounty.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || bounty.category === selectedCategory;
    const matchesDifficulty = selectedDifficulty === 'All' || bounty.difficulty === selectedDifficulty;
    
    return matchesSearch && matchesCategory && matchesDifficulty;
  });

  const sortedBounties = [...filteredBounties].sort((a, b) => {
    switch (sortBy) {
      case 'reward_high':
        return parseInt(b.reward.replace(/[$,]/g, '')) - parseInt(a.reward.replace(/[$,]/g, ''));
      case 'reward_low':
        return parseInt(a.reward.replace(/[$,]/g, '')) - parseInt(b.reward.replace(/[$,]/g, ''));
      case 'deadline':
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      default:
        return parseInt(b.id) - parseInt(a.id);
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Bounty Board</h1>
            <p className="text-gray-600">Discover and work on exciting projects</p>
          </div>
          <Button className="mt-4 sm:mt-0 flex items-center gap-2">
            <PlusIcon className="h-5 w-5" />
            Post a Bounty
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <SearchBar
                placeholder="Search bounties by title, description, or tags..."
                value={searchTerm}
                onChange={setSearchTerm}
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <BountyFilters
                categories={categories}
                difficulties={difficulties}
                sortOptions={sortOptions}
                selectedCategory={selectedCategory}
                selectedDifficulty={selectedDifficulty}
                sortBy={sortBy}
                onCategoryChange={setSelectedCategory}
                onDifficultyChange={setSelectedDifficulty}
                onSortChange={setSortBy}
              />
            </div>
          </div>
        </div>

        {/* Results Summary */}
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-gray-600">
            Showing {sortedBounties.length} of {mockBounties.length} bounties
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <span>Open bounties</span>
          </div>
        </div>

        {/* Bounty Grid */}
        {sortedBounties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {sortedBounties.map((bounty) => (
              <BountyCard key={bounty.id} bounty={bounty} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <svg
                className="mx-auto h-12 w-12"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bounties found</h3>
            <p className="text-gray-600">Try adjusting your search terms or filters.</p>
          </div>
        )}
      </div>
    </div>
  );
}