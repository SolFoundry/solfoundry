/** Bounty timeline showing progress through stages from Created to Paid. */
import React from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type StageStatus = 'completed' | 'current' | 'pending' | 'rejected';

export interface TimelineStage {
  id: string;
  label: string;
  status: StageStatus;
  detail?: string;
  timestamp?: string;
}

interface BountyTimelineProps {
  bountyId: string;
  stages?: TimelineStage[];
}

// ── Default stage definitions ─────────────────────────────────────────────────

const DEFAULT_STAGE_LABELS = [
  'Created',
  'Open for Submissions',
  'PR Submitted',
  'AI Review',
  'Approved & Merged',
  'Paid',
] as const;

// ── Mock bounty states ────────────────────────────────────────────────────────

function buildOpenStages(): TimelineStage[] {
  return [
    { id: 's1', label: 'Created', status: 'completed', timestamp: '2026-03-15 09:00', detail: 'Bounty #203 created by SolFoundry team. Reward: 25,000 $FNDRY.' },
    { id: 's2', label: 'Open for Submissions', status: 'current', timestamp: '2026-03-15 09:01', detail: 'Accepting pull requests. No submissions yet.' },
    { id: 's3', label: 'PR Submitted', status: 'pending', detail: 'Waiting for a contributor to open a PR.' },
    { id: 's4', label: 'AI Review', status: 'pending', detail: 'AI reviewer will score the submission.' },
    { id: 's5', label: 'Approved & Merged', status: 'pending', detail: 'Maintainer merge required.' },
    { id: 's6', label: 'Paid', status: 'pending', detail: '$FNDRY will be released to contributor wallet.' },
  ];
}

function buildInReviewStages(): TimelineStage[] {
  return [
    { id: 's1', label: 'Created', status: 'completed', timestamp: '2026-03-10 14:00', detail: 'Bounty #188 created. Reward: 18,000 $FNDRY.' },
    { id: 's2', label: 'Open for Submissions', status: 'completed', timestamp: '2026-03-10 14:01', detail: 'Two PRs submitted: #210 (NeuralCraft) and #211 (ChainForge).' },
    { id: 's3', label: 'PR Submitted', status: 'completed', timestamp: '2026-03-18 11:22', detail: 'NeuralCraft opened PR #210. ChainForge opened PR #211 (competing).' },
    { id: 's4', label: 'AI Review', status: 'current', timestamp: '2026-03-19 08:00', detail: 'AI reviewer is scoring both PRs. NeuralCraft: 94/100 (in progress). ChainForge: pending.' },
    { id: 's5', label: 'Approved & Merged', status: 'pending', detail: 'Maintainer will merge the winning PR.' },
    { id: 's6', label: 'Paid', status: 'pending', detail: '$FNDRY held in escrow, ready for release.' },
  ];
}

function buildPaidStages(): TimelineStage[] {
  return [
    { id: 's1', label: 'Created', status: 'completed', timestamp: '2026-03-01 10:00', detail: 'Bounty #176 created. Reward: 32,000 $FNDRY.' },
    { id: 's2', label: 'Open for Submissions', status: 'completed', timestamp: '2026-03-01 10:01', detail: 'Opened for submissions.' },
    { id: 's3', label: 'PR Submitted', status: 'completed', timestamp: '2026-03-05 16:45', detail: 'PixelPush opened PR #198.' },
    { id: 's4', label: 'AI Review', status: 'completed', timestamp: '2026-03-06 09:15', detail: 'AI score: 96/100. No blocking issues found.' },
    { id: 's5', label: 'Approved & Merged', status: 'completed', timestamp: '2026-03-07 14:30', detail: 'Merged by maintainer @solfoundry-bot.' },
    { id: 's6', label: 'Paid', status: 'completed', timestamp: '2026-03-07 14:31', detail: '32,000 $FNDRY sent to 7xKXtg2...Abc1.' },
  ];
}

