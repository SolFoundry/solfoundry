import React, { useState } from 'react';
import { Search, Filter, Star, Clock, DollarSign, User, MapPin, Check, X } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  title: string;
  avatar: string;
  rating: number;
  reviews: number;
  hourlyRate: number;
  location: string;
  skills: string[];
  description: string;
  availability: 'available' | 'busy' | 'offline';
  responseTime: string;
  completedJobs: number;
}

const mockAgents: Agent[] = [
  {
    id: '1',
    name: 'Alice Chen',
    title: 'Senior Full Stack Developer',
    avatar: '/api/placeholder/64/64',
    rating: 4.9,
    reviews: 127,
    hourlyRate: 85,
    location: 'San Francisco, CA',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL'],
    description: 'Experienced developer specializing in modern web applications with 5+ years in the industry.',
    availability: 'available',
    responseTime: '2 hours',
    completedJobs: 45
  },
  {
    id: '2',
    name: 'Marcus Johnson',
    title: 'UI/UX Designer',
    avatar: '/api/placeholder/64/64',
    rating: 4.8,
    reviews: 89,
    hourlyRate: 65,
    location: 'New York, NY',
    skills: ['Figma', 'Adobe XD', 'User Research', 'Prototyping'],
    description: 'Creative designer focused on user-centered design and seamless experiences.',
    availability: 'busy',
    responseTime: '4 hours',
    completedJobs: 32
  },
  {
    id: '3',
    name: 'Sarah Kim',
    title: 'Data Scientist',
    avatar: '/api/placeholder/64/64',
    rating: 5.0,
    reviews: 73,
    hourlyRate: 95,
    location: 'Seattle, WA',
    skills: ['Python', 'Machine Learning', 'TensorFlow', 'SQL'],
    description: 'ML engineer with expertise in predictive analytics and data visualization.',
    availability: 'available',
    responseTime: '1 hour',
    completedJobs: 28
  },
  {
    id: '4',
    name: 'David Rodriguez',
    title: 'Mobile App Developer',
    avatar: '/api/placeholder/64/64',
    rating: 4.7,
    reviews: 104,
    hourlyRate: 75,
    location: 'Austin, TX',
    skills: ['React Native', 'Swift', 'Kotlin', 'Firebase'],
    description: 'Cross-platform mobile developer with a focus on performance and user experience.',
    availability: 'available',
    responseTime: '3 hours',
    completedJobs: 38
  },
  {
    id: '5',
    name: 'Emma Thompson',
    title: 'DevOps Engineer',
    avatar: '/api/placeholder/64/64',
    rating: 4.9,
    reviews: 61,
    hourlyRate: 90,
    location: 'Denver, CO',
    skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'],
    description: 'Infrastructure specialist helping teams scale and deploy applications efficiently.',
    availability: 'offline',
    responseTime: '6 hours',
    completedJobs: 22
  },
  {
    id: '6',
    name: 'James Wilson',
    title: 'Blockchain Developer',
    avatar: '/api/placeholder/64/64',
    rating: 4.6,
    reviews: 43,
    hourlyRate: 110,
    location: 'Miami, FL',
    skills: ['Solidity', 'Web3', 'Smart Contracts', 'DeFi'],
    description: 'Blockchain expert specializing in DeFi protocols and smart contract development.',
    availability: 'available',
    responseTime: '2 hours',
    completedJobs: 15
  }
];

const AgentMarketplace: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSkill, setSelectedSkill] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState('');
  const [rateRange, setRateRange] = useState([0, 200]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showHireModal, setShowHireModal] = useState(false);

  const skills = Array.from(new Set(mockAgents.flatMap(agent => agent.skills)));

  const filteredAgents = mockAgents.filter(agent => {
    const matchesSearch = agent.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         agent.skills.some(skill => skill.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesSkill = !selectedSkill || agent.skills.includes(selectedSkill);
    const matchesAvailability = !availabilityFilter || agent.availability === availabilityFilter;
    const matchesRate = agent.hourlyRate >= rateRange[0] && agent.hourlyRate <= rateRange[1];

    return matchesSearch && matchesSkill && matchesAvailability && matchesRate;
  });

  const getAvailabilityColor = (availability: string) => {
    switch (availability) {
      case 'available': return 'bg-green-500';
      case 'busy': return 'bg-yellow-500';
      case 'offline': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const handleHireAgent = (agent: Agent) => {
    setSelectedAgent(agent);
    setShowHireModal(true);
  };

  const HireModal = () => {
    if (!selectedAgent) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Hire {selectedAgent.name}</h3>
              <button
                onClick={() => setShowHireModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <img
                src={selectedAgent.avatar}
                alt={selectedAgent.name}
                className="w-16 h-16 rounded-full"
              />
              <div>
                <h4 className="font-semibold">{selectedAgent.name}</h4>
                <p className="text-gray-600">{selectedAgent.title}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                  <span className="text-sm">{selectedAgent.rating}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-sm text-gray-600">${selectedAgent.hourlyRate}/hr</span>
                </div>
              </div>
            </div>

            <form className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Title
                </label>
                <input
                  type="text"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter project title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Project Description
                </label>
                <textarea
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Describe your project requirements..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Budget ($)
                  </label>
                  <input
                    type="number"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Timeline
                  </label>
                  <select className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select timeline</option>
                    <option value="1-week">1 Week</option>
                    <option value="2-weeks">2 Weeks</option>
                    <option value="1-month">1 Month</option>
                    <option value="3-months">3 Months</option>
                    <option value="ongoing">Ongoing</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowHireModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Send Proposal
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Agent Marketplace</h1>
          <p className="text-gray-600">Find and hire top talent for your projects</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search agents by name, skills, or expertise..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Skills</label>
                <select
                  value={selectedSkill}
                  onChange={(e) => setSelectedSkill(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All Skills</option>
                  {skills.map(skill => (
                    <option key={skill} value={skill}>{skill}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
                <select
                  value={availabilityFilter}
                  onChange={(e) => setAvailabilityFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">All</option>
                  <option value="available">Available</option>
                  <option value="busy">Busy</option>
                  <option value="offline">Offline</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rate Range: ${rateRange[0]} - ${rateRange[1]}
                </label>
                <input
                  type="range"
                  min="0"
                  max="200"
                  value={rateRange[1]}
                  onChange={(e) => setRateRange([rateRange[0], parseInt(e.target.value)])}
                  className="w-full"
                />
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="mb-6">
          <p className="text-gray-600">{filteredAgents.length} agents found</p>
        </div>

        {/* Agent Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAgents.map((agent) => (
            <div key={agent.id} className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="relative">
                    <img
                      src={agent.avatar}
                      alt={agent.name}
                      className="w-16 h-16 rounded-full"
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-5 h-5 ${getAvailabilityColor(agent.availability)} rounded-full border-2 border-white`}
                    />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{agent.name}</h3>
                    <p className="text-gray-600 text-sm">{agent.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      <span className="text-sm font-medium">{agent.rating}</span>
                      <span className="text-gray-400 text-sm">({agent.reviews})</span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-600 text-sm mb-4 line-clamp-2">{agent.description}</p>

                <div className="flex flex-wrap gap-2 mb-4">
                  {agent.skills.slice(0, 3).map((skill) => (
                    <span
                      key={skill}
                      className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
                    >
                      {skill}
                    </span>
                  ))}
                  {agent.skills.length > 3 && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                      +{agent.skills.length - 3} more
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <MapPin className="w-4 h-4" />
                    <span>{agent.location}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    <span>{agent.responseTime}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <DollarSign className="w-4 h-4 text-green-600" />
                    <span className="font-semibold">${agent.hourlyRate}/hr</span>
                  </div>
                  <button
                    onClick={() => handleHireAgent(agent)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Hire Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAgents.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <User className="w-16 h-16 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No agents found</h3>
            <p className="text-gray-600">Try adjusting your search criteria or filters</p>
          </div>
        )}
      </div>

      {showHireModal && <HireModal />}
    </div>
  );
};

export default AgentMarketplace;