/**
 * Open-source project marketplace — discover GitHub repos, fund goals, track contributions.
 */
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Repo {
  id: string;
  name: string;
  full_name: string;
  description: string;
  language: string;
  stars: number;
  forks: number;
  github_url: string;
  owner_wallet: string;
  goal_amount: number;
  current_amount: number;
  progress_pct: number;
  contributor_count: number;
  created_at: string;
}

interface RepoListResponse {
  items: Repo[];
  total: number;
}

interface Contributor {
  wallet: string;
  amount: number;
  pct: number;
}

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function fetchRepos(
  language: string,
  minStars: string,
  sort: string,
): Promise<RepoListResponse> {
  const p = new URLSearchParams();
  if (language) p.set('language', language);
  if (minStars) p.set('min_stars', minStars);
  if (sort) p.set('sort', sort);
  const res = await fetch(`/api/repos?${p.toString()}`);
  if (!res.ok) return { items: [], total: 0 };
  return res.json();
}

async function fetchContributors(repoId: string): Promise<{ contributors: Contributor[] }> {
  const res = await fetch(`/api/repos/${repoId}/contributors`);
  if (!res.ok) return { contributors: [] };
  return res.json();
}

async function postFund(
  repoId: string,
  payload: { funder_wallet: string; amount: number; tx_signature: string },
) {
  const res = await fetch(`/api/repos/${repoId}/fund`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Fund failed');
  return res.json();
}

async function postRegister(payload: {
  github_url: string;
  goal_amount: number;
  owner_wallet: string;
  description?: string;
}) {
  const res = await fetch('/api/repos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Register failed');
  return res.json();
}

// ---------------------------------------------------------------------------
// Language colour map
// ---------------------------------------------------------------------------

const LANG_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Rust: 'bg-orange-500',
  Python: 'bg-green-500',
  Go: 'bg-cyan-500',
  C: 'bg-gray-500',
};
function langColor(lang: string) {
  return LANG_COLORS[lang] ?? 'bg-purple-500';
}

// ---------------------------------------------------------------------------
// RepoCard
// ---------------------------------------------------------------------------

