import React, { useState } from 'react';
import { X, Star, TrendingUp, Award, Clock, DollarSign } from 'lucide-react';

interface Agent {
  id: string;
  name: string;
  avatar: string;
  rating: number;
  reviewCount: number;
  specialty: string;
  hourlyRate: number;
  completedJobs: number;
  successRate: number;
  responseTime: string;
  description: string;
  capabilities: string[];
  recentPerformance: Array<{
    date: string;
    rating: number;
    jobs: number;
  }>;
  reviews: Array<{
    id: string;
    client: string;
    rating: number;
    comment: string;
    date: string;
  }>;
}

interface AgentModalProps {
  agent: Agent;
  isOpen: boolean;
  onClose: () => void;
  onHire: (agentId: string) => void;
}

export default function AgentModal({ agent, isOpen, onClose, onHire }: AgentModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'performance' | 'reviews'>('overview');

  if (!isOpen) return null;

  const handleHire = () => {
    onHire(agent.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <img
              src={agent.avatar}
              alt={agent.name}
              className="w-16 h-16 rounded-full object-cover"
            />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{agent.name}</h2>
              <p className="text-gray-600">{agent.specialty}</p>
              <div className="flex items-center space-x-4 mt-2">
                <div className="flex items-center space-x-1">
                  <Star className="w-5 h-5 text-yellow-400 fill-current" />
                  <span className="font-medium">{agent.rating}</span>
                  <span className="text-gray-600">({agent.reviewCount} reviews)</span>
                </div>
                <div className="flex items-center space-x-1 text-green-600">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-medium">${agent.hourlyRate}/hr</span>
                </div>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'overview', label: 'Overview' },
              { id: 'performance', label: 'Performance' },
              { id: 'reviews', label: 'Reviews' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-blue-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 text-sm font-medium">Completed Jobs</p>
                      <p className="text-2xl font-bold text-blue-700">{agent.completedJobs}</p>
                    </div>
                    <Award className="w-8 h-8 text-blue-600" />
                  </div>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 text-sm font-medium">Success Rate</p>
                      <p className="text-2xl font-bold text-green-700">{agent.successRate}%</p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-green-600" />
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-orange-600 text-sm font-medium">Response Time</p>
                      <p className="text-2xl font-bold text-orange-700">{agent.responseTime}</p>
                    </div>
                    <Clock className="w-8 h-8 text-orange-600" />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <h3 className="text-lg font-semibold mb-3">About</h3>
                <p className="text-gray-600 leading-relaxed">{agent.description}</p>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Capabilities</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {agent.capabilities.map((capability, index) => (
                    <div
                      key={index}
                      className="bg-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700"
                    >
                      {capability}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold">Performance Charts</h3>
              
              {/* Performance Chart Placeholder */}
              <div className="bg-gray-50 rounded-lg p-6 h-64 flex items-center justify-center">
                <div className="text-center">
                  <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-500">Performance charts would be rendered here</p>
                  <p className="text-sm text-gray-400">Using a charting library like Chart.js or Recharts</p>
                </div>
              </div>

              {/* Recent Performance Data */}
              <div>
                <h4 className="font-medium mb-3">Recent Performance</h4>
                <div className="space-y-2">
                  {agent.recentPerformance.map((performance, index) => (
                    <div key={index} className="flex items-center justify-between py-2 border-b border-gray-100">
                      <span className="text-sm text-gray-600">{performance.date}</span>
                      <div className="flex items-center space-x-4">
                        <span className="text-sm">
                          <span className="font-medium">{performance.jobs}</span> jobs
                        </span>
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm font-medium">{performance.rating}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Client Reviews</h3>
              <div className="space-y-4">
                {agent.reviews.map((review) => (
                  <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium">{review.client}</span>
                        <div className="flex items-center">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-4 h-4 ${
                                i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">{review.date}</span>
                    </div>
                    <p className="text-gray-600">{review.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-green-600">
            <DollarSign className="w-5 h-5" />
            <span className="text-xl font-bold">${agent.hourlyRate}/hour</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleHire}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Hire Agent
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}