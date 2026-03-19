import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  Target, 
  Clock, 
  Trophy,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface DashboardStatsProps {
  totalEarned: number;
  activeBounties: number;
  pendingPayouts: number;
  reputationRank: number;
  totalUsers?: number;
  previousTotalEarned?: number;
  previousActiveBounties?: number;
}

const DashboardStats: React.FC<DashboardStatsProps> = ({
  totalEarned,
  activeBounties,
  pendingPayouts,
  reputationRank,
  totalUsers = 1000,
  previousTotalEarned = 0,
  previousActiveBounties = 0,
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatRank = (rank: number, total: number) => {
    const percentage = ((total - rank + 1) / total * 100).toFixed(1);
    return `#${rank} (Top ${percentage}%)`;
  };

  const calculatePercentageChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous * 100);
  };

  const earningsChange = calculatePercentageChange(totalEarned, previousTotalEarned);
  const bountiesChange = calculatePercentageChange(activeBounties, previousActiveBounties);

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < 0) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return null;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-500';
    if (change < 0) return 'text-red-500';
    return 'text-gray-500';
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Total Earned
          </CardTitle>
          <DollarSign className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(totalEarned)}
          </div>
          {previousTotalEarned !== undefined && (
            <div className="flex items-center space-x-1 text-xs mt-1">
              {getTrendIcon(earningsChange)}
              <span className={getTrendColor(earningsChange)}>
                {earningsChange > 0 ? '+' : ''}{earningsChange.toFixed(1)}% from last month
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Active Bounties
          </CardTitle>
          <Target className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {activeBounties}
          </div>
          {previousActiveBounties !== undefined && (
            <div className="flex items-center space-x-1 text-xs mt-1">
              {getTrendIcon(bountiesChange)}
              <span className={getTrendColor(bountiesChange)}>
                {bountiesChange > 0 ? '+' : ''}{bountiesChange.toFixed(1)}% from last month
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Pending Payouts
          </CardTitle>
          <Clock className="h-4 w-4 text-orange-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(pendingPayouts)}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Awaiting approval
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-gray-600">
            Reputation Rank
          </CardTitle>
          <Trophy className="h-4 w-4 text-yellow-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-gray-900">
            #{reputationRank}
          </div>
          <div className="flex items-center justify-between mt-1">
            <div className="text-xs text-gray-500">
              {formatRank(reputationRank, totalUsers)}
            </div>
            <Badge variant={reputationRank <= 10 ? "default" : reputationRank <= 50 ? "secondary" : "outline"} className="text-xs">
              {reputationRank <= 10 ? "Elite" : reputationRank <= 50 ? "Pro" : "Active"}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardStats;