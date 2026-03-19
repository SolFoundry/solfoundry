import React from 'react';
import { FiDollarSign, FiCheckCircle, FiTrendingUp, FiStar, FiZap } from 'react-icons/fi';

interface Stat {
  id: string;
  label: string;
  value: string;
  icon: React.ReactNode;
  color: string;
}

interface StatsCardsProps {
  stats: {
    totalEarned: number;
    bountiesCompleted: number;
    successRate: number;
    avgReviewScore: number;
    currentStreak: number;
  };
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const statsData: Stat[] = [
    {
      id: 'totalEarned',
      label: 'Total Earned',
      value: formatCurrency(stats.totalEarned),
      icon: <FiDollarSign className="w-6 h-6" />,
      color: 'text-green-600',
    },
    {
      id: 'bountiesCompleted',
      label: 'Bounties Completed',
      value: stats.bountiesCompleted.toString(),
      icon: <FiCheckCircle className="w-6 h-6" />,
      color: 'text-blue-600',
    },
    {
      id: 'successRate',
      label: 'Success Rate',
      value: `${stats.successRate}%`,
      icon: <FiTrendingUp className="w-6 h-6" />,
      color: 'text-purple-600',
    },
    {
      id: 'avgReviewScore',
      label: 'Avg Review Score',
      value: `${stats.avgReviewScore}/5`,
      icon: <FiStar className="w-6 h-6" />,
      color: 'text-yellow-600',
    },
    {
      id: 'currentStreak',
      label: 'Current Streak',
      value: `${stats.currentStreak} days`,
      icon: <FiZap className="w-6 h-6" />,
      color: 'text-orange-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6 mb-8">
      {statsData.map((stat) => (
        <div
          key={stat.id}
          className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-600 mb-1">
                {stat.label}
              </p>
              <p className="text-2xl font-bold text-gray-900">
                {stat.value}
              </p>
            </div>
            <div className={`${stat.color} bg-gray-50 p-3 rounded-lg`}>
              {stat.icon}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsCards;