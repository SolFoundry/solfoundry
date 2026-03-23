import type { CompletedBounty, AgentActivityEntry } from '../../types/agent';

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
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

type Unified =
  | { sortKey: number; kind: 'activity'; entry: AgentActivityEntry }
  | { sortKey: number; kind: 'bounty'; bounty: CompletedBounty };

function unifyFeed(
  activities: AgentActivityEntry[],
  bounties: CompletedBounty[],
  maxItems: number,
): Unified[] {
  const fromActs: Unified[] = activities.map((entry) => ({
    kind: 'activity',
    entry,
    sortKey: new Date(entry.ts).getTime() || 0,
  }));
  const fromBounties: Unified[] = bounties.map((bounty) => ({
    kind: 'bounty',
    bounty,
    sortKey: new Date(bounty.completedAt).getTime() || 0,
  }));
  return [...fromActs, ...fromBounties]
    .sort((a, b) => b.sortKey - a.sortKey)
    .slice(0, maxItems);
}

interface AgentActivityTimelineProps {
  bounties?: CompletedBounty[];
  activities?: AgentActivityEntry[];
  maxItems?: number;
  /** Shown next to heading when parent uses polling. */
  liveLabel?: boolean;
}

export function AgentActivityTimeline({
  bounties = [],
  activities = [],
  maxItems = 12,
  liveLabel = false,
}: AgentActivityTimelineProps) {
  const rows = unifyFeed(activities, bounties, maxItems);

  return (
    <div data-testid="agent-activity-feed">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-700 dark:text-gray-400">
          Activity feed
        </h3>
        {liveLabel && (
          <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" aria-hidden />
            Live
          </span>
        )}
      </div>
      {rows.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-500">No activity yet.</p>
      ) : (
        <div className="space-y-0">
          {rows.map((row, idx) => (
            <div key={`${row.kind}-${idx}`} className="relative flex gap-4 pb-6 last:pb-0">
              {idx < rows.length - 1 && (
                <div className="absolute bottom-0 left-[7px] top-4 w-px bg-cyan-500/20 dark:bg-cyan-400/20" />
              )}
              <div
                className={`relative z-10 mt-1.5 h-[15px] w-[15px] shrink-0 rounded-full border-2 bg-white dark:bg-surface ${
                  row.kind === 'activity'
                    ? 'border-cyan-500 dark:border-cyan-400'
                    : 'border-solana-green'
                }`}
              />
              <div className="min-w-0 flex-1 rounded-lg border border-cyan-500/15 bg-cyan-950/[0.04] p-3 sm:p-4 dark:border-cyan-500/20 dark:bg-cyan-950/20">
                {row.kind === 'activity' ? (
                  <>
                    <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <span className="inline-flex w-fit rounded-md bg-cyan-500/15 px-2 py-0.5 font-mono text-xs font-medium text-cyan-800 dark:text-cyan-200">
                        {row.entry.type}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-500">
                        {formatDate(row.entry.ts)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200">{row.entry.message}</p>
                  </>
                ) : (
                  <>
                    <div className="mb-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                        {row.bounty.title}
                      </p>
                      <span className="shrink-0 text-xs text-gray-600 dark:text-gray-500">
                        {formatDate(row.bounty.completedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <ScoreStars score={row.bounty.score} />
                      <span className="text-xs font-medium text-solana-green">
                        +{row.bounty.reward.toLocaleString()} {row.bounty.currency}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
