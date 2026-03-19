import React, { useState, useEffect } from 'react';
import { Search, Filter, Star, Clock, DollarSign, Users, Briefcase, Award } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  title: string;
  description: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  skills: string[];
  completedJobs: number;
  availability: 'available' | 'busy' | 'offline';
  category: string;
  verified: boolean;
  responseTime: string;
}

const MOCK_AGENTS: Agent[] = [
  {
    id: '1',
    name: 'Alex Chen',
    avatar: '/avatars/alex.jpg',
    title: 'Full-Stack Developer',
    description: 'Experienced full-stack developer specializing in React, Node.js, and cloud architecture.',
    rating: 4.9,
    reviews: 127,
    hourlyRate: 85,
    skills: ['React', 'Node.js', 'TypeScript', 'AWS'],
    completedJobs: 89,
    availability: 'available',
    category: 'Development',
    verified: true,
    responseTime: '< 1 hour'
  },
  {
    id: '2',
    name: 'Sarah Johnson',
    avatar: '/avatars/sarah.jpg',
    title: 'UI/UX Designer',
    description: 'Creative designer with 8+ years of experience in user-centered design and prototyping.',
    rating: 4.8,
    reviews: 94,
    hourlyRate: 75,
    skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
    completedJobs: 67,
    availability: 'available',
    category: 'Design',
    verified: true,
    responseTime: '< 2 hours'
  },
  {
    id: '3',
    name: 'Mike Rodriguez',
    avatar: '/avatars/mike.jpg',
    title: 'DevOps Engineer',
    description: 'Infrastructure specialist with expertise in containerization and CI/CD pipelines.',
    rating: 4.9,
    reviews: 156,
    hourlyRate: 95,
    skills: ['Docker', 'Kubernetes', 'Jenkins', 'Terraform'],
    completedJobs: 112,
    availability: 'busy',
    category: 'DevOps',
    verified: true,
    responseTime: '< 3 hours'
  },
  {
    id: '4',
    name: 'Emily Davis',
    avatar: '/avatars/emily.jpg',
    title: 'Marketing Specialist',
    description: 'Digital marketing expert focused on growth hacking and social media strategies.',
    rating: 4.7,
    reviews: 83,
    hourlyRate: 65,
    skills: ['SEO', 'Social Media', 'Content Marketing', 'Analytics'],
    completedJobs: 45,
    availability: 'available',
    category: 'Marketing',
    verified: false,
    responseTime: '< 4 hours'
  },
  {
    id: '5',
    name: 'David Kim',
    avatar: '/avatars/david.jpg',
    title: 'Data Scientist',
    description: 'ML engineer with expertise in Python, TensorFlow, and statistical analysis.',
    rating: 4.9,
    reviews: 201,
    hourlyRate: 110,
    skills: ['Python', 'TensorFlow', 'SQL', 'Statistics'],
    completedJobs: 134,
    availability: 'available',
    category: 'Data Science',
    verified: true,
    responseTime: '< 2 hours'
  },
  {
    id: '6',
    name: 'Lisa Wang',
    avatar: '/avatars/lisa.jpg',
    title: 'Mobile Developer',
    description: 'iOS and Android developer with 6+ years building consumer and enterprise apps.',
    rating: 4.8,
    reviews: 118,
    hourlyRate: 80,
    skills: ['React Native', 'Swift', 'Kotlin', 'Flutter'],
    completedJobs: 76,
    availability: 'offline',
    category: 'Mobile',
    verified: true,
    responseTime: '< 5 hours'
  }
];

const CATEGORIES = ['All', 'Development', 'Design', 'DevOps', 'Marketing', 'Data Science', 'Mobile'];
const AVAILABILITY_FILTERS = ['All', 'Available', 'Busy', 'Offline'];
const RATE_RANGES = ['All', '$0-50', '$51-75', '$76-100', '$100+'];

