import { useState, useEffect, useCallback } from 'react';
import {
  searchRepos,
  createFundingGoal,
  listFundingGoals,
  getRepoLeaderboard,
  type SearchReposParams,
  type CreateFundingGoalPayload,
} from '../api/marketplace';
import type { MarketplaceRepo, FundingGoal, RepoLeaderboardEntry } from '../types/marketplace';

// ── Shared helpers ──

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ── Repo Card ──

function RepoCard({ repo, onSelect }: { repo: MarketplaceRepo; onSelect: (r: MarketplaceRepo) => void }) {
  return (
    <div
      className="border border-gray-700 rounded-lg p-4 bg-gray-800 hover:border-indigo-500 cursor-pointer transition"
      onClick={() => onSelect(repo)}
    >
      <div className="flex items-center gap-3 mb-2">
        {repo.owner_avatar_url && (
          <img src={repo.owner_avatar_url} alt={repo.owner_login} className="w-8 h-8 rounded-full" />
        )}
        <div className="text-sm text-gray-400 truncate">{repo.full_name}</div>
      </div>
      <p className="text-gray-300 text-sm mb-3 line-clamp-2">{repo.description || 'No description'}</p>
      <div className="flex items-center gap-4 text-xs text-gray-500">
        {repo.language && <span className="text-indigo-400">{repo.language}</span>}
        <span>⭐ {formatNumber(repo.stars)}</span>
        <span>🎯 {repo.active_goals} goals</span>
        <span>${formatNumber(repo.total_funded_usdc)} USDC</span>
      </div>
    </div>
  );
}

// ── Goal Card ──

