/** Audit log panel — timestamped admin action log with search and filtering. */
import { useState } from 'react';
import { useAuditLog } from '../../hooks/useAdminData';

const EVENT_COLORS: Record<string, string> = {
  admin_bounty_updated:       'text-[#9945FF]',
  admin_bounty_closed:        'text-red-400',
  admin_contributor_banned:   'text-red-400',
  admin_contributor_unbanned: 'text-[#14F195]',
};

function eventColor(event: string) {
  return EVENT_COLORS[event] ?? 'text-gray-400';
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function AuditLogPanel() {
  const [eventFilter, setEventFilter] = useState('');
  const [limit, setLimit] = useState(50);

  const { data, isLoading, error } = useAuditLog(limit, eventFilter || undefined);

  return (
    <div className="p-6 space-y-4" data-testid="audit-log-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Audit Log</h2>
        {data && (
          <span className="text-xs text-gray-500">
            {data.total} entries (showing {data.entries.length})
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          placeholder="Filter by event name…"
          value={eventFilter}
          onChange={e => setEventFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-[#9945FF]/50 w-64"
          data-testid="audit-event-filter"
        />
        <select
          value={limit}
          onChange={e => setLimit(Number(e.target.value))}
          className="rounded-lg border border-white/10 bg-[#0a0a14] px-3 py-1.5 text-sm text-white focus:outline-none"
          data-testid="audit-limit-select"
        >
          {[25, 50, 100, 200].map(n => (
            <option key={n} value={n}>Last {n}</option>
          ))}
        </select>
      </div>

      {/* Log entries */}
      {isLoading && (
        <div className="space-y-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-white/[0.03] animate-pulse" />
          ))}
        </div>
      )}

      {error && <p className="text-sm text-red-400">{(error as Error).message}</p>}

      {data && data.entries.length === 0 && (
        <div className="rounded-xl border border-white/5 bg-white/[0.03] py-12 text-center">
          <p className="text-sm text-gray-500">
            {eventFilter ? `No entries matching "${eventFilter}"` : 'No audit events recorded yet'}
          </p>
        </div>
      )}

      {data && data.entries.length > 0 && (
        <div className="rounded-xl border border-white/5 overflow-hidden" data-testid="audit-table">
          {data.entries.map((entry, i) => (
            <div
              key={i}
              className="flex items-start gap-3 px-4 py-3 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors text-xs"
              data-testid={`audit-entry-${i}`}
            >
              {/* Timestamp */}
              <span className="text-gray-600 w-20 shrink-0 tabular-nums"
                title={new Date(entry.timestamp).toLocaleString()}>
                {relativeTime(entry.timestamp)}
              </span>

              {/* Event */}
              <span className={`font-mono font-medium shrink-0 w-48 truncate ${eventColor(entry.event)}`}>
                {entry.event}
              </span>

              {/* Actor + role */}
              <span className="text-gray-500 shrink-0 flex items-center gap-1">
                {entry.actor}
                {entry.role && entry.role !== 'admin' && (
                  <span className="text-[10px] text-gray-600 border border-white/10 rounded px-1">
                    {entry.role}
                  </span>
                )}
              </span>

              {/* Details */}
              <div className="flex-1 flex flex-wrap gap-x-3 gap-y-0.5 text-gray-500 min-w-0">
                {Object.entries(entry.details).map(([k, v]) => (
                  <span key={k} className="truncate">
                    <span className="text-gray-600">{k}:</span>{' '}
                    <span className="text-gray-400">
                      {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