function RepoCard({ repo, onClick }: { repo: Repo; onClick: () => void }) {
  const isFull = repo.progress_pct >= 100;
  return (
    <div
      data-testid={`repo-card-${repo.id}`}
      onClick={onClick}
      className="bg-[#0d0d1a] border border-white/10 rounded-xl p-5 cursor-pointer hover:border-[#14F195]/40 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-white truncate">{repo.name}</p>
          <p className="text-xs text-white/40 truncate">{repo.full_name}</p>
        </div>
        {isFull && (
          <span
            data-testid={`goal-met-${repo.id}`}
            className="shrink-0 text-xs bg-[#14F195]/20 text-[#14F195] rounded-full px-2 py-0.5"
          >
            Goal Met
          </span>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-white/60 line-clamp-2 mb-4">{repo.description}</p>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4 text-xs text-white/50">
        <span className={`inline-block w-2 h-2 rounded-full ${langColor(repo.language)}`} />
        <span>{repo.language}</span>
        <span>⭐ {repo.stars.toLocaleString()}</span>
        <span>🍴 {repo.forks.toLocaleString()}</span>
      </div>

      {/* Funding progress */}
      <div>
        <div className="flex justify-between text-xs text-white/50 mb-1">
          <span>
            {repo.current_amount.toLocaleString()} / {repo.goal_amount.toLocaleString()} USDC
          </span>
          <span>{repo.progress_pct}%</span>
        </div>
        <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div
            data-testid={`progress-bar-${repo.id}`}
            className="h-full bg-[#14F195] rounded-full transition-all"
            style={{ width: `${Math.min(repo.progress_pct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ContributorList
// ---------------------------------------------------------------------------

function ContributorList({ repoId }: { repoId: string }) {
  const { data } = useQuery({
    queryKey: ['contributors', repoId],
    queryFn: () => fetchContributors(repoId),
  });
  const list = data?.contributors ?? [];
  if (!list.length) return <p className="text-sm text-white/40">No contributors yet.</p>;
  return (
    <ul data-testid="contributor-list" className="space-y-2">
      {list.map((c, i) => (
        <li key={i} className="flex items-center justify-between text-sm">
          <span className="font-mono text-white/70 truncate max-w-[180px]">{c.wallet}</span>
          <span className="text-[#14F195]">{c.pct}%</span>
          <span className="text-white/50">{c.amount.toLocaleString()} USDC</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// FundModal
// ---------------------------------------------------------------------------

function FundModal({
  repo,
  onClose,
}: {
  repo: Repo;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState('');
  const [wallet, setWallet] = useState('');
  const [success, setSuccess] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      postFund(repo.id, {
        funder_wallet: wallet || 'anonymous',
        amount: Number(amount),
        tx_signature: `sig-${Date.now()}`,
      }),
    onSuccess: () => {
      setSuccess(true);
      qc.invalidateQueries({ queryKey: ['repos'] });
      qc.invalidateQueries({ queryKey: ['contributors', repo.id] });
    },
  });

  return (
    <div
      data-testid="fund-modal"
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-1">Fund {repo.name}</h2>
        <p className="text-sm text-white/50 mb-5">
          Goal: {repo.goal_amount.toLocaleString()} USDC — {repo.progress_pct}% funded
        </p>

        {success ? (
          <div data-testid="fund-success" className="text-center py-4">
            <p className="text-[#14F195] font-semibold text-lg mb-2">Funded!</p>
            <p className="text-white/60 text-sm">Your contribution has been recorded.</p>
            <button
              onClick={onClose}
              className="mt-4 px-4 py-2 bg-[#14F195]/20 text-[#14F195] rounded-lg text-sm"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-5">
              <div>
                <label className="text-xs text-white/50 mb-1 block">Amount (USDC)</label>
                <input
                  data-testid="fund-amount-input"
                  type="number"
                  min="1"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40"
                />
              </div>
              <div>
                <label className="text-xs text-white/50 mb-1 block">Your wallet (optional)</label>
                <input
                  data-testid="fund-wallet-input"
                  type="text"
                  value={wallet}
                  onChange={(e) => setWallet(e.target.value)}
                  placeholder="Solana wallet address"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-white/60 text-sm hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                data-testid="confirm-fund"
                disabled={!amount || Number(amount) <= 0 || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="flex-1 px-4 py-2 bg-[#14F195] text-black font-semibold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {mutation.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DetailModal
// ---------------------------------------------------------------------------

function DetailModal({ repo, onClose }: { repo: Repo; onClose: () => void }) {
  const [fundOpen, setFundOpen] = useState(false);

  return (
    <>
      <div
        data-testid="repo-detail-modal"
        className="fixed inset-0 bg-black/70 flex items-center justify-center z-40 p-4"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2
                data-testid="detail-repo-name"
                className="text-xl font-bold text-white"
              >
                {repo.name}
              </h2>
              <a
                href={repo.github_url}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-white/40 hover:text-[#14F195]"
              >
                {repo.full_name}
              </a>
            </div>
            <button
              data-testid="close-detail-modal"
              onClick={onClose}
              className="text-white/40 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Description */}
          <p
            data-testid="detail-description"
            className="text-sm text-white/70 mb-5"
          >
            {repo.description}
          </p>

          {/* Progress */}
          <div data-testid="detail-progress" className="mb-5">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-white/60">
                {repo.current_amount.toLocaleString()} / {repo.goal_amount.toLocaleString()} USDC
              </span>
              <span className="text-[#14F195] font-semibold">{repo.progress_pct}%</span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#14F195] rounded-full"
                style={{ width: `${Math.min(repo.progress_pct, 100)}%` }}
              />
            </div>
          </div>

          {/* Meta stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Stars', value: repo.stars.toLocaleString() },
              { label: 'Forks', value: repo.forks.toLocaleString() },
              { label: 'Contributors', value: repo.contributor_count },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/5 rounded-lg p-3 text-center">
                <p className="text-white font-semibold">{value}</p>
                <p className="text-xs text-white/40 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Contributor distribution */}
          <div className="mb-5">
            <h3 className="text-sm font-semibold text-white/70 mb-3">Payment Distribution</h3>
            <ContributorList repoId={repo.id} />
          </div>

          {/* Actions */}
          <button
            data-testid="open-fund-modal"
            onClick={() => setFundOpen(true)}
            disabled={repo.progress_pct >= 100}
            className="w-full py-2.5 bg-[#14F195] text-black font-semibold rounded-xl text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {repo.progress_pct >= 100 ? 'Fully Funded' : 'Fund This Project'}
          </button>
        </div>
      </div>

      {fundOpen && <FundModal repo={repo} onClose={() => setFundOpen(false)} />}
    </>
  );
}

// ---------------------------------------------------------------------------
// RegisterModal
// ---------------------------------------------------------------------------

function RegisterModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [githubUrl, setGithubUrl] = useState('');
  const [goalAmount, setGoalAmount] = useState('');
  const [ownerWallet, setOwnerWallet] = useState('');
  const [description, setDescription] = useState('');

  const isValid =
    githubUrl.trim().startsWith('https://github.com/') &&
    Number(goalAmount) > 0 &&
    ownerWallet.trim().length >= 32;

  const mutation = useMutation({
    mutationFn: () =>
      postRegister({
        github_url: githubUrl.trim(),
        goal_amount: Number(goalAmount),
        owner_wallet: ownerWallet.trim(),
        description: description.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['repos'] });
      onClose();
    },
  });

  return (
    <div
      data-testid="register-modal"
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-[#0d0d1a] border border-white/10 rounded-2xl p-6 w-full max-w-md">
        <h2 className="text-lg font-bold text-white mb-5">Register Repo &amp; Set Funding Goal</h2>

        <div className="space-y-4 mb-5">
          <div>
            <label className="text-xs text-white/50 mb-1 block">GitHub URL *</label>
            <input
              data-testid="register-github-url"
              type="url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Funding Goal (USDC) *</label>
            <input
              data-testid="register-goal-amount"
              type="number"
              min="1"
              value={goalAmount}
              onChange={(e) => setGoalAmount(e.target.value)}
              placeholder="e.g. 5000"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Owner Wallet *</label>
            <input
              data-testid="register-owner-wallet"
              type="text"
              value={ownerWallet}
              onChange={(e) => setOwnerWallet(e.target.value)}
              placeholder="Solana wallet address"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40"
            />
          </div>
          <div>
            <label className="text-xs text-white/50 mb-1 block">Description (optional)</label>
            <textarea
              data-testid="register-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What will the funds be used for?"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-[#14F195]/40 resize-none"
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-white/60 text-sm hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            data-testid="submit-register"
            disabled={!isValid || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="flex-1 px-4 py-2 bg-[#9945FF] text-white font-semibold rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? 'Submitting…' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

const LANGUAGES = ['TypeScript', 'Rust', 'Python', 'JavaScript', 'Go', 'C'];
const STAR_OPTIONS = [
  { label: 'Any', value: '' },
  { label: '500+', value: '500' },
  { label: '1 000+', value: '1000' },
  { label: '2 000+', value: '2000' },
  { label: '5 000+', value: '5000' },
];
const SORT_OPTIONS = [
  { label: 'Trending', value: 'trending' },
  { label: 'Most Funded', value: 'most_funded' },
  { label: 'Newest', value: 'newest' },
  { label: 'Most Stars', value: 'stars' },
];

export function RepoMarketplacePage() {
  const [language, setLanguage] = useState('');
  const [minStars, setMinStars] = useState('');
  const [sort, setSort] = useState('trending');
  const [detailRepo, setDetailRepo] = useState<Repo | null>(null);
  const [registerOpen, setRegisterOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['repos', language, minStars, sort],
    queryFn: () => fetchRepos(language, minStars, sort),
    staleTime: 30_000,
  });

  const repos = data?.items ?? [];

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Hero */}
      <div className="px-6 pt-16 pb-10 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Open-Source Funding</h1>
            <p className="text-white/50 text-sm">
              Discover projects, fund features &amp; maintenance, earn contributor rewards.
            </p>
          </div>
          <button
            data-testid="register-repo-btn"
            onClick={() => setRegisterOpen(true)}
            className="shrink-0 px-5 py-2.5 bg-[#9945FF] text-white font-semibold rounded-xl text-sm hover:bg-[#9945FF]/80 transition-colors"
          >
            + Register Repo
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 pb-6 max-w-6xl mx-auto flex flex-wrap gap-3">
        <select
          data-testid="language-filter"
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
        >
          <option value="">All languages</option>
          {LANGUAGES.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </select>

        <select
          data-testid="stars-filter"
          value={minStars}
          onChange={(e) => setMinStars(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
        >
          {STAR_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <select
          data-testid="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:outline-none"
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      <div className="px-6 pb-16 max-w-6xl mx-auto">
        {isLoading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 rounded-full border-2 border-[#14F195] border-t-transparent animate-spin" />
          </div>
        ) : repos.length === 0 ? (
          <div
            data-testid="empty-repos"
            className="text-center py-20 text-white/40"
          >
            <p className="text-lg mb-2">No repos found</p>
            <p className="text-sm">Try adjusting your filters or register a new repo.</p>
          </div>
        ) : (
          <div
            data-testid="repo-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5"
          >
            {repos.map((repo) => (
              <RepoCard
                key={repo.id}
                repo={repo}
                onClick={() => setDetailRepo(repo)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {detailRepo && (
        <DetailModal repo={detailRepo} onClose={() => setDetailRepo(null)} />
      )}
      {registerOpen && (
        <RegisterModal onClose={() => setRegisterOpen(false)} />
      )}
    </div>
  );
}

export default RepoMarketplacePage;
