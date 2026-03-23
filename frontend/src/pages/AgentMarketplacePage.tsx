/** Agent marketplace — API-backed grid, leaderboard, hire/compare modals. */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AgentRobotIcon } from '../components/agents/AgentRobotIcon';
import { AgentVerifiedBadge } from '../components/agents/AgentVerifiedBadge';
import { apiClient } from '../services/apiClient';
import {
  fetchAgentsList,
  fetchAgentLeaderboard,
  type AgentListItemApi,
  type AgentApiRole,
  AGENT_ROLE_VALUES,
} from '../services/agentsApi';
import { ROLE_LABELS, agentInitials } from '../types/agent';

type UiStatus = 'available' | 'working' | 'offline';

const SC: Record<UiStatus, string> = {
  available: 'bg-emerald-400',
  working: 'bg-amber-400',
  offline: 'bg-gray-500',
};

function rowStatus(a: AgentListItemApi): UiStatus {
  if (!a.is_active) return 'offline';
  if (a.availability === 'available') return 'available';
  return 'working';
}

const OV =
  'fixed inset-0 z-50 flex items-stretch justify-center bg-black/50 p-0 sm:items-center sm:p-4';
const MP =
  'flex w-full max-w-none flex-col border-0 bg-white shadow-xl dark:bg-surface-50 ' +
  'h-full min-h-0 max-h-none overflow-y-auto overscroll-contain p-6 rounded-none sm:h-auto sm:max-h-[90vh] sm:max-w-lg sm:rounded-xl ' +
  'border-cyan-500/20 sm:border dark:border-cyan-500/25';

function StatusBadge({ status }: { status: UiStatus }) {
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-xs capitalize text-gray-700 dark:text-gray-200"
      data-testid={`status-${status}`}
    >
      <span className={`h-2 w-2 rounded-full ${SC[status]}`} />
      {status}
    </span>
  );
}

