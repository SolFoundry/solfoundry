/** System health panel — service status, uptime, queue depth, WS connections. */
import { useSystemHealth } from '../../hooks/useAdminData';

function ServiceBadge({ name, status }: { name: string; status: string }) {
  const ok = status === 'connected' || status === 'healthy';
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-gray-300 capitalize">{name}</span>
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${ok ? 'bg-[#14F195]' : 'bg-red-500'} ${ok ? 'animate-pulse' : ''}`} />
        <span className={`text-xs font-medium ${ok ? 'text-[#14F195]' : 'text-red-400'}`}>
          {status}
        </span>
      </div>
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.03] p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-gray-600 mt-0.5">{sub}</p>}
    </div>
  );
}

function fmtUptime(s: number) {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s % 60}s`;
}

export function SystemHealth() {
  const { data, isLoading, error, dataUpdatedAt } = useSystemHealth();

  return (
    <div className="p-6 space-y-6" data-testid="system-health">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">System Health</h2>
        {dataUpdatedAt > 0 && (
          <span className="text-xs text-gray-600">
            Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 rounded-xl bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}

      {data && (
        <>
          {/* Overall status banner */}
          <div className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${
            data.status === 'healthy'
              ? 'border-[#14F195]/20 bg-[#14F195]/5'
              : 'border-red-500/20 bg-red-500/5'
          }`}>
            <span className={`w-2.5 h-2.5 rounded-full ${data.status === 'healthy' ? 'bg-[#14F195] animate-pulse' : 'bg-red-500'}`} />
            <span className="text-sm font-medium capitalize">{data.status}</span>
            <span className="ml-auto text-xs text-gray-500">{new Date(data.timestamp).toLocaleString()}</span>
          </div>

          {/* Services */}
          <div className="space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-widest">Services</p>
            {Object.entries(data.services).map(([name, status]) => (
              <ServiceBadge key={name} name={name} status={status} />
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <MetricCard label="API Uptime" value={fmtUptime(data.uptime_seconds)} />
            <MetricCard label="Bot Uptime" value={fmtUptime(data.bot_uptime_seconds)} />
            <MetricCard
              label="Review Queue"
              value={data.queue_depth}
              sub={data.queue_depth > 0 ? 'pending reviews' : 'queue clear'}
            />
            <MetricCard label="WS Connections" value={data.active_websocket_connections} />
            <MetricCard label="Audit Events" value={data.webhook_events_processed} sub="all-time" />
            <MetricCard
              label="GitHub Webhook"
              value={data.github_webhook_status}
            />
          </div>
        </>
      )}
    </div>
  );
}
