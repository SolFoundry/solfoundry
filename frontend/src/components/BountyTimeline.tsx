'use client';

import React, { useState } from 'react';
import type { BountyTimelineData, TimelineStage, TimelineStageType } from '../types/timeline';
import { STAGE_INFO } from '../types/timeline';

interface BountyTimelineProps {
  bountyId: string;
  timelineData?: BountyTimelineData;
}

// Pulse animation keyframes (inline style)
const pulseKeyframes = `
@keyframes pulse-glow {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(34, 197, 94, 0);
  }
}
`;

/**
 * BountyTimeline Component
 * 
 * A visual timeline component that shows the full lifecycle of a bounty
 * from creation to payout.
 */
export const BountyTimeline: React.FC<BountyTimelineProps> = ({ 
  bountyId, 
  timelineData 
}) => {
  const [expandedStages, setExpandedStages] = useState<Set<TimelineStageType>>(new Set());

  // Toggle stage expansion
  const toggleStage = (stageType: TimelineStageType) => {
    setExpandedStages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stageType)) {
        newSet.delete(stageType);
      } else {
        newSet.add(stageType);
      }
      return newSet;
    });
  };

  // If no timeline data provided, show loading or error state
  if (!timelineData) {
    return (
      <div className="bg-gray-900 rounded-lg p-6 text-center">
        <p className="text-gray-400">No timeline data available for bounty {bountyId}</p>
      </div>
    );
  }

  const { stages, currentStage } = timelineData;

  return (
    <>
      {/* Inject pulse animation */}
      <style>{pulseKeyframes}</style>
      
      <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-300 mb-6">
          Bounty Timeline
        </h2>
        
        {/* Vertical Timeline */}
        <div className="relative">
          {/* Timeline line (connecting all stages) */}
          <div className="absolute left-4 sm:left-5 top-0 bottom-0 w-0.5 bg-gray-700" />
          
          {/* Stage items */}
          <div className="space-y-4">
            {stages.map((stage, index) => (
              <TimelineStageItem
                key={stage.stage}
                stage={stage}
                isCurrentStage={stage.stage === currentStage}
                isExpanded={expandedStages.has(stage.stage)}
                onToggle={() => toggleStage(stage.stage)}
                isLast={index === stages.length - 1}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Individual Timeline Stage Item
 */
interface TimelineStageItemProps {
  stage: TimelineStage;
  isCurrentStage: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
}

const TimelineStageItem: React.FC<TimelineStageItemProps> = ({
  stage,
  isCurrentStage,
  isExpanded,
  onToggle,
  isLast,
}) => {
  const { status, date, details } = stage;
  const stageInfo = STAGE_INFO[stage.stage];
  
  // Determine the icon to show
  const renderIcon = () => {
    if (status === 'completed') {
      return (
        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500 flex items-center justify-center text-white">
          <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
      );
    }
    
    if (status === 'current') {
      return (
        <div 
          className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-500 flex items-center justify-center text-white"
          style={{ animation: 'pulse-glow 2s infinite' }}
        >
          <span className="text-sm sm:text-base">{stageInfo.icon}</span>
        </div>
      );
    }
    
    // Pending status
    return (
      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-gray-700 flex items-center justify-center text-gray-500">
        <span className="text-sm sm:text-base">{stageInfo.icon}</span>
      </div>
    );
  };

  // Format date
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return '';
    }
  };

  // Get stage description
  const getStageDescription = () => {
    switch (stage.stage) {
      case 'created':
        return `Bounty posted by ${details.creator || 'SolFoundry'}`;
      case 'open_for_submissions':
        return 'Accepting PRs';
      case 'pr_submitted':
        if (details.author && details.prNumber) {
          return (
            <span>
              <span className="font-medium">{details.author}</span> submitted PR #{details.prNumber}
            </span>
          );
        }
        return 'PR submitted';
      case 'ai_review':
        if (details.score !== undefined && details.verdict) {
          return `Score: ${details.score}/10 — ${details.verdict}`;
        }
        return 'AI review in progress';
      case 'approved_merged':
        if (details.mergedPrNumber) {
          return `PR #${details.mergedPrNumber} merged`;
        }
        return 'Approved and merged';
      case 'paid':
        if (details.amount && details.recipient) {
          return (
            <span>
              {details.amount.toLocaleString()} $FNDRY sent to{' '}
              <span className="font-medium">{details.recipient}</span>
            </span>
          );
        }
        return 'Payment sent';
      default:
        return '';
    }
  };

  // Check if stage has expandable details
  const hasExpandableDetails = () => {
    if (status === 'pending') return false;
    
    switch (stage.stage) {
      case 'pr_submitted':
        return !!details.prUrl;
      case 'ai_review':
        return !!details.submissionId;
      case 'approved_merged':
        return !!details.mergedPrUrl;
      case 'paid':
        return !!details.txUrl;
      default:
        return false;
    }
  };

  // Render expandable details
  const renderExpandableDetails = () => {
    if (!isExpanded) return null;
    
    return (
      <div className="mt-3 p-3 bg-gray-800 rounded-lg text-sm space-y-2">
        {stage.stage === 'pr_submitted' && details.prUrl && (
          <a
            href={details.prUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-blue-400 hover:text-blue-300 transition-colors min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
            </svg>
            View PR #{details.prNumber} on GitHub
          </a>
        )}
        
        {stage.stage === 'ai_review' && details.submissionId && (
          <div className="text-gray-400">
            <p>Submission ID: <span className="font-mono text-gray-300">{details.submissionId}</span></p>
            {details.score !== undefined && (
              <p className="mt-1">
                Review Score: <span className="font-bold text-yellow-400">{details.score}/10</span>
              </p>
            )}
          </div>
        )}
        
        {stage.stage === 'approved_merged' && details.mergedPrUrl && (
          <a
            href={details.mergedPrUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-green-400 hover:text-green-300 transition-colors min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            View merged PR #{details.mergedPrNumber}
          </a>
        )}
        
        {stage.stage === 'paid' && details.txUrl && (
          <a
            href={details.txUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-purple-400 hover:text-purple-300 transition-colors min-h-[44px] touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View transaction on Solscan
            {details.txHash && <span className="font-mono text-xs">({details.txHash})</span>}
          </a>
        )}
      </div>
    );
  };

  return (
    <div className={`relative pl-10 sm:pl-12 ${isLast ? '' : 'pb-2'}`}>
      {/* Icon circle */}
      <div className="absolute left-0 top-0">
        {renderIcon()}
      </div>
      
      {/* Content */}
      <button
        onClick={hasExpandableDetails() ? onToggle : undefined}
        className={`text-left w-full ${hasExpandableDetails() ? 'cursor-pointer hover:bg-gray-800/50 rounded-lg p-2 -m-2 transition-colors' : 'cursor-default'}`}
        disabled={!hasExpandableDetails()}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-2">
          <div className="flex items-center gap-2">
            <span className={`font-medium ${status === 'pending' ? 'text-gray-500' : 'text-white'}`}>
              {stageInfo.icon} {stageInfo.label}
            </span>
            {hasExpandableDetails() && (
              <svg 
                className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </div>
          {date && (
            <span className={`text-xs sm:text-sm ${status === 'pending' ? 'text-gray-600' : 'text-gray-500'}`}>
              {formatDate(date)}
            </span>
          )}
        </div>
        
        <p className={`mt-1 text-sm ${status === 'pending' ? 'text-gray-600' : 'text-gray-400'}`}>
          {getStageDescription()}
        </p>
      </button>
      
      {/* Expandable details */}
      {renderExpandableDetails()}
    </div>
  );
};

export default BountyTimeline;