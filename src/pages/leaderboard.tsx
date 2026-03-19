import React, { useState, useEffect } from 'react';
import { Trophy, Medal, Award, Crown, Filter, Search, TrendingUp, TrendingDown } from 'lucide-react';

interface LeaderboardEntry {
  id: string;
  username: string;
  avatar: string;
  score: number;
  rank: number;
  change: number;
  streak: number;
  lastActive: string;
  badges: string[];
}

const mockLeaderboardData: LeaderboardEntry[] = [
  {
    id: '1',
    username: 'CodeMaster99',
    avatar: '/avatars/user1.jpg',
    score: 15420,
    rank: 1,
    change: 2,
    streak: 45,
    lastActive: '2 hours ago',
    badges: ['streak', 'top_contributor', 'expert']
  },
  {
    id: '2',
    username: 'DevNinja',
    avatar: '/avatars/user2.jpg',
    score: 14890,
    rank: 2,
    change: -1,
    streak: 32,
    lastActive: '5 hours ago',
    badges: ['streak', 'mentor']
  },
  {
    id: '3',
    username: 'AlgoQueen',
    avatar: '/avatars/user3.jpg',
    score: 14250,
    rank: 3,
    change: 1,
    streak: 28,
    lastActive: '1 hour ago',
    badges: ['algorithm_master', 'top_contributor']
  },
  {
    id: '4',
    username: 'ByteBuster',
    avatar: '/avatars/user4.jpg',
    score: 13780,
    rank: 4,
    change: 0,
    streak: 21,
    lastActive: '3 hours ago',
    badges: ['streak', 'problem_solver']
  },
  {
    id: '5',
    username: 'StackOverflow',
    avatar: '/avatars/user5.jpg',
    score: 13420,
    rank: 5,
    change: 3,
    streak: 15,
    lastActive: '4 hours ago',
    badges: ['helper', 'community']
  },
  {
    id: '6',
    username: 'RecursionRocket',
    avatar: '/avatars/user6.jpg',
    score: 12980,
    rank: 6,
    change: -2,
    streak: 19,
    lastActive: '6 hours ago',
    badges: ['algorithm_master']
  },
  {
    id: '7',
    username: 'FunctionFury',
    avatar: '/avatars/user7.jpg',
    score: 12650,
    rank: 7,
    change: 1,
    streak: 12,
    lastActive: '1 day ago',
    badges: ['streak', 'consistent']
  },
  {
    id: '8',
    username: 'LoopLegend',
    avatar: '/avatars/user8.jpg',
    score: 12320,
    rank: 8,
    change: -1,
    streak: 8,
    lastActive: '2 days ago',
    badges: ['problem_solver']
  }
];

