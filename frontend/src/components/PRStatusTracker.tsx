'use client';

import React, { useState, useEffect, useCallback } from 'react';

// Types for PR Status Pipeline
export type StageStatus = 'pending' | 'running' | 'passed' | 'failed' | 'skipped';

export type PipelineStage = 
  | 'submitted'
  | 'ci_running'
  | 'ai_review'
  | 'human_review'
  | 'approved'
  | 'denied'
  | 'payout';

export interface AIScoreBreakdown {
  quality: number;      // 0-100
  correctness: number;  // 0-100
  security: number;     // 0-100
  completeness: number; // 0-100
  tests: number;        // 0-100
  overall: number;      // 0-100
}

export interface StageDetails {
  status: StageStatus;
  timestamp?: string;
  duration?: string;
  message?: string;
  logs?: string[];
  scoreBreakdown?: AIScoreBreakdown;
  transactionHash?: string;
  solscanUrl?: string;
}

export interface PRStatusData {
  prId: string;
  prNumber: number;
  prUrl: string;
  author: string;
  bountyId: string;
  bountyTitle: string;
  stages: Record<PipelineStage, StageDetails>;
  currentStage: PipelineStage;
  lastUpdated: string;
}

export interface PRStatusTrackerProps {
  initialData?: PRStatusData;
  wsEndpoint?: string;
  onStageChange?: (stage: PipelineStage, status: StageStatus) => void;
  onError?: (error: Error) => void;
  showHeader?: boolean;
  compact?: boolean;
}

// Stage configuration
const STAGE_CONFIG: { stage: PipelineStage; label: string; icon: string }[] = [
  { stage: 'submitted', label: 'Submitted', icon: '📤' },
  { stage: 'ci_running', label: 'CI Running', icon: '⚙️' },
  { stage: 'ai_review', label: 'AI Review', icon: '🤖' },
  { stage: 'human_review', label: 'Human Review', icon: '👁️' },
  { stage: 'approved', label: 'Approved', icon: '✅' },
  { stage: 'denied', label: 'Denied', icon: '❌' },
  { stage: 'payout', label: 'Payout', icon: '💰' },
];

// Status color mapping
const statusColors: Record<StageStatus, string> = {
  pending: 'bg-gray-600 text-gray-300',
  running: 'bg-blue-500 text-white animate-pulse',
  passed: 'bg-green-500 text-white',
  failed: 'bg-red-500 text-white',
  skipped: 'bg-gray-700 text-gray-400',
};

const statusBorderColors: Record<StageStatus, string> = {
  pending: 'border-gray-600',
  running: 'border-blue-500',
  passed: 'border-green-500',
  failed: 'border-red-500',
  skipped: 'border-gray-700',
};

