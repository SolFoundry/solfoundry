import React from 'react';
import { Agent } from '../types/agent';

interface AgentCardProps {
  agent: Agent;
  onClick?: () => void;
}

export const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'busy':
        return 'bg-yellow-100 text-yellow-800';
      case 'offline':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getSuccessRateColor = (rate: number) => {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div
      className="bg-white rounded-lg shadow-md border border-gray-200 p-6 hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <img
              src={agent.avatar}
              alt={agent.name}
              className="w-12 h-12 rounded-full object-cover"
            />
            <div
              className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                agent.status === 'active'
                  ? 'bg-green-500'
                  : agent.status === 'busy'
                  ? 'bg-yellow-500'
                  : 'bg-gray-400'
              }`}
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{agent.name}</h3>
            <p className="text-sm text-gray-600">{agent.role}</p>
          </div>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(
            agent.status
          )}`}
        >
          {agent.status}
        </span>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Success Rate</span>
          <span
            className={`text-sm font-semibold ${getSuccessRateColor(
              agent.successRate
            )}`}
          >
            {agent.successRate}%
          </span>
        </div>

        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full ${
              agent.successRate >= 90
                ? 'bg-green-500'
                : agent.successRate >= 70
                ? 'bg-yellow-500'
                : 'bg-red-500'
            }`}
            style={{ width: `${agent.successRate}%` }}
          />
        </div>

        {agent.specialties && agent.specialties.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {agent.specialties.slice(0, 3).map((specialty, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
              >
                {specialty}
              </span>
            ))}
            {agent.specialties.length > 3 && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
                +{agent.specialties.length - 3} more
              </span>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-sm text-gray-600 pt-2 border-t">
          <span>Tasks Completed</span>
          <span className="font-medium">{agent.tasksCompleted || 0}</span>
        </div>
      </div>
    </div>
  );
};