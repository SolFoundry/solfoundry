import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { GetServerSideProps } from 'next';
import {
  User,
  MapPin,
  Calendar,
  Trophy,
  DollarSign,
  TrendingUp,
  Clock,
  Award,
  GitBranch,
  Star,
  ExternalLink
} from 'lucide-react';

interface ContributorStats {
  totalEarnings: number;
  completedBounties: number;
  averageRating: number;
  successRate: number;
  totalSubmissions: number;
  currentStreak: number;
}

interface Bounty {
  id: string;
  title: string;
  reward: number;
  status: 'completed' | 'in_progress' | 'submitted';
  completedAt?: string;
  submittedAt?: string;
  rating?: number;
  tags: string[];
  difficulty: 'easy' | 'medium' | 'hard';
}

interface ContributorProfile {
  username: string;
  fullName: string;
  avatar: string;
  location?: string;
  joinedDate: string;
  bio?: string;
  skills: string[];
  socialLinks: {
    github?: string;
    twitter?: string;
    linkedin?: string;
  };
  stats: ContributorStats;
  recentBounties: Bounty[];
  earningsHistory: Array<{
    month: string;
    earnings: number;
  }>;
}

interface ContributorPageProps {
  profile: ContributorProfile;
}

const ContributorPage: React.FC<ContributorPageProps> = ({ profile }) => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'bounties' | 'earnings'>('bounties');
  const [isLoading, setIsLoading] = useState(false);

  if (router.isFallback) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusBadge = (status: Bounty['status']) => {
    const statusConfig = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[status]}`}>
        {status.replace('_', ' ').toUpperCase()}
      </span>
    );
  };

  const getDifficultyBadge = (difficulty: Bounty['difficulty']) => {
    const difficultyConfig = {
      easy: 'bg-green-100 text-green-800',
      medium: 'bg-yellow-100 text-yellow-800',
      hard: 'bg-red-100 text-red-800',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyConfig[difficulty]}`}>
        {difficulty.toUpperCase()}
      </span>
    );
  };

  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600">({rating})</span>
      </div>
    );
  };

  return (
    <>
      <Head>
        <title>{profile.fullName} - Contributor Profile</title>
        <meta name="description" content={`Profile page for contributor ${profile.fullName}`} />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* Header Section */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center">
                <img
                  src={profile.avatar}
                  alt={profile.fullName}
                  className="w-20 h-20 rounded-full object-cover"
                />
                <div className="ml-6">
                  <h1 className="text-3xl font-bold text-gray-900">{profile.fullName}</h1>
                  <p className="text-lg text-gray-600">@{profile.username}</p>
                  <div className="flex items-center mt-2 text-sm text-gray-500">
                    {profile.location && (
                      <div className="flex items-center mr-4">
                        <MapPin className="w-4 h-4 mr-1" />
                        {profile.location}
                      </div>
                    )}
                    <div className="flex items-center">
                      <Calendar className="w-4 h-4 mr-1" />
                      Joined {formatDate(profile.joinedDate)}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 lg:mt-0 flex space-x-3">
                {profile.socialLinks.github && (
                  <a
                    href={profile.socialLinks.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    <GitBranch className="w-4 h-4 mr-2" />
                    GitHub
                    <ExternalLink className="w-3 h-3 ml-1" />
                  </a>
                )}
                <button className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                  Send Message
                </button>
              </div>
            </div>

            {profile.bio && (
              <div className="mt-6">
                <p className="text-gray-700 max-w-3xl">{profile.bio}</p>
              </div>
            )}

            {profile.skills.length > 0 && (
              <div className="mt-6">
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((skill, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <DollarSign className="w-8 h-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Earnings</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(profile.stats.totalEarnings)}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Trophy className="w-8 h-8 text-yellow-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Completed Bounties</p>
                  <p className="text-2xl font-bold text-gray-900">{profile.stats.completedBounties}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <Award className="w-8 h-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Rating</p>
                  <div className="flex items-center">
                    <p className="text-2xl font-bold text-gray-900 mr-2">
                      {profile.stats.averageRating}
                    </p>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-4 h-4 ${
                            star <= profile.stats.averageRating
                              ? 'text-yellow-400 fill-current'
                              : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <TrendingUp className="w-8 h-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Success Rate</p>
                  <p className="text-2xl font-bold text-gray-900">{profile.stats.successRate}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-white rounded-lg shadow">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8 px-6">
                <button
                  onClick={() => setActiveTab('bounties')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'bounties'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Bounty History
                </button>
                <button
                  onClick={() => setActiveTab('earnings')}
                  className={`py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === 'earnings'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  Earnings Chart
                </button>
              </nav>
            </div>

            <div className="p-6">
              {activeTab === 'bounties' ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Bounty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Reward
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Difficulty
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rating
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {profile.recentBounties.map((bounty) => (
                        <tr key={bounty.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {bounty.title}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {bounty.tags.slice(0, 3).map((tag, index) => (
                                  <span
                                    key={index}
                                    className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded"
                                  >
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {formatCurrency(bounty.reward)}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(bounty.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getDifficultyBadge(bounty.difficulty)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {bounty.rating ? (
                              renderStarRating(bounty.rating)
                            ) : (
                              <span className="text-gray-400 text-sm">N/A</span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {bounty.completedAt
                              ? formatDate(bounty.completedAt)
                              : bounty.submittedAt
                              ? formatDate(bounty.submittedAt)
                              : 'In Progress'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Earnings Over Time</h3>
                  <div className="bg-gray-100 rounded-lg p-8 text-center">
                    <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">
                      Earnings chart will be displayed here using a charting library like Chart.js or Recharts
                    </p>
                    <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      {profile.earningsHistory.slice(0, 4).map((item, index) => (
                        <div key={index} className="text-center">
                          <div className="font-medium text-gray-900">{item.month}</div>
                          <div className="text-gray-600">{formatCurrency(item.earnings)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Additional Stats */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Submissions</p>
                  <p className="text-2xl font-bold text-gray-900">{profile.stats.totalSubmissions}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-400" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Current Streak</p>
                  <p className="text-2xl font-bold text-gray-900">{profile.stats.currentStreak} days</p>
                </div>
                <Award className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Member Since</p>
                  <p className="text-lg font-bold text-gray-900">{formatDate(profile.joinedDate)}</p>
                </div>
                <User className="w-8 h-8 text-blue-500" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps = async (context) => {
  const { username } = context.params!;

  // Mock data - replace with actual API call
  const mockProfile: ContributorProfile = {
    username: username as string,
    fullName: 'John Developer',
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`,
    location: 'San Francisco, CA',
    joinedDate: '2023-01-15T00:00:00.000Z',
    bio: 'Full-stack developer with 5+ years of experience in React, Node.js, and cloud technologies. Passionate about building scalable applications and contributing to open source projects.',
    skills: ['React', 'TypeScript', 'Node.js', 'Python', 'AWS', 'GraphQL', 'PostgreSQL'],
    socialLinks: {
      github: 'https://github.com/johndev',
      twitter: 'https://twitter.com/johndev',
      linkedin: 'https://linkedin.com/in/johndev',
    },
    stats: {
      totalEarnings: 12750,
      completedBounties: 23,
      averageRating: 4.8,
      successRate: 92,
      totalSubmissions: 25,
      currentStreak: 15,
    },
    recentBounties: [
      {
        id: '1',
        title: 'Implement user authentication system',
        reward: 500,
        status: 'completed',
        completedAt: '2024-01-15T00:00:00.000Z',
        rating: 5,
        tags: ['React', 'Auth', 'Security'],
        difficulty: 'medium',
      },
      {
        id: '2',
        title: 'Build responsive dashboard UI',
        reward: 750,
        status: 'completed',
        completedAt: '2024-01-10T00:00:00.000Z',
        rating: 4,
        tags: ['React', 'CSS', 'UI/UX'],
        difficulty: 'hard',
      },
      {
        id: '3',
        title: 'Fix mobile responsive issues',
        reward: 300,
        status: 'in_progress',
        tags: ['CSS', 'Mobile', 'Bug Fix'],
        difficulty: 'easy',
      },
      {
        id: '4',
        title: 'API integration for payment system',
        reward: 600,
        status: 'submitted',
        submittedAt: '2024-01-20T00:00:00.000Z',
        tags: ['API', 'Payment', 'Integration'],
        difficulty: 'medium',
      },
    ],
    earningsHistory: [
      { month: 'Jan 2024', earnings: 2100 },
      { month: 'Dec 2023', earnings: 1800 },
      { month: 'Nov 2023', earnings: 2200 },
      { month: 'Oct 2023', earnings: 1600 },
      { month: 'Sep 2023', earnings: 1900 },
      { month: 'Aug 2023', earnings: 1500 },
    ],
  };

  return {
    props: {
      profile: mockProfile,
    },
  };
};

export default ContributorPage;