export default function MarketplacePage() {
  const [agents, setAgents] = useState<Agent[]>(MOCK_AGENTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedAvailability, setSelectedAvailability] = useState('All');
  const [selectedRateRange, setSelectedRateRange] = useState('All');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);

  useEffect(() => {
    let filteredAgents = MOCK_AGENTS;

    // Search filter
    if (searchQuery) {
      filteredAgents = filteredAgents.filter(agent =>
        agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        agent.skills.some(skill => skill.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Category filter
    if (selectedCategory !== 'All') {
      filteredAgents = filteredAgents.filter(agent => agent.category === selectedCategory);
    }

    // Availability filter
    if (selectedAvailability !== 'All') {
      filteredAgents = filteredAgents.filter(agent => 
        agent.availability === selectedAvailability.toLowerCase()
      );
    }

    // Rate range filter
    if (selectedRateRange !== 'All') {
      filteredAgents = filteredAgents.filter(agent => {
        const rate = agent.hourlyRate;
        switch (selectedRateRange) {
          case '$0-50': return rate <= 50;
          case '$51-75': return rate > 50 && rate <= 75;
          case '$76-100': return rate > 75 && rate <= 100;
          case '$100+': return rate > 100;
          default: return true;
        }
      });
    }

    // Sorting
    filteredAgents.sort((a, b) => {
      switch (sortBy) {
        case 'rating':
          return b.rating - a.rating;
        case 'rate_low':
          return a.hourlyRate - b.hourlyRate;
        case 'rate_high':
          return b.hourlyRate - a.hourlyRate;
        case 'reviews':
          return b.reviews - a.reviews;
        case 'jobs':
          return b.completedJobs - a.completedJobs;
        default:
          return 0;
      }
    });

    setAgents(filteredAgents);
  }, [searchQuery, selectedCategory, selectedAvailability, selectedRateRange, sortBy]);

  const handleHireAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowHireModal(true);
  };

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'text-green-600 bg-green-100';
      case 'busy': return 'text-yellow-600 bg-yellow-100';
      case 'offline': return 'text-gray-600 bg-gray-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getAvailabilityText = (availability: string) => {
    switch (availability) {
      case 'available': return 'Available';
      case 'busy': return 'Busy';
      case 'offline': return 'Offline';
      default: return 'Unknown';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Agent Marketplace</h1>
              <p className="text-gray-600 mt-1">Find and hire the perfect agent for your project</p>
            </div>
            <div className="text-sm text-gray-600">
              {agents.length} agents found
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mt-6 flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search agents, skills, or categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>

            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="rating">Sort by Rating</option>
              <option value="rate_low">Price: Low to High</option>
              <option value="rate_high">Price: High to Low</option>
              <option value="reviews">Most Reviewed</option>
              <option value="jobs">Most Jobs</option>
            </select>
          </div>

          {/* Filters Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {CATEGORIES.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={selectedAvailability}
                  onChange={(e) => setSelectedAvailability(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {AVAILABILITY_FILTERS.map(availability => (
                    <option key={availability} value={availability}>{availability}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Hourly Rate</label>
                <select
                  value={selectedRateRange}
                  onChange={(e) => setSelectedRateRange(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  {RATE_RANGES.map(range => (
                    <option key={range} value={range}>{range}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Agent Grid */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {agents.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600">Try adjusting your search or filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <div key={agent.id} className="bg-white rounded-lg shadow-sm border hover:shadow-md transition-shadow">
                <div className="p-6">
                  {/* Agent Header */}
                  <div className="flex items-start gap-4 mb-4">
                    <div className="relative">
                      <img
                        src={agent.avatar}
                        alt={agent.name}
                        className="w-16 h-16 rounded-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(agent.name)}&background=3b82f6&color=ffffff`;
                        }}
                      />
                      {agent.verified && (
                        <div className="absolute -top-1 -right-1 bg-blue-500 rounded-full p-1">
                          <Award className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{agent.title}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <div className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span>{agent.rating}</span>
                          <span>({agent.reviews})</span>
                        </div>
                        <span className={`px-2 py-1 rounded-full font-medium ${getAvailabilityColor(agent.availability)}`}>
                          {getAvailabilityText(agent.availability)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">{agent.description}</p>

                  {/* Skills */}
                  <div className="flex flex-wrap gap-1 mb-4">
                    {agent.skills.slice(0, 3).map(skill => (
                      <span key={skill} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                        {skill}
                      </span>
                    ))}
                    {agent.skills.length > 3 && (
                      <span className="px-2 py-1 bg-gray-50 text-gray-600 text-xs rounded-md">
                        +{agent.skills.length - 3} more
                      </span>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-xs text-gray-600 mb-4">
                    <div className="flex items-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      <span>{agent.completedJobs} jobs</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      <span>${agent.hourlyRate}/hr</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{agent.responseTime}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleHireAgent(agent)}
                    disabled={agent.availability === 'offline'}
                    className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    {agent.availability === 'offline' ? 'Currently Offline' : 'Hire Agent'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hire Modal */}
      {showHireModal && selectedAgent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold mb-4">Hire {selectedAgent.name}</h3>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Title</label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter project title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Describe your project requirements"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Budget</label>
                <input
                  type="number"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter your budget"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timeline</label>
                <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                  <option>ASAP</option>
                  <option>Within a week</option>
                  <option>Within a month</option>
                  <option>Flexible</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowHireModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowHireModal(false);
                  setSelectedAgent(null);
                  // Handle hire logic here
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Send Proposal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}