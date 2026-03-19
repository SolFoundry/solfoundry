import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, AlertCircle, GitBranch, Eye, MessageSquare, Play, Pause, RefreshCw } from 'lucide-react';

interface PRStatus {
  id: string;
  title: string;
  branch: string;
  author: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  url: string;
  checks: Check[];
  reviews: Review[];
  comments: number;
}

interface Check {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'success' | 'failed' | 'cancelled';
  conclusion: string;
  startedAt?: string;
  completedAt?: string;
  detailsUrl?: string;
}

interface Review {
  id: string;
  reviewer: string;
  state: 'pending' | 'approved' | 'changes_requested' | 'commented';
  submittedAt?: string;
}

const PRStatusTracker: React.FC = () => {
  const [prs, setPRs] = useState<PRStatus[]>([]);
  const [selectedPR, setSelectedPR] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'success' | 'failed'>('all');
  const wsRef = useRef<WebSocket | null>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    connectWebSocket();
    fetchPRs();
    
    if (autoRefresh) {
      startAutoRefresh();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (autoRefresh) {
      startAutoRefresh();
    } else {
      stopAutoRefresh();
    }
  }, [autoRefresh]);

  const connectWebSocket = () => {
    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080';
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      setIsConnected(true);
      console.log('WebSocket connected');
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      setIsConnected(false);
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'pr_status_update':
        updatePRStatus(data.payload);
        break;
      case 'check_status_update':
        updateCheckStatus(data.payload);
        break;
      case 'review_update':
        updateReview(data.payload);
        break;
      default:
        console.log('Unknown WebSocket message type:', data.type);
    }
  };

  const updatePRStatus = (payload: any) => {
    setPRs(prev => prev.map(pr => 
      pr.id === payload.id 
        ? { ...pr, ...payload }
        : pr
    ));
  };

  const updateCheckStatus = (payload: any) => {
    setPRs(prev => prev.map(pr => 
      pr.id === payload.prId
        ? {
            ...pr,
            checks: pr.checks.map(check =>
              check.id === payload.checkId
                ? { ...check, ...payload.check }
                : check
            )
          }
        : pr
    ));
  };

  const updateReview = (payload: any) => {
    setPRs(prev => prev.map(pr => 
      pr.id === payload.prId
        ? {
            ...pr,
            reviews: pr.reviews.some(r => r.id === payload.review.id)
              ? pr.reviews.map(r => r.id === payload.review.id ? payload.review : r)
              : [...pr.reviews, payload.review]
          }
        : pr
    ));
  };

  const fetchPRs = async () => {
    try {
      const response = await fetch('/api/prs');
      const data = await response.json();
      setPRs(data);
    } catch (error) {
      console.error('Failed to fetch PRs:', error);
    }
  };

  const startAutoRefresh = () => {
    refreshIntervalRef.current = setInterval(fetchPRs, 30000); // Refresh every 30 seconds
  };

  const stopAutoRefresh = () => {
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
      refreshIntervalRef.current = null;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'cancelled':
        return <AlertCircle className="w-5 h-5 text-gray-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 border-green-200';
      case 'failed':
        return 'bg-red-100 border-red-200';
      case 'in_progress':
        return 'bg-blue-100 border-blue-200';
      case 'pending':
        return 'bg-yellow-100 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-100 border-gray-200';
      default:
        return 'bg-gray-100 border-gray-200';
    }
  };

  const getReviewIcon = (state: string) => {
    switch (state) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'changes_requested':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'commented':
        return <MessageSquare className="w-4 h-4 text-blue-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const filteredPRs = prs.filter(pr => {
    if (filter === 'all') return true;
    return pr.status === filter;
  });

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const calculateProgress = (checks: Check[]) => {
    if (checks.length === 0) return 0;
    const completed = checks.filter(check => ['success', 'failed', 'cancelled'].includes(check.status)).length;
    return Math.round((completed / checks.length) * 100);
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">PR Status Tracker</h1>
            <div className="flex items-center gap-2 mt-2">
              <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-sm text-gray-600">
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium ${
                autoRefresh 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}
            >
              {autoRefresh ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              Auto Refresh
            </button>
            
            <button
              onClick={fetchPRs}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-2 mt-6">
          {['all', 'pending', 'success', 'failed'].map((filterOption) => (
            <button
              key={filterOption}
              onClick={() => setFilter(filterOption as any)}
              className={`px-4 py-2 rounded-md text-sm font-medium capitalize transition-colors ${
                filter === filterOption
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {filterOption}
            </button>
          ))}
        </div>
      </div>

      {/* PR Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredPRs.map((pr) => (
            <motion.div
              key={pr.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`border rounded-lg p-6 cursor-pointer transition-all hover:shadow-lg ${getStatusColor(pr.status)}`}
              onClick={() => setSelectedPR(selectedPR === pr.id ? null : pr.id)}
            >
              {/* PR Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-gray-900 truncate">
                    {pr.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <GitBranch className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-600 truncate">{pr.branch}</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-1">by {pr.author}</p>
                </div>
                {getStatusIcon(pr.status)}
              </div>

              {/* Progress Bar */}
              {pr.checks.length > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Checks Progress
                    </span>
                    <span className="text-sm text-gray-600">
                      {calculateProgress(pr.checks)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <motion.div
                      className="bg-blue-600 h-2 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${calculateProgress(pr.checks)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  <span>{pr.reviews.length}</span>
                </div>
                <div className="flex items-center gap-1">
                  <MessageSquare className="w-4 h-4" />
                  <span>{pr.comments}</span>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {selectedPR === pr.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-6 pt-6 border-t border-gray-200"
                  >
                    {/* Timestamps */}
                    <div className="mb-4 text-xs text-gray-500">
                      <p>Created: {formatTimestamp(pr.createdAt)}</p>
                      <p>Updated: {formatTimestamp(pr.updatedAt)}</p>
                    </div>

                    {/* Checks */}
                    {pr.checks.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Checks</h4>
                        <div className="space-y-2">
                          {pr.checks.map((check) => (
                            <div key={check.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                {getStatusIcon(check.status)}
                                <span className="text-sm font-medium">{check.name}</span>
                              </div>
                              {check.detailsUrl && (
                                <a
                                  href={check.detailsUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:text-blue-800 text-sm"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  View
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reviews */}
                    {pr.reviews.length > 0 && (
                      <div className="mb-4">
                        <h4 className="font-medium text-gray-900 mb-2">Reviews</h4>
                        <div className="space-y-2">
                          {pr.reviews.map((review) => (
                            <div key={review.id} className="flex items-center justify-between p-2 bg-white rounded border">
                              <div className="flex items-center gap-2">
                                {getReviewIcon(review.state)}
                                <span className="text-sm">{review.reviewer}</span>
                              </div>
                              <span className="text-xs text-gray-500 capitalize">
                                {review.state.replace('_', ' ')}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Action Button */}
                    <a
                      href={pr.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View on GitHub
                    </a>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {filteredPRs.length === 0 && (
        <div className="text-center py-12">
          <GitBranch className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No PRs found</h3>
          <p className="text-gray-600">
            {filter === 'all' 
              ? 'There are currently no pull requests to display.'
              : `No pull requests with status "${filter}" found.`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default PRStatusTracker;