const Leaderboard: React.FC = () => {
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [filteredData, setFilteredData] = useState<LeaderboardEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('score');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setLeaderboardData(mockLeaderboardData);
      setFilteredData(mockLeaderboardData);
      setIsLoading(false);
    }, 1000);
  }, []);

  useEffect(() => {
    let filtered = leaderboardData.filter(entry =>
      entry.username.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (filterBy !== 'all') {
      filtered = filtered.filter(entry => entry.badges.includes(filterBy));
    }

    // Sort data
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'score':
          return b.score - a.score;
        case 'streak':
          return b.streak - a.streak;
        case 'rank':
          return a.rank - b.rank;
        default:
          return 0;
      }
    });

    setFilteredData(filtered);
  }, [leaderboardData, searchTerm, filterBy, sortBy]);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-500" />;
      case 2:
        return <Medal className="w-6 h-6 text-gray-400" />;
      case 3:
        return <Award className="w-6 h-6 text-amber-600" />;
      default:
        return <span className="text-lg font-bold text-gray-600">#{rank}</span>;
    }
  };

  const getChangeIcon = (change: number) => {
    if (change > 0) {
      return <TrendingUp className="w-4 h-4 text-green-500" />;
    } else if (change < 0) {
      return <TrendingDown className="w-4 h-4 text-red-500" />;
    }
    return <div className="w-4 h-4" />;
  };

  const TopThreeCard: React.FC<{ entry: LeaderboardEntry; position: number }> = ({ entry, position }) => {
    const cardStyles = {
      1: 'bg-gradient-to-br from-yellow-400 to-yellow-600 transform scale-110 z-10',
      2: 'bg-gradient-to-br from-gray-300 to-gray-500 transform scale-105',
      3: 'bg-gradient-to-br from-amber-400 to-amber-600 transform scale-105'
    };

    return (
      <div className={`${cardStyles[position as keyof typeof cardStyles]} text-white rounded-2xl p-6 relative shadow-lg`}>
        <div className="text-center">
          <div className="relative mb-4">
            <div className="w-20 h-20 mx-auto bg-white rounded-full p-1 shadow-lg">
              <img
                src={entry.avatar}
                alt={entry.username}
                className="w-full h-full rounded-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${entry.username}&background=6366f1&color=fff`;
                }}
              />
            </div>
            <div className="absolute -top-2 -right-2">
              {getRankIcon(entry.rank)}
            </div>
          </div>
          <h3 className="font-bold text-lg mb-1">{entry.username}</h3>
          <p className="text-sm opacity-90 mb-2">{entry.score.toLocaleString()} points</p>
          <div className="flex justify-center space-x-2">
            {entry.badges.slice(0, 2).map((badge, index) => (
              <span key={index} className="bg-white bg-opacity-20 text-xs px-2 py-1 rounded-full">
                {badge.replace('_', ' ')}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Loading leaderboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4 flex items-center justify-center">
            <Trophy className="w-10 h-10 text-yellow-500 mr-3" />
            Leaderboard
          </h1>
          <p className="text-xl text-gray-600">Compete with the best developers worldwide</p>
        </div>

        {/* Top 3 Cards */}
        <div className="mb-12">
          <div className="flex flex-col lg:flex-row items-end justify-center space-y-4 lg:space-y-0 lg:space-x-8">
            {/* Second Place */}
            <div className="order-2 lg:order-1">
              <TopThreeCard entry={filteredData[1]} position={2} />
            </div>
            {/* First Place */}
            <div className="order-1 lg:order-2">
              <TopThreeCard entry={filteredData[0]} position={1} />
            </div>
            {/* Third Place */}
            <div className="order-3">
              <TopThreeCard entry={filteredData[2]} position={3} />
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-8">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search users..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <select
                className="pl-10 pr-8 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
                value={filterBy}
                onChange={(e) => setFilterBy(e.target.value)}
              >
                <option value="all">All Users</option>
                <option value="streak">Streak Masters</option>
                <option value="top_contributor">Top Contributors</option>
                <option value="expert">Experts</option>
                <option value="mentor">Mentors</option>
              </select>
            </div>

            {/* Sort Dropdown */}
            <select
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="score">Sort by Score</option>
              <option value="streak">Sort by Streak</option>
              <option value="rank">Sort by Rank</option>
            </select>
          </div>
        </div>

        {/* Rankings Table */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Streak
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">
                    Change
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden md:table-cell">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden lg:table-cell">
                    Badges
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredData.map((entry, index) => (
                  <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getRankIcon(entry.rank)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <img
                          src={entry.avatar}
                          alt={entry.username}
                          className="w-10 h-10 rounded-full mr-3"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${entry.username}&background=6366f1&color=fff`;
                          }}
                        />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{entry.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-semibold text-gray-900">
                        {entry.score.toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <span className="text-sm text-gray-900">{entry.streak}</span>
                        <span className="text-xs text-gray-500 ml-1">days</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                      <div className="flex items-center">
                        {getChangeIcon(entry.change)}
                        <span className={`text-sm ml-1 ${
                          entry.change > 0 ? 'text-green-600' : 
                          entry.change < 0 ? 'text-red-600' : 'text-gray-500'
                        }`}>
                          {entry.change > 0 ? `+${entry.change}` : entry.change || '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                      {entry.lastActive}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {entry.badges.slice(0, 3).map((badge, badgeIndex) => (
                          <span
                            key={badgeIndex}
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                          >
                            {badge.replace('_', ' ')}
                          </span>
                        ))}
                        {entry.badges.length > 3 && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            +{entry.badges.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Load More Button */}
        <div className="text-center mt-8">
          <button className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-6 rounded-lg transition-colors">
            Load More
          </button>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;