function GoalCard({ goal }: { goal: FundingGoal }) {
  const pct = goal.target_amount > 0 ? Math.min((goal.current_amount / goal.target_amount) * 100, 100) : 0;
  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800">
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-white">{goal.title}</h4>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            goal.status === 'active'
              ? 'bg-green-900 text-green-300'
              : goal.status === 'completed'
              ? 'bg-blue-900 text-blue-300'
              : 'bg-gray-700 text-gray-400'
          }`}
        >
          {goal.status}
        </span>
      </div>
      <p className="text-gray-400 text-sm mb-3 line-clamp-2">{goal.description}</p>
      <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>
          {formatNumber(goal.current_amount)} / {formatNumber(goal.target_amount)} {goal.target_token}
        </span>
        <span>{goal.contributor_count} contributors</span>
      </div>
      {goal.deadline && (
        <div className="text-xs text-gray-500 mt-1">Deadline: {new Date(goal.deadline).toLocaleDateString()}</div>
      )}
    </div>
  );
}

// ── Create Goal Modal ──

function CreateGoalModal({
  repoId,
  onClose,
  onCreated,
}: {
  repoId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'USDC' | 'FNDRY'>('USDC');
  const [deadline, setDeadline] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!title || !description || !amount) {
      setError('All fields are required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload: CreateFundingGoalPayload = {
        repo_id: repoId,
        title,
        description,
        target_amount: Number(amount),
        target_token: token,
      };
      if (deadline) payload.deadline = deadline;
      await createFundingGoal(payload);
      onCreated();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-white mb-4">Create Funding Goal</h3>
        {error && <div className="text-red-400 text-sm mb-3">{error}</div>}
        <input
          className="w-full bg-gray-800 text-white rounded p-2 mb-3"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="w-full bg-gray-800 text-white rounded p-2 mb-3"
          placeholder="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-2 mb-3">
          <input
            type="number"
            className="flex-1 bg-gray-800 text-white rounded p-2"
            placeholder="Target amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <select
            className="bg-gray-800 text-white rounded p-2"
            value={token}
            onChange={(e) => setToken(e.target.value as 'USDC' | 'FNDRY')}
          >
            <option value="USDC">USDC</option>
            <option value="FNDRY">FNDRY</option>
          </select>
        </div>
        <input
          type="date"
          className="w-full bg-gray-800 text-white rounded p-2 mb-4"
          value={deadline}
          onChange={(e) => setDeadline(e.target.value)}
        />
        <div className="flex gap-2 justify-end">
          <button className="px-4 py-2 text-gray-400 hover:text-white" onClick={onClose}>
            Cancel
          </button>
          <button
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Creating...' : 'Create Goal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leaderboard ──

function Leaderboard({ entries }: { entries: RepoLeaderboardEntry[] }) {
  if (!entries.length) return <p className="text-gray-500 text-sm">No contributors yet.</p>;
  return (
    <div className="space-y-2">
      {entries.map((e) => (
        <div key={e.contributor_id} className="flex items-center gap-3 text-sm">
          <span className="text-gray-500 w-6">#{e.rank}</span>
          {e.avatar_url && <img src={e.avatar_url} alt={e.username} className="w-6 h-6 rounded-full" />}
          <span className="text-white flex-1">{e.username || e.contributor_id.slice(0, 8)}</span>
          <span className="text-indigo-400">${formatNumber(e.total_contributed)}</span>
          <span className="text-gray-500">{e.goals_funded} goals</span>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ──

export default function Marketplace() {
  const [repos, setRepos] = useState<MarketplaceRepo[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState<SearchReposParams>({ limit: 20 });

  const [selectedRepo, setSelectedRepo] = useState<MarketplaceRepo | null>(null);
  const [goals, setGoals] = useState<FundingGoal[]>([]);
  const [leaderboard, setLeaderboard] = useState<RepoLeaderboardEntry[]>([]);
  const [showCreateGoal, setShowCreateGoal] = useState(false);

  const [searchQ, setSearchQ] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [minStars, setMinStars] = useState('');

  const doSearch = useCallback(async (p: SearchReposParams) => {
    setLoading(true);
    try {
      const res = await searchRepos(p);
      setRepos(res.repos);
      setTotal(res.total);
    } catch {
      // silently ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    doSearch(params);
  }, [params, doSearch]);

  const loadRepoDetails = async (repo: MarketplaceRepo) => {
    setSelectedRepo(repo);
    try {
      const [goalsRes, lb] = await Promise.all([
        listFundingGoals({ repo_id: repo.id }),
        getRepoLeaderboard(repo.id),
      ]);
      setGoals(goalsRes.goals);
      setLeaderboard(lb);
    } catch {
      // ignore
    }
  };

  const handleSearch = () => {
    const p: SearchReposParams = { limit: 20 };
    if (searchQ) p.q = searchQ;
    if (langFilter) p.language = langFilter;
    if (minStars) p.min_stars = Number(minStars);
    setParams(p);
  };

  if (selectedRepo) {
    return (
      <div className="max-w-5xl mx-auto p-6">
        <button
          className="text-indigo-400 hover:text-white mb-4 text-sm"
          onClick={() => setSelectedRepo(null)}
        >
          ← Back to Marketplace
        </button>
        <div className="flex items-center gap-4 mb-6">
          {selectedRepo.owner_avatar_url && (
            <img src={selectedRepo.owner_avatar_url} className="w-12 h-12 rounded-full" alt="" />
          )}
          <div>
            <h2 className="text-xl font-bold text-white">{selectedRepo.full_name}</h2>
            <p className="text-gray-400 text-sm">{selectedRepo.description}</p>
          </div>
          <a
            href={selectedRepo.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto text-indigo-400 hover:text-indigo-300 text-sm"
          >
            View on GitHub →
          </a>
        </div>

        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">Funding Goals</h3>
          <button
            className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-500"
            onClick={() => setShowCreateGoal(true)}
          >
            + New Goal
          </button>
        </div>

        {goals.length === 0 ? (
          <p className="text-gray-500 text-sm mb-8">No funding goals yet. Be the first to create one!</p>
        ) : (
          <div className="grid gap-4 mb-8 md:grid-cols-2">
            {goals.map((g) => (
              <GoalCard key={g.id} goal={g} />
            ))}
          </div>
        )}

        <h3 className="text-lg font-semibold text-white mb-3">Top Contributors</h3>
        <Leaderboard entries={leaderboard} />

        {showCreateGoal && (
          <CreateGoalModal
            repoId={selectedRepo.id}
            onClose={() => setShowCreateGoal(false)}
            onCreated={() => loadRepoDetails(selectedRepo)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-6">Repo Marketplace</h1>

      {/* Search & Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <input
          className="flex-1 min-w-[200px] bg-gray-800 text-white rounded px-3 py-2"
          placeholder="Search repos..."
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <input
          className="bg-gray-800 text-white rounded px-3 py-2 w-32"
          placeholder="Language"
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
        />
        <input
          type="number"
          className="bg-gray-800 text-white rounded px-3 py-2 w-28"
          placeholder="Min ⭐"
          value={minStars}
          onChange={(e) => setMinStars(e.target.value)}
        />
        <button
          className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-500"
          onClick={handleSearch}
        >
          Search
        </button>
      </div>

      {loading ? (
        <p className="text-gray-500">Loading...</p>
      ) : repos.length === 0 ? (
        <p className="text-gray-500">No repos found. Try adjusting your filters.</p>
      ) : (
        <>
          <p className="text-gray-500 text-sm mb-4">{total} repos found</p>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {repos.map((r) => (
              <RepoCard key={r.id} repo={r} onSelect={loadRepoDetails} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
