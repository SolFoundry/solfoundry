/** Review pipeline panel — active reviews, pass/fail metrics. */
import { useReviewPipeline } from '../../hooks/useAdminData';

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score * 10));
  const color =
    score >= 7 ? 'bg-[#14F195]' :
    score >= 5 ? 'bg-yellow-400' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums w-8 text-right">{score.toFixed(1)}</span>
    </div>
  );
}

export function ReviewPipeline() {
  const { data, isLoading, error } = useReviewPipeline();

  return (
    <div className="p-6 space-y-6" data-testid="review-pipeline">
      <h2 className="text-lg font-semibold">Review Pipeline</h2>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}

      {data && (
        <>
          {/* Aggregate metrics */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
              <p className="text-xl font-bold text-yellow-400 tabular-nums">{data.total_active}</p>
              <p className="text-xs text-gray-500 mt-0.5">Pending</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
              <p className="text-xl font-bold text-[#14F195] tabular-nums">
                {(data.pass_rate * 100).toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Pass Rate</p>
            </div>
            <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4 text-center">
              <p className="text-xl font-bold tabular-nums">{data.avg_score.toFixed(2)}</p>
              <p className="text-xs text-gray-500 mt-0.5">Avg Score</p>
            </div>
          </div>

          {/* Active reviews table */}
          {data.active.length === 0 ? (
            <div className="rounded-xl border border-white/5 bg-white/[0.03] py-12 text-center">
              <p className="text-sm text-gray-500">No pending reviews</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-white/5">
              <table className="w-full text-xs" data-testid="review-table">
                <thead>
                  <tr className="border-b border-white/5 text-gray-500">
                    <th className="text-left px-4 py-3 font-medium">Bounty</th>
                    <th className="text-left px-4 py-3 font-medium">Submitted by</th>
                    <th className="text-left px-4 py-3 font-medium">PR</th>
                    <th className="text-left px-4 py-3 font-medium w-40">AI Score</th>
                    <th className="text-left px-4 py-3 font-medium">Threshold</th>
                    <th className="text-left px-4 py-3 font-medium">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {data.active.map(r => (
                    <tr
                      key={r.submission_id}
                      className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                      data-testid={`review-row-${r.submission_id}`}
                    >
                      <td className="px-4 py-3 font-medium truncate max-w-[180px]">
                        <a href={`/bounties/${r.bounty_id}`} className="text-[#9945FF] hover:underline">
                          {r.bounty_title}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-gray-400">{r.submitted_by}</td>
                      <td className="px-4 py-3">
                        {r.pr_url ? (
                          <a
                            href={r.pr_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[#14F195] hover:underline truncate block max-w-[120px]"
                          >
                            {r.pr_url.replace('https://github.com/', '')}
                          </a>
                        ) : (
                          <span className="text-gray-600">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 w-40">
                        <ScoreBar score={r.ai_score} />
                      </td>
                      <td className="px-4 py-3">
                        {r.meets_threshold ? (
                          <span className="text-[#14F195] text-[10px] font-medium">✓ Pass</span>
                        ) : (
                          <span className="text-red-400 text-[10px] font-medium">✗ Fail</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">
                        {new Date(r.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
