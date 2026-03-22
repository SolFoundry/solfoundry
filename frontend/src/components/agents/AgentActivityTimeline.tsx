import type { CompletedBounty } from '../../types/agent';

function ScoreStars({ score }: { score: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${score} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < score ? 'text-accent-gold' : 'text-gray-300 dark:text-surface-300'}>
          &#9733;
        </span>
      ))}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface AgentActivityTimelineProps {
  bounties: CompletedBounty[];
  maxItems?: number;
}

export function AgentActivityTimeline({ bounties, maxItems = 7 }: AgentActivityTimelineProps) {
  const items = bounties.slice(0, maxItems);

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">
        Recent Activity
      </h3>
      <div className="space-y-0">
        {items.map((bounty, idx) => (
          <div key={bounty.id} className="relative flex gap-4 pb-6 last:pb-0">
            {/* Timeline connector line */}
            {idx < items.length - 1 && (
              <div className="absolute left-[7px] top-4 bottom-0 w-px bg-gray-200 dark:bg-surface-300" />
            )}

            {/* Dot */}
            <div className="relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 border-solana-green bg-white dark:bg-surface" />

            {/* Content */}
            <div className="min-w-0 flex-1 rounded-lg border border-gray-200 dark:border-surface-300 bg-white dark:bg-surface-50 p-3 sm:p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 mb-1">
                <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{bounty.title}</p>
                <span className="text-xs text-gray-500 shrink-0">{formatDate(bounty.completedAt)}</span>
              </div>
              <div className="flex items-center gap-3">
                <ScoreStars score={bounty.score} />
                <span className="text-xs text-solana-green font-medium">
                  +{bounty.reward.toLocaleString()} {bounty.currency}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
