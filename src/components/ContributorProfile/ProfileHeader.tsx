import React from 'react';
import { User, Calendar, ExternalLink } from 'lucide-react';

interface ProfileHeaderProps {
  githubUsername: string;
  avatarUrl: string;
  walletAddress: string;
  joinDate: string;
  reputation: number;
  totalEarnings?: number;
}

const getReputationBadge = (reputation: number) => {
  if (reputation >= 1000) return { label: 'Expert', color: 'bg-purple-500' };
  if (reputation >= 500) return { label: 'Advanced', color: 'bg-blue-500' };
  if (reputation >= 100) return { label: 'Intermediate', color: 'bg-green-500' };
  if (reputation >= 50) return { label: 'Beginner', color: 'bg-yellow-500' };
  return { label: 'Newcomer', color: 'bg-gray-500' };
};

const ProfileHeader: React.FC<ProfileHeaderProps> = ({
  githubUsername,
  avatarUrl,
  walletAddress,
  joinDate,
  reputation,
  totalEarnings
}) => {
  const reputationBadge = getReputationBadge(reputation);
  const shortWalletAddress = `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  const formattedJoinDate = new Date(joinDate).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <img
              src={avatarUrl}
              alt={`${githubUsername}'s avatar`}
              className="w-20 h-20 rounded-full border-4 border-gray-100"
            />
            <div className={`absolute -bottom-2 -right-2 px-2 py-1 rounded-full text-xs font-medium text-white ${reputationBadge.color}`}>
              {reputationBadge.label}
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-bold text-gray-900">{githubUsername}</h1>
              <a
                href={`https://github.com/${githubUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-gray-600">
              <div className="flex items-center space-x-1">
                <User className="w-4 h-4" />
                <span className="font-mono">{shortWalletAddress}</span>
              </div>
              
              <div className="flex items-center space-x-1">
                <Calendar className="w-4 h-4" />
                <span>Joined {formattedJoinDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-right space-y-2">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-sm text-blue-600 font-medium">Reputation Score</div>
            <div className="text-2xl font-bold text-blue-700">{reputation.toLocaleString()}</div>
          </div>
          
          {totalEarnings && (
            <div className="bg-green-50 rounded-lg p-3">
              <div className="text-sm text-green-600 font-medium">Total Earnings</div>
              <div className="text-2xl font-bold text-green-700">${totalEarnings.toLocaleString()}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProfileHeader;