import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { ChevronDownIcon, ChevronUpIcon, ClockIcon, CurrencyDollarIcon, UserGroupIcon, CheckCircleIcon, XCircleIcon, EyeIcon, ChatBubbleLeftIcon, DocumentTextIcon, CalendarIcon, TagIcon } from '@heroicons/react/24/outline';
import { CheckCircleIcon as CheckCircleIconSolid } from '@heroicons/react/24/solid';

interface Bounty {
  id: string;
  title: string;
  description: string;
  reward: number;
  currency: string;
  deadline: string;
  status: 'active' | 'completed' | 'expired';
  company: {
    name: string;
    logo: string;
  };
  requirements: string[];
  tags: string[];
  submissions: number;
  views: number;
  createdAt: string;
}

interface Submission {
  id: string;
  author: {
    name: string;
    avatar: string;
  };
  title: string;
  description: string;
  submittedAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

interface Activity {
  id: string;
  type: 'submission' | 'comment' | 'update';
  author: {
    name: string;
    avatar: string;
  };
  content: string;
  timestamp: string;
}

export default function BountyDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const [bounty, setBounty] = useState<Bounty | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activeTab, setActiveTab] = useState('overview');
  const [timeLeft, setTimeLeft] = useState('');
  const [showAllRequirements, setShowAllRequirements] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (id) {
      // Mock data - replace with actual API call
      setBounty({
        id: id as string,
        title: 'Design a Modern Dashboard Interface',
        description: `We're looking for a talented designer to create a modern, intuitive dashboard interface for our SaaS platform. The dashboard should be clean, professional, and user-friendly.

The design should incorporate our brand colors and follow modern UI/UX principles. We need both desktop and mobile versions of the design.

Key features to include:
- Navigation sidebar
- Data visualization charts
- User profile section
- Settings panel
- Notification system

Deliverables should include Figma files with all components and a style guide.`,
        reward: 2500,
        currency: 'USD',
        deadline: '2024-02-15T23:59:59Z',
        status: 'active',
        company: {
          name: 'TechCorp Inc.',
          logo: '/api/placeholder/40/40'
        },
        requirements: [
          'Experience with Figma or similar design tools',
          'Portfolio showcasing dashboard designs',
          'Understanding of modern UI/UX principles',
          'Responsive design experience',
          'Brand guideline compliance',
          'Prototype creation capabilities'
        ],
        tags: ['UI/UX', 'Dashboard', 'Figma', 'SaaS', 'Responsive'],
        submissions: 12,
        views: 245,
        createdAt: '2024-01-15T10:00:00Z'
      });

      setSubmissions([
        {
          id: '1',
          author: {
            name: 'Sarah Chen',
            avatar: '/api/placeholder/32/32'
          },
          title: 'Modern SaaS Dashboard Design',
          description: 'Clean and intuitive dashboard design with dark/light mode support...',
          submittedAt: '2024-01-20T14:30:00Z',
          status: 'pending'
        },
        {
          id: '2',
          author: {
            name: 'Mike Johnson',
            avatar: '/api/placeholder/32/32'
          },
          title: 'Professional Dashboard UI',
          description: 'Minimalist dashboard design focusing on data visualization...',
          submittedAt: '2024-01-19T09:15:00Z',
          status: 'approved'
        }
      ]);

      setActivities([
        {
          id: '1',
          type: 'submission',
          author: {
            name: 'Sarah Chen',
            avatar: '/api/placeholder/32/32'
          },
          content: 'submitted a new design proposal',
          timestamp: '2024-01-20T14:30:00Z'
        },
        {
          id: '2',
          type: 'comment',
          author: {
            name: 'TechCorp Inc.',
            avatar: '/api/placeholder/32/32'
          },
          content: 'updated the requirements to include mobile design',
          timestamp: '2024-01-18T16:45:00Z'
        }
      ]);
    }
  }, [id]);

  useEffect(() => {
    if (bounty?.deadline) {
      const updateCountdown = () => {
        const now = new Date().getTime();
        const deadline = new Date(bounty.deadline).getTime();
        const distance = deadline - now;

        if (distance > 0) {
          const days = Math.floor(distance / (1000 * 60 * 60 * 24));
          const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
          const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
          
          setTimeLeft(`${days}d ${hours}h ${minutes}m`);
        } else {
          setTimeLeft('Expired');
        }
      };

      updateCountdown();
      const interval = setInterval(updateCountdown, 60000);
      return () => clearInterval(interval);
    }
  }, [bounty?.deadline]);

  if (!bounty) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading bounty details...</p>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-blue-100 text-blue-800';
      case 'expired': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getSubmissionStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600';
      case 'rejected': return 'text-red-600';
      default: return 'text-yellow-600';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-6">
            <div className="flex items-center space-x-4">
              <Link href="/bounties" className="text-gray-400 hover:text-gray-600">
                ← Back to Bounties
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                Submit Entry
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-3 lg:gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Bounty Header */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <img 
                    src={bounty.company.logo} 
                    alt={bounty.company.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">{bounty.title}</h1>
                    <p className="text-gray-600">{bounty.company.name}</p>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${getStatusColor(bounty.status)}`}>
                  {bounty.status}
                </span>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <CurrencyDollarIcon className="h-6 w-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">${bounty.reward.toLocaleString()}</p>
                  <p className="text-sm text-gray-600">Reward</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <ClockIcon className="h-6 w-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">{timeLeft}</p>
                  <p className="text-sm text-gray-600">Time Left</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <DocumentTextIcon className="h-6 w-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">{bounty.submissions}</p>
                  <p className="text-sm text-gray-600">Submissions</p>
                </div>
                <div className="text-center p-3 bg-gray-50 rounded-lg">
                  <EyeIcon className="h-6 w-6 text-gray-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-gray-900">{bounty.views}</p>
                  <p className="text-sm text-gray-600">Views</p>
                </div>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2">
                {bounty.tags.map((tag, index) => (
                  <span key={index} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-xl shadow-sm">
              <div className="border-b border-gray-200">
                <nav className="flex space-x-8 px-6">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'submissions', label: `Submissions (${submissions.length})` },
                    { id: 'activity', label: 'Activity' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-4 px-1 border-b-2 font-medium text-sm ${
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

              <div className="p-6">
                {activeTab === 'overview' && (
                  <div className="space-y-6">
                    {/* Description */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Description</h3>
                      <div className="prose prose-gray max-w-none">
                        {bounty.description.split('\n').map((paragraph, index) => (
                          <p key={index} className="mb-4 text-gray-700 leading-relaxed">
                            {paragraph}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Requirements */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-semibold">Requirements</h3>
                        {bounty.requirements.length > 3 && (
                          <button
                            onClick={() => setShowAllRequirements(!showAllRequirements)}
                            className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                          >
                            {showAllRequirements ? 'Show Less' : 'Show All'}
                            {showAllRequirements ? (
                              <ChevronUpIcon className="h-4 w-4 ml-1" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 ml-1" />
                            )}
                          </button>
                        )}
                      </div>
                      <div className="space-y-2">
                        {bounty.requirements
                          .slice(0, showAllRequirements ? undefined : 3)
                          .map((requirement, index) => (
                          <div key={index} className="flex items-start space-x-3">
                            <CheckCircleIconSolid className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                            <span className="text-gray-700">{requirement}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'submissions' && (
                  <div className="space-y-4">
                    {submissions.length === 0 ? (
                      <div className="text-center py-8">
                        <DocumentTextIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No submissions yet</p>
                        <p className="text-sm text-gray-500">Be the first to submit your work!</p>
                      </div>
                    ) : (
                      submissions.map((submission) => (
                        <div key={submission.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <img 
                                src={submission.author.avatar} 
                                alt={submission.author.name}
                                className="w-10 h-10 rounded-full"
                              />
                              <div>
                                <h4 className="font-medium text-gray-900">{submission.title}</h4>
                                <p className="text-sm text-gray-600">by {submission.author.name}</p>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm font-medium ${getSubmissionStatusColor(submission.status)}`}>
                                {submission.status === 'approved' && <CheckCircleIcon className="h-4 w-4 inline mr-1" />}
                                {submission.status === 'rejected' && <XCircleIcon className="h-4 w-4 inline mr-1" />}
                                {submission.status.charAt(0).toUpperCase() + submission.status.slice(1)}
                              </span>
                              <span className="text-sm text-gray-500">
                                {formatDateTime(submission.submittedAt)}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-700 mb-3">{submission.description}</p>
                          <button className="text-blue-600 hover:text-blue-700 text-sm font-medium">
                            View Submission →
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'activity' && (
                  <div className="space-y-4">
                    {activities.length === 0 ? (
                      <div className="text-center py-8">
                        <ChatBubbleLeftIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-600">No activity yet</p>
                      </div>
                    ) : (
                      activities.map((activity) => (
                        <div key={activity.id} className="flex items-start space-x-3">
                          <img 
                            src={activity.author.avatar} 
                            alt={activity.author.name}
                            className="w-8 h-8 rounded-full"
                          />
                          <div className="flex-1">
                            <p className="text-sm text-gray-900">
                              <span className="font-medium">{activity.author.name}</span>
                              {' '}{activity.content}
                            </p>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDateTime(activity.timestamp)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="mt-8 lg:mt-0">
            <div className="bg-white rounded-xl shadow-sm p-6 sticky top-6">
              <div className="space-y-6">
                {/* Deadline */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Deadline
                  </h3>
                  <p className="text-gray-700">{formatDate(bounty.deadline)}</p>
                  <div className="mt-2 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${Math.max(0, Math.min(100, (Date.now() - new Date(bounty.createdAt).getTime()) / (new Date(bounty.deadline).getTime() - new Date(bounty.createdAt).getTime()) * 100))}%` }}
                    ></div>
                  </div>
                </div>

                {/* Company Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-900 mb-2">Posted by</h3>
                  <div className="flex items-center space-x-3">
                    <img 
                      src={bounty.company.logo} 
                      alt={bounty.company.name}
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{bounty.company.name}</p>
                      <p className="text-sm text-gray-600">Verified Company</p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                  <button className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors font-medium">
                    Submit Your Work
                  </button>
                  <button className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                    Save Bounty
                  </button>
                  <button className="w-full bg-gray-100 text-gray-700 py-3 px-4 rounded-lg hover:bg-gray-200 transition-colors font-medium">
                    Share
                  </button>
                </div>

                {/* Quick Stats */}
                <div className="border-t border-gray-200 pt-4">
                  <div className="grid grid-cols-2 gap-4 text-center">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{bounty.submissions}</p>
                      <p className="text-xs text-gray-600">Submissions</p>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{bounty.views}</p>
                      <p className="text-xs text-gray-600">Views</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}