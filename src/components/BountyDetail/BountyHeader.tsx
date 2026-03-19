import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Coins, Tag, Trophy, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface BountyHeaderProps {
  title: string;
  tier: 'T1' | 'T2' | 'T3';
  reward: number;
  category: string;
  status: 'open' | 'in_progress' | 'completed' | 'expired';
  currency?: string;
}

const tierConfig = {
  T1: { label: 'Tier 1', color: 'bg-green-100 text-green-800 border-green-200' },
  T2: { label: 'Tier 2', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  T3: { label: 'Tier 3', color: 'bg-purple-100 text-purple-800 border-purple-200' }
};

const statusConfig = {
  open: { 
    label: 'Open', 
    color: 'bg-green-100 text-green-800 border-green-200',
    icon: AlertCircle
  },
  in_progress: { 
    label: 'In Progress', 
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    icon: Clock
  },
  completed: { 
    label: 'Completed', 
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    icon: CheckCircle
  },
  expired: { 
    label: 'Expired', 
    color: 'bg-red-100 text-red-800 border-red-200',
    icon: AlertCircle
  }
};

export function BountyHeader({ 
  title, 
  tier, 
  reward, 
  category, 
  status, 
  currency = 'USDC' 
}: BountyHeaderProps) {
  const StatusIcon = statusConfig[status].icon;

  return (
    <Card className="mb-6">
      <CardContent className="p-6">
        <div className="space-y-4">
          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 leading-tight">
            {title}
          </h1>
          
          {/* Badges Row */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Tier Badge */}
            <Badge variant="outline" className={tierConfig[tier].color}>
              <Trophy className="w-3 h-3 mr-1" />
              {tierConfig[tier].label}
            </Badge>
            
            {/* Category Badge */}
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              <Tag className="w-3 h-3 mr-1" />
              {category}
            </Badge>
            
            {/* Status Badge */}
            <Badge variant="outline" className={statusConfig[status].color}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {statusConfig[status].label}
            </Badge>
          </div>
          
          {/* Reward Amount */}
          <div className="flex items-center gap-2">
            <Coins className="w-6 h-6 text-green-600" />
            <span className="text-2xl font-bold text-green-600">
              {reward.toLocaleString()} {currency}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}