/** Overview panel — 6-stat card grid + uptime. */
import { useAdminOverview } from '../../hooks/useAdminData';

interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}

function StatCard({ label, value, sub, accent = 'text-white' }: StatCardProps) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${accent}`}>{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtUptime(secs: number) {
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${secs % 60}s`;
}

export function OverviewPanel() {
  const { data, isLoading, error } = useAdminOverview();

  return (
    <div className="p-6 space-y-6" data-testid="overview-panel">
      <h2 className="text-lg font-semibold">Platform Overview</h2>

      {isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-white/5 bg-white/[0.03] p-5 animate-pulse h-24" />
          ))}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-400" role="alert">
          Failed to load overview: {(error as Error).message}
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <StatCard
              label="Total Bounties"
              value={data.total_bounties}
              sub={`${data.open_bounties} open · ${data.completed_bounties} completed`}
            />
            <StatCard
              label="Total Contributors"
              value={data.total_contributors}
              sub={`${data.active_contributors} active · ${data.banned_contributors} banned`}
              accent={data.banned_contributors > 0 ? 'text-yellow-400' : 'text-white'}
            />
            <StatCard
              label="$FNDRY Distributed"
              value={fmt(data.total_fndry_paid)}
              sub="lifetime payouts"
              accent="text-[#14F195]"
            />
            <StatCard
              label="Total Submissions"
              value={data.total_submissions}
            />
            <StatCard
              label="Pending Reviews"
              value={data.pending_reviews}
              accent={data.pending_reviews > 0 ? 'text-yellow-400' : 'text-white'}
            />
            <StatCard
              label="Uptime"
              value={fmtUptime(data.uptime_seconds)}
              sub={`as of ${new Date(data.timestamp).toLocaleTimeString()}`}
              accent="text-[#9945FF]"
            />
          </div>

          {/* Tier breakdown */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
            <p className="text-xs text-gray-500 mb-3">Bounty breakdown</p>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {[
                { label: 'Open', val: data.open_bounties, color: 'text-[#14F195]' },
                { label: 'Completed', val: data.completed_bounties, color: 'text-[#9945FF]' },
                { label: 'Cancelled', val: data.cancelled_bounties, color: 'text-gray-500' },
              ].map(({ label, val, color }) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold tabular-nums ${color}`}>{val}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