function buildRejectedStages(): TimelineStage[] {
  return [
    { id: 's1', label: 'Created', status: 'completed', timestamp: '2026-03-12 08:00', detail: 'Bounty #195 created. Reward: 20,000 $FNDRY.' },
    { id: 's2', label: 'Open for Submissions', status: 'completed', timestamp: '2026-03-12 08:01', detail: 'Opened for submissions.' },
    { id: 's3', label: 'PR Submitted', status: 'completed', timestamp: '2026-03-14 13:10', detail: 'DevAgent-X opened PR #207.' },
    { id: 's4', label: 'AI Review', status: 'rejected', timestamp: '2026-03-14 15:00', detail: 'AI score: 52/100. Critical issues: missing test coverage, type errors in 3 files. PR rejected — bounty re-opened.' },
    { id: 's5', label: 'Approved & Merged', status: 'pending', detail: 'Waiting for a passing submission.' },
    { id: 's6', label: 'Paid', status: 'pending', detail: 'Awaiting successful merge.' },
  ];
}

const MOCK_STAGES: Record<string, TimelineStage[]> = {
  open: buildOpenStages(),
  'in-review': buildInReviewStages(),
  paid: buildPaidStages(),
  rejected: buildRejectedStages(),
};

function getDefaultStages(bountyId: string): TimelineStage[] {
  if (bountyId in MOCK_STAGES) return MOCK_STAGES[bountyId];
  // Default to open for unknown IDs
  return buildOpenStages();
}

// ── Stage icon ────────────────────────────────────────────────────────────────

function StageIcon({ status }: { status: StageStatus }) {
  if (status === 'completed') {
    return (
      <div className="w-8 h-8 rounded-full bg-green-600 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </div>
    );
  }
  if (status === 'current') {
    return (
      <div className="w-8 h-8 rounded-full bg-gray-800 ring-2 ring-green-400 animate-pulse flex items-center justify-center shrink-0">
        <div className="w-3 h-3 rounded-full bg-green-400" />
      </div>
    );
  }
  if (status === 'rejected') {
    return (
      <div className="w-8 h-8 rounded-full bg-red-900/50 border border-red-600 flex items-center justify-center shrink-0">
        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>
    );
  }
  // pending
  return (
    <div className="w-8 h-8 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center shrink-0">
      <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
    </div>
  );
}

function stageConnectorColor(status: StageStatus): string {
  if (status === 'completed') return 'bg-green-600';
  if (status === 'rejected') return 'bg-red-800';
  return 'bg-gray-700';
}

function stageLabelColor(status: StageStatus): string {
  if (status === 'completed') return 'text-green-400';
  if (status === 'current') return 'text-white font-semibold';
  if (status === 'rejected') return 'text-red-400';
  return 'text-gray-500';
}

// ── Component ─────────────────────────────────────────────────────────────────

export const BountyTimeline: React.FC<BountyTimelineProps> = ({
  bountyId,
  stages,
}) => {
  const items = stages ?? getDefaultStages(bountyId);
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const toggle = (id: string) =>
    setExpanded((prev) => (prev === id ? null : id));

  return (
    <div className="bg-gray-800 rounded-xl p-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-5">
        Timeline — Bounty #{bountyId}
      </h2>
      <ol className="relative space-y-0">
        {items.map((stage, idx) => {
          const isLast = idx === items.length - 1;
          const isExpanded = expanded === stage.id;
          const hasDetail = Boolean(stage.detail);

          return (
            <li key={stage.id} className="flex gap-3">
              {/* Left column: icon + connector */}
              <div className="flex flex-col items-center">
                <StageIcon status={stage.status} />
                {!isLast && (
                  <div
                    className={`w-0.5 flex-1 ${stageConnectorColor(stage.status)} my-1`}
                    style={{ minHeight: '24px' }}
                  />
                )}
              </div>

              {/* Right column: label + detail */}
              <div className="flex-1 pb-5">
                <button
                  type="button"
                  onClick={() => hasDetail && toggle(stage.id)}
                  className={`flex items-center gap-2 w-full text-left ${hasDetail ? 'cursor-pointer' : 'cursor-default'}`}
                  aria-expanded={isExpanded}
                >
                  <span className={`text-sm ${stageLabelColor(stage.status)}`}>
                    {stage.label}
                  </span>
                  {stage.timestamp && (
                    <span className="text-xs text-gray-600">{stage.timestamp}</span>
                  )}
                  {hasDetail && (
                    <span className="ml-auto text-gray-600 text-xs">
                      {isExpanded ? '▲' : '▼'}
                    </span>
                  )}
                </button>

                {/* Expandable detail */}
                {isExpanded && stage.detail && (
                  <div className="mt-2 px-3 py-2 bg-gray-700/60 rounded-lg border border-gray-600/40">
                    <p className="text-xs text-gray-300 leading-relaxed">{stage.detail}</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default BountyTimeline;
