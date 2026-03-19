import React from 'react';
import { Clock, Users, Award, Calendar } from 'lucide-react';

interface BountyCardProps {
  id: string;
  title: string;
  tier: 'T1' | 'T2' | 'T3' | 'T4';
  reward: number;
  timeRemaining: string;
  skills: string[];
  submissionCount: number;
  dueDate: string;
  description?: string;
  onClick?: () => void;
}

const tierColors = {
  T1: 'bg-bronze-100 text-bronze-800 border-bronze-200',
  T2: 'bg-silver-100 text-silver-800 border-silver-200',
  T3: 'bg-gold-100 text-gold-800 border-gold-200',
  T4: 'bg-diamond-100 text-diamond-800 border-diamond-200',
};

const tierLabels = {
  T1: 'Tier 1',
  T2: 'Tier 2',
  T3: 'Tier 3',
  T4: 'Tier 4',
};

export const BountyCard: React.FC<BountyCardProps> = ({
  id,
  title,
  tier,
  reward,
  timeRemaining,
  skills,
  submissionCount,
  dueDate,
  description,
  onClick,
}) => {
  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
      onClick={onClick}
    >
      {/* Header with title and tier badge */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex-1 pr-4">
          {title}
        </h3>
        <span className={`px-3 py-1 rounded-full text-xs font-medium border ${tierColors[tier]}`}>
          {tierLabels[tier]}
        </span>
      </div>

      {/* Description if provided */}
      {description && (
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {description}
        </p>
      )}

      {/* Reward */}
      <div className="flex items-center mb-4">
        <Award className="w-5 h-5 text-green-600 mr-2" />
        <span className="text-lg font-bold text-green-600">
          ${reward.toLocaleString()}
        </span>
      </div>

      {/* Time remaining and due date */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center text-sm text-gray-600">
          <Clock className="w-4 h-4 mr-1" />
          <span>{timeRemaining}</span>
        </div>
        <div className="flex items-center text-sm text-gray-600">
          <Calendar className="w-4 h-4 mr-1" />
          <span>Due {dueDate}</span>
        </div>
      </div>

      {/* Skills */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-2">
          {skills.slice(0, 3).map((skill) => (
            <span
              key={skill}
              className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-md"
            >
              {skill}
            </span>
          ))}
          {skills.length > 3 && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded-md">
              +{skills.length - 3} more
            </span>
          )}
        </div>
      </div>

      {/* Submission count */}
      <div className="flex items-center justify-between pt-4 border-t border-gray-100">
        <div className="flex items-center text-sm text-gray-600">
          <Users className="w-4 h-4 mr-1" />
          <span>{submissionCount} submissions</span>
        </div>
        <button className="text-blue-600 hover:text-blue-800 text-sm font-medium">
          View Details →
        </button>
      </div>
    </div>
  );
};