// Utility function to format timestamp
const formatTimestamp = (timestamp?: string): string => {
  if (!timestamp) return '—';
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Utility to format duration
const formatDuration = (duration?: string): string => {
  if (!duration) return '';
  return `(${duration})`;
};

// AI Score Breakdown Component
const AIScoreBreakdownView: React.FC<{ scores: AIScoreBreakdown }> = ({ scores }) => {
  const scoreItems = [
    { label: 'Quality', value: scores.quality, color: 'bg-blue-500' },
    { label: 'Correctness', value: scores.correctness, color: 'bg-green-500' },
    { label: 'Security', value: scores.security, color: 'bg-yellow-500' },
    { label: 'Completeness', value: scores.completeness, color: 'bg-purple-500' },
    { label: 'Tests', value: scores.tests, color: 'bg-pink-500' },
  ];

  return (
    <div className="mt-3 p-3 bg-gray-800 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-gray-300">AI Score Breakdown</span>
        <span className="text-lg font-bold text-white">{scores.overall}/100</span>
      </div>
      <div className="space-y-2">
        {scoreItems.map((item) => (
          <div key={item.label} className="flex items-center gap-2">
            <span className="text-xs text-gray-400 w-24">{item.label}</span>
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full ${item.color} transition-all duration-500`}
                style={{ width: `${item.value}%` }}
              />
            </div>
            <span className="text-xs font-mono text-gray-300 w-8 text-right">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// Payout Details Component
const PayoutDetails: React.FC<{ hash: string; solscanUrl: string }> = ({ hash, solscanUrl }) => (
  <div className="mt-3 p-3 bg-gray-800 rounded-lg">
    <div className="flex items-center gap-2 mb-2">
      <span className="text-sm font-medium text-gray-300">Transaction</span>
      <span className="text-xs text-green-400">✓ Confirmed</span>
    </div>
    <div className="flex items-center gap-2 text-xs">
      <code className="text-gray-400 font-mono truncate flex-1">{hash}</code>
      <a
        href={solscanUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] px-3 py-2 rounded hover:bg-gray-700"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
        <span>View on Solscan</span>
      </a>
    </div>
  </div>
);

// Stage Card Component
const StageCard: React.FC<{
  stage: PipelineStage;
  details: StageDetails;
  isCurrent: boolean;
  isCompact?: boolean;
}> = ({ stage, details, isCurrent, isCompact }) => {
  const config = STAGE_CONFIG.find(s => s.stage === stage)!;
  const status = details.status;

  return (
    <div
      className={`
        relative rounded-lg border-2 transition-all duration-300
        ${statusBorderColors[status]}
        ${isCurrent ? 'ring-2 ring-blue-400 ring-offset-2 ring-offset-gray-900' : ''}
        ${isCompact ? 'p-3' : 'p-4'}
        bg-gray-900
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-3">
        <span className={`text-xl ${isCompact ? 'text-lg' : 'text-2xl'}`}>
          {config.icon}
        </span>
        <div className="flex-1 min-w-0">
          <h3 className={`font-semibold ${isCompact ? 'text-sm' : 'text-base'} truncate`}>
            {config.label}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[status]}`}>
              {status.toUpperCase()}
            </span>
            {details.duration && (
              <span className="text-xs text-gray-500">{formatDuration(details.duration)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Timestamp & Message */}
      {!isCompact && (
        <div className="mt-3 space-y-1">
          {details.timestamp && (
            <p className="text-xs text-gray-500">
              {formatTimestamp(details.timestamp)}
            </p>
          )}
          {details.message && (
            <p className="text-sm text-gray-400">{details.message}</p>
          )}
        </div>
      )}

      {/* AI Score Breakdown */}
      {!isCompact && stage === 'ai_review' && details.scoreBreakdown && (
        <AIScoreBreakdownView scores={details.scoreBreakdown} />
      )}

      {/* Payout Details */}
      {!isCompact && stage === 'payout' && details.transactionHash && details.solscanUrl && (
        <PayoutDetails hash={details.transactionHash} solscanUrl={details.solscanUrl} />
      )}

      {/* Logs (collapsed by default) */}
      {!isCompact && details.logs && details.logs.length > 0 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400 transition-colors">
            View Logs ({details.logs.length})
          </summary>
          <div className="mt-2 p-2 bg-gray-800 rounded max-h-32 overflow-y-auto">
            {details.logs.map((log, idx) => (
              <p key={idx} className="text-xs font-mono text-gray-500">{log}</p>
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

// Pipeline Progress Bar
const PipelineProgress: React.FC<{
  stages: Record<PipelineStage, StageDetails>;
  currentStage: PipelineStage;
}> = ({ stages, currentStage }) => {
  const stageOrder = ['submitted', 'ci_running', 'ai_review', 'human_review'] as PipelineStage[];
  const finalStage = stages.approved.status === 'passed' ? 'approved' : 
                     stages.denied.status === 'passed' ? 'denied' : null;
  
  const completedStages = stageOrder.filter(s => stages[s].status === 'passed').length;
  const totalStages = stageOrder.length;
  const progress = (completedStages / totalStages) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
        <span>Pipeline Progress</span>
        <span>{completedStages}/{totalStages} stages completed</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-500 ${
            finalStage === 'approved' ? 'bg-green-500' : 
            finalStage === 'denied' ? 'bg-red-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
      {finalStage && (
        <div className={`mt-2 text-sm font-medium ${
          finalStage === 'approved' ? 'text-green-400' : 'text-red-400'
        }`}>
          {finalStage === 'approved' ? '✓ Approved - Processing Payout' : '✗ Denied - Please Review Feedback'}
        </div>
      )}
    </div>
  );
};

// Main Component
export const PRStatusTracker: React.FC<PRStatusTrackerProps> = ({
  initialData,
  wsEndpoint,
  onStageChange,
  onError,
  showHeader = true,
  compact = false,
}) => {
  const [statusData, setStatusData] = useState<PRStatusData | null>(initialData || null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // WebSocket connection for real-time updates
  useEffect(() => {
    if (!wsEndpoint) return;

    let ws: WebSocket | null = null;
    let reconnectTimer: NodeJS.Timeout | null = null;

    const connect = () => {
      try {
        ws = new WebSocket(wsEndpoint);

        ws.onopen = () => {
          setIsConnected(true);
          setConnectionError(null);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'pr_status_update' && data.prId === statusData?.prId) {
              setStatusData(data.payload);
              if (onStageChange && data.stage && data.status) {
                onStageChange(data.stage, data.status);
              }
            }
          } catch (e) {
            console.error('Failed to parse WebSocket message:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          setConnectionError('Connection error');
          if (onError) {
            onError(new Error('WebSocket connection error'));
          }
        };

        ws.onclose = () => {
          setIsConnected(false);
          // Attempt reconnection after 5 seconds
          reconnectTimer = setTimeout(connect, 5000);
        };
      } catch (e) {
        setConnectionError('Failed to connect');
      }
    };

    connect();

    return () => {
      if (ws) ws.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }, [wsEndpoint, statusData?.prId, onStageChange, onError]);

  // Render loading state
  if (!statusData) {
    return (
      <div className="bg-gray-950 rounded-lg p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4" />
        <p className="text-gray-400">Loading PR status...</p>
      </div>
    );
  }

  const activeStages = STAGE_CONFIG.filter(
    s => s.stage !== 'approved' && s.stage !== 'denied' || 
         (s.stage === 'approved' && statusData.stages.approved.status !== 'pending') ||
         (s.stage === 'denied' && statusData.stages.denied.status !== 'pending')
  );

  return (
    <div className={`bg-gray-950 rounded-lg ${compact ? 'p-4' : 'p-6'} text-white`}>
      {/* Header */}
      {showHeader && (
        <div className="mb-6">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold">
                PR #{statusData.prNumber} Status
              </h2>
              <a
                href={statusData.prUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-400 hover:underline"
              >
                View on GitHub →
              </a>
            </div>
            <div className="flex items-center gap-3">
              {wsEndpoint && (
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
                  isConnected ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-400' : 'bg-red-400'
                  }`} />
                  {isConnected ? 'Live' : 'Disconnected'}
                </div>
              )}
              <span className="text-xs text-gray-500">
                Updated {new Date(statusData.lastUpdated).toLocaleTimeString()}
              </span>
            </div>
          </div>
          
          {/* Bounty Info */}
          <div className="mt-4 p-3 bg-gray-900 rounded-lg">
            <p className="text-sm text-gray-400">Bounty</p>
            <p className="font-medium">{statusData.bountyTitle}</p>
            <p className="text-sm text-gray-500">by {statusData.author}</p>
          </div>
        </div>
      )}

      {/* Pipeline Progress */}
      {!compact && (
        <PipelineProgress stages={statusData.stages} currentStage={statusData.currentStage} />
      )}

      {/* Connection Error Banner */}
      {connectionError && wsEndpoint && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg text-red-400 text-sm">
          ⚠️ Real-time updates unavailable: {connectionError}
        </div>
      )}

      {/* Stage Pipeline */}
      <div className={`grid gap-4 ${
        compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
      }`}>
        {activeStages.map(({ stage }) => (
          <StageCard
            key={stage}
            stage={stage}
            details={statusData.stages[stage]}
            isCurrent={statusData.currentStage === stage}
            isCompact={compact}
          />
        ))}
      </div>

      {/* Final Status */}
      {(statusData.stages.approved.status === 'passed' || statusData.stages.denied.status === 'passed') && (
        <div className={`mt-6 p-4 rounded-lg ${
          statusData.stages.approved.status === 'passed' 
            ? 'bg-green-500/20 border border-green-500/30' 
            : 'bg-red-500/20 border border-red-500/30'
        }`}>
          <div className="flex items-center gap-3">
            <span className="text-3xl">
              {statusData.stages.approved.status === 'passed' ? '🎉' : '😔'}
            </span>
            <div>
              <h3 className="font-bold text-lg">
                {statusData.stages.approved.status === 'passed' 
                  ? 'Congratulations! PR Approved' 
                  : 'PR Denied'}
              </h3>
              <p className="text-sm text-gray-400">
                {statusData.stages.approved.status === 'passed'
                  ? 'Your contribution has been approved. Payout is being processed.'
                  : 'Please review the feedback and submit a new PR when ready.'}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PRStatusTracker;