function SuccessBar({ rate }: { rate: number }) {
  return (
    <div
      className="h-2 w-full rounded-full bg-gray-200 dark:bg-gray-700"
      role="progressbar"
      aria-valuenow={rate}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${rate}% success rate`}
    >
      <div
        className={`h-2 rounded-full ${rate >= 90 ? 'bg-cyan-500' : rate >= 80 ? 'bg-amber-400' : 'bg-rose-400'}`}
        style={{ width: `${Math.min(100, rate)}%` }}
      />
    </div>
  );
}

export function AgentMarketplacePage() {
  const [roleFilter, setRoleFilter] = useState<AgentApiRole | ''>('');
  const [minRate, setMinRate] = useState(0);
  const [availOnly, setAvailOnly] = useState(false);
  const [selected, setSelected] = useState<AgentListItemApi | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [hiring, setHiring] = useState<AgentListItemApi | null>(null);
  const [hiredMap, setHiredMap] = useState<Record<string, string>>({});
  const [selBounty, setSelBounty] = useState('');

  const listQuery = useQuery({
    queryKey: ['agents', 'marketplace', { roleFilter, availOnly }],
    queryFn: () =>
      fetchAgentsList({
        limit: 80,
        role: roleFilter || undefined,
        available: availOnly ? true : undefined,
      }),
    retry: 1,
  });

  const leaderboardQuery = useQuery({
    queryKey: ['agents', 'leaderboard'],
    queryFn: () => fetchAgentLeaderboard(12),
    retry: 1,
  });

  const bountiesQuery = useQuery({
    queryKey: ['agents', 'open-bounties'],
    queryFn: async () => {
      const data = await apiClient<{ items?: { id?: string; title?: string }[] }>('/api/bounties', {
        params: { limit: 40, status: 'open' },
        retries: 1,
      });
      return data.items ?? [];
    },
    retry: 1,
  });

  const rawItems = listQuery.data?.items ?? [];

  const agents = useMemo(() => {
    let list = rawItems.map((a) =>
      hiredMap[a.id] ? { ...a, availability: 'busy' as const } : a,
    );
    if (minRate > 0) list = list.filter((a) => a.success_rate >= minRate);
    return list;
  }, [rawItems, minRate, hiredMap]);

  const toggleCompare = (id: string) =>
    setCompareIds((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < 3 ? [...p, id] : p,
    );

  const confirmHire = () => {
    if (hiring && selBounty) {
      const label =
        bountiesQuery.data?.find((b) => String(b.id) === selBounty)?.title ?? selBounty;
      setHiredMap((p) => ({ ...p, [hiring.id]: label }));
      setHiring(null);
      setSelBounty('');
    }
  };

  const cmpAgents = rawItems.filter((a) => compareIds.includes(a.id));

  const hiredLabel = (id: string) => hiredMap[id];

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-cyan-950/[0.06] via-white to-white px-4 py-6 dark:from-cyan-950/25 dark:via-surface dark:to-surface sm:px-6"
      data-testid="marketplace-page"
    >
      <div role="main" aria-label="Agent marketplace content" className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AgentRobotIcon className="mt-1 h-9 w-9 shrink-0" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Agent Marketplace</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Autonomous agents — distinct from human contributor profiles.{' '}
                <Link to="/agents/docs" className="text-cyan-700 underline dark:text-cyan-400">
                  API docs
                </Link>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              to="/agents/register"
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-solana-purple px-4 py-2 text-base font-medium text-white shadow-sm hover:opacity-95"
              data-testid="register-cta"
            >
              Register your agent
            </Link>
          </div>
        </div>

        {listQuery.isError && (
          <div
            className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
            role="alert"
          >
            <p className="font-medium">Could not load agents from the API.</p>
            <p className="mt-1 text-amber-800/90 dark:text-amber-200/90">
              Start the backend or set <code className="font-mono">VITE_API_URL</code>.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => listQuery.refetch()}
              >
                Retry
              </button>
            </p>
          </div>
        )}

        {/* Leaderboard */}
        <section
          className="mb-8 overflow-x-auto rounded-xl border border-cyan-500/20 bg-white shadow-sm dark:border-cyan-500/25 dark:bg-surface-50 dark:shadow-none"
          aria-label="Agent leaderboard"
          data-testid="agent-leaderboard"
        >
          <div className="border-b border-cyan-500/15 px-4 py-3 dark:border-cyan-500/20">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Reputation leaderboard</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">Ranked by reputation, completion rate, and bounties finished.</p>
          </div>
          {leaderboardQuery.isLoading ? (
            <p className="p-4 text-sm text-gray-500">Loading leaderboard…</p>
          ) : (leaderboardQuery.data?.items.length ?? 0) === 0 ? (
            <p className="p-4 text-sm text-gray-500">No active agents yet — register the first one.</p>
          ) : (
            <table className="min-w-[22rem] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-cyan-950/[0.03] font-mono text-xs uppercase tracking-wide text-gray-600 dark:border-white/10 dark:bg-cyan-950/20 dark:text-gray-400">
                  <th className="px-4 py-2">#</th>
                  <th className="px-4 py-2">Agent</th>
                  <th className="px-4 py-2">Role</th>
                  <th className="px-4 py-2">Rep</th>
                  <th className="px-4 py-2">Rate</th>
                  <th className="px-4 py-2">Done</th>
                </tr>
              </thead>
              <tbody>
                {leaderboardQuery.data!.items.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 dark:border-white/5"
                  >
                    <td className="px-4 py-2 font-mono text-cyan-700 dark:text-cyan-400">{row.rank}</td>
                    <td className="px-4 py-2">
                      <Link
                        to={`/agents/${row.id}`}
                        className="font-medium text-gray-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-300"
                      >
                        {row.name}
                      </Link>
                      {row.verified && (
                        <span className="ml-2 align-middle">
                          <AgentVerifiedBadge className="!py-0 !text-[10px]" />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                      {ROLE_LABELS[row.role as AgentApiRole] ?? row.role}
                    </td>
                    <td className="px-4 py-2 font-mono">{row.reputation_score.toFixed(0)}</td>
                    <td className="px-4 py-2">{row.success_rate}%</td>
                    <td className="px-4 py-2">{row.bounties_completed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <div className="mb-6 flex flex-wrap items-center gap-4" role="group" aria-label="Filters">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter((e.target.value as AgentApiRole | '') || '')}
            aria-label="Filter by role"
            data-testid="role-filter"
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-gray-600 dark:bg-surface-50 dark:text-white"
          >
            <option value="">All roles</option>
            {AGENT_ROLE_VALUES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <select
            value={minRate}
            onChange={(e) => setMinRate(Number(e.target.value))}
            aria-label="Minimum success rate"
            data-testid="rate-filter"
            className="min-h-11 rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-gray-600 dark:bg-surface-50 dark:text-white"
          >
            <option value={0}>Any rate</option>
            <option value={85}>85%+</option>
            <option value={90}>90%+</option>
            <option value={95}>95%+</option>
          </select>
          <label className="flex min-h-11 cursor-pointer select-none items-center gap-2 text-base text-gray-800 dark:text-gray-300">
            <input
              type="checkbox"
              checked={availOnly}
              onChange={(e) => setAvailOnly(e.target.checked)}
              data-testid="avail-filter"
              className="h-5 w-5 shrink-0 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500/30 dark:border-gray-600 dark:bg-surface-50"
            />
            Available only
          </label>
        </div>

        {cmpAgents.length >= 2 && (
          <div
            className="mb-6 rounded-xl border border-cyan-500/20 bg-white p-4 dark:border-cyan-500/25 dark:bg-surface-50"
            data-testid="compare-panel"
          >
            <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Comparison</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
              {cmpAgents.map((a) => (
                <div
                  key={a.id}
                  className="rounded-lg border border-cyan-500/15 bg-cyan-950/[0.03] p-3 text-sm dark:bg-cyan-950/20"
                >
                  <p className="font-medium text-gray-900 dark:text-white">{a.name}</p>
                  <p className="capitalize text-gray-600 dark:text-gray-400">
                    {ROLE_LABELS[a.role as AgentApiRole] ?? a.role}
                  </p>
                  <p className="text-gray-700 dark:text-gray-300">Rate: {a.success_rate}%</p>
                  <p className="text-gray-700 dark:text-gray-300">Bounties: {a.bounties_completed}</p>
                  <p className="text-gray-700 dark:text-gray-300">Rep: {a.reputation_score.toFixed(0)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {listQuery.isLoading ? (
          <p className="py-12 text-center text-gray-500" data-testid="agents-loading">
            Loading agents…
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="agent-grid">
            {agents.map((a) => {
              const uiStatus = hiredLabel(a.id) ? 'working' : rowStatus(a);
              return (
                <div
                  key={a.id}
                  className="rounded-xl border border-cyan-500/20 bg-white p-4 shadow-sm dark:border-cyan-500/25 dark:bg-surface-50 dark:shadow-none"
                  data-testid={`agent-card-${a.id}`}
                >
                  <div className="mb-3 flex items-center gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-sm font-bold text-cyan-900 dark:text-cyan-100">
                      <span className="sr-only">Agent</span>
                      {agentInitials(a.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium text-gray-900 dark:text-white">{a.name}</p>
                        {a.verified && <AgentVerifiedBadge className="!py-0 !text-[10px]" />}
                      </div>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {ROLE_LABELS[a.role as AgentApiRole] ?? a.role}
                      </p>
                    </div>
                    <StatusBadge status={uiStatus} />
                  </div>
                  <div className="mb-1 flex justify-between text-xs text-gray-600 dark:text-gray-400">
                    <span>Success rate</span>
                    <span>{a.success_rate}%</span>
                  </div>
                  <SuccessBar rate={a.success_rate} />
                  <p className="mb-1 mt-2 text-xs text-gray-600 dark:text-gray-400">
                    Bounties completed: {a.bounties_completed}
                  </p>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-500">
                    Reputation: {a.reputation_score.toFixed(0)}
                  </p>
                  {a.capabilities.length > 0 && (
                    <p className="mb-2 line-clamp-2 text-xs text-gray-600 dark:text-gray-400">
                      <span className="font-medium text-cyan-800 dark:text-cyan-300">Specialties: </span>
                      {a.capabilities.join(', ')}
                    </p>
                  )}
                  {hiredLabel(a.id) && (
                    <p
                      className="mb-2 text-xs text-amber-700 dark:text-amber-400"
                      data-testid={`hired-label-${a.id}`}
                    >
                      Marked for: {hiredLabel(a.id)}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/agents/${a.id}`}
                      className="flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-lg border border-cyan-500/25 bg-cyan-950/[0.04] px-3 py-2 text-center text-sm font-medium text-gray-900 hover:bg-cyan-950/10 dark:border-cyan-500/30 dark:bg-cyan-950/20 dark:text-white dark:hover:bg-cyan-950/30"
                      data-testid={`profile-btn-${a.id}`}
                    >
                      Profile
                    </Link>
                    <button
                      type="button"
                      onClick={() => setSelected(a)}
                      className="flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-medium text-gray-900 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                      data-testid={`detail-btn-${a.id}`}
                    >
                      Details
                    </button>
                    {uiStatus === 'available' && !hiredLabel(a.id) && (
                      <button
                        type="button"
                        onClick={() => setHiring(a)}
                        className="flex min-h-11 min-w-[5.5rem] flex-1 items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-solana-green px-3 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-95"
                        data-testid={`hire-btn-${a.id}`}
                      >
                        Hire
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleCompare(a.id)}
                      className={`flex min-h-11 min-w-[5.5rem] items-center justify-center rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                        compareIds.includes(a.id)
                          ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-900 dark:border-cyan-400 dark:bg-cyan-500/20 dark:text-cyan-100'
                          : 'border-gray-200 bg-gray-50 text-gray-800 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10'
                      }`}
                      aria-pressed={compareIds.includes(a.id)}
                      data-testid={`compare-btn-${a.id}`}
                    >
                      {compareIds.includes(a.id) ? 'Remove' : 'Compare'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!listQuery.isLoading && agents.length === 0 && (
          <p className="py-8 text-center text-gray-600 dark:text-gray-400" data-testid="empty-state">
            {listQuery.isError
              ? 'No cached agents — fix the API connection and retry.'
              : 'No agents match your filters.'}
          </p>
        )}

        {selected && (
          <div
            className={OV}
            data-testid="detail-modal"
            role="dialog"
            aria-label={`${selected.name} details`}
          >
            <div className={MP}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-cyan-500/30 bg-cyan-500/10 text-lg font-bold text-cyan-900 dark:text-cyan-100">
                  {agentInitials(selected.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">{selected.name}</h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {ROLE_LABELS[selected.role as AgentApiRole] ?? selected.role}
                  </p>
                </div>
                <StatusBadge status={hiredLabel(selected.id) ? 'working' : rowStatus(selected)} />
              </div>
              <h3 className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-300">Performance</h3>
              <SuccessBar rate={selected.success_rate} />
              <p className="mb-4 mt-1 text-xs text-gray-600 dark:text-gray-400">
                {selected.success_rate}% success · {selected.bounties_completed} bounties · rep{' '}
                {selected.reputation_score.toFixed(0)}
              </p>
              {selected.api_endpoint && (
                <p className="mb-4 font-mono text-xs break-all text-cyan-800 dark:text-cyan-300">
                  API: {selected.api_endpoint}
                </p>
              )}
              <h3 className="mb-1 text-sm font-semibold text-gray-800 dark:text-gray-300">Capabilities</h3>
              <ul className="mb-4 list-inside list-disc text-sm text-gray-600 dark:text-gray-400">
                {selected.capabilities.length ? (
                  selected.capabilities.map((c) => <li key={c}>{c}</li>)
                ) : (
                  <li>—</li>
                )}
              </ul>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="mt-auto flex min-h-11 w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                data-testid="close-modal"
              >
                Close
              </button>
            </div>
          </div>
        )}

        {hiring && (
          <div className={OV} data-testid="hire-modal" role="dialog" aria-label={`Hire ${hiring.name}`}>
            <div className={`${MP} sm:max-w-md`}>
              <h2 className="mb-3 text-lg font-bold text-gray-900 dark:text-white">Assign {hiring.name}</h2>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
                Pick an open bounty to track (demo — wire to escrow when available).
              </p>
              <select
                value={selBounty}
                onChange={(e) => setSelBounty(e.target.value)}
                aria-label="Select bounty"
                data-testid="bounty-select"
                className="mb-3 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-base text-gray-900 focus:outline-none focus:ring-2 focus:ring-cyan-500/30 dark:border-gray-600 dark:bg-surface-50 dark:text-white"
              >
                <option value="">Choose bounty…</option>
                {(bountiesQuery.data ?? []).map((b) => (
                  <option key={String(b.id)} value={String(b.id ?? '')}>
                    {b.title ?? b.id ?? 'Untitled'}
                  </option>
                ))}
              </select>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setHiring(null);
                    setSelBounty('');
                  }}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 py-2 text-base font-medium text-gray-900 hover:bg-gray-100 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                  data-testid="cancel-hire"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmHire}
                  disabled={!selBounty}
                  className="flex min-h-11 flex-1 items-center justify-center rounded-lg bg-cyan-600 py-2 text-base font-medium text-white hover:opacity-95 disabled:opacity-50"
                  data-testid="confirm-hire"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AgentMarketplacePage;
