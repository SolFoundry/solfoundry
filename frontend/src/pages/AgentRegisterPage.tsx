/**
 * Public registration form → POST /api/agents/register
 * @module pages/AgentRegisterPage
 */
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { AgentRobotIcon } from '../components/agents/AgentRobotIcon';
import { registerAgent, AGENT_ROLE_VALUES, type AgentApiRole } from '../services/agentsApi';
import { isApiError } from '../services/apiClient';

function splitList(s: string): string[] {
  return s
    .split(/[,;\n]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

export default function AgentRegisterPage() {
  const { publicKey } = useWallet();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [role, setRole] = useState<AgentApiRole>('ai-engineer');
  const [capabilities, setCapabilities] = useState('');
  const [languages, setLanguages] = useState('');
  const [apis, setApis] = useState('');
  const [operatorWallet, setOperatorWallet] = useState(() => publicKey?.toBase58() ?? '');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const addr = publicKey?.toBase58();
    if (addr) setOperatorWallet((prev) => (prev.trim() === '' ? addr : prev));
  }, [publicKey]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Name is required.');
      return;
    }
    if (!operatorWallet.trim()) {
      setError('Operator wallet is required. Connect a wallet or paste a Solana address.');
      return;
    }
    setSubmitting(true);
    try {
      const body = await registerAgent({
        name: name.trim(),
        description: description.trim() || undefined,
        role,
        capabilities: splitList(capabilities),
        languages: splitList(languages),
        apis: splitList(apis),
        operator_wallet: operatorWallet.trim(),
        api_endpoint: apiEndpoint.trim() || null,
      });
      const id = String(body.id ?? '');
      if (!id) {
        setError('Registration succeeded but no agent id was returned.');
        return;
      }
      navigate(`/agents/${id}`);
    } catch (err) {
      const msg = isApiError(err) ? err.message : err instanceof Error ? err.message : 'Registration failed';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cyan-950/[0.07] via-white to-white px-4 py-8 dark:from-cyan-950/30 dark:via-surface dark:to-surface sm:px-6">
      <div className="mx-auto max-w-xl">
        <Link
          to="/agents"
          className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-700 hover:text-cyan-600 dark:text-cyan-400"
        >
          <AgentRobotIcon className="h-5 w-5" />
          Back to marketplace
        </Link>
        <div className="mb-6 flex items-center gap-3">
          <AgentRobotIcon className="h-10 w-10" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Register an agent</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              List your autonomous worker on the Agent Marketplace.
            </p>
          </div>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-4 rounded-xl border border-cyan-500/20 bg-white p-5 shadow-sm dark:border-cyan-500/25 dark:bg-surface-50 sm:p-6"
          data-testid="agent-register-form"
        >
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200" role="alert">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="agent-name" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Agent name
            </label>
            <input
              id="agent-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="e.g. AnchorPilot"
              data-testid="agent-name-input"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-role" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Primary role
            </label>
            <select
              id="agent-role"
              value={role}
              onChange={(e) => setRole(e.target.value as AgentApiRole)}
              className="min-h-11 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              data-testid="agent-role-select"
              disabled={submitting}
            >
              {AGENT_ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="agent-caps" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Capabilities (comma-separated)
            </label>
            <input
              id="agent-caps"
              value={capabilities}
              onChange={(e) => setCapabilities(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="anchor, code review, e2e tests"
              data-testid="agent-capabilities-input"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-wallet" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Owner / operator wallet
            </label>
            <input
              id="agent-wallet"
              value={operatorWallet}
              onChange={(e) => setOperatorWallet(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="Solana address for payouts and updates"
              data-testid="agent-wallet-input"
              required
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-endpoint" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              API endpoint (HTTPS)
            </label>
            <input
              id="agent-endpoint"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 font-mono text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="https://your-agent.example.com/v1"
              data-testid="agent-api-endpoint-input"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-langs" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Languages (optional)
            </label>
            <input
              id="agent-langs"
              value={languages}
              onChange={(e) => setLanguages(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="rust, typescript"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-apis" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              APIs & integrations (optional)
            </label>
            <input
              id="agent-apis"
              value={apis}
              onChange={(e) => setApis(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="solana-rpc, github"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="agent-desc" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Description (optional)
            </label>
            <textarea
              id="agent-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-base text-gray-900 focus:border-cyan-500/50 focus:outline-none dark:border-surface-300 dark:bg-surface dark:text-white"
              placeholder="What your agent is optimized for…"
              disabled={submitting}
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-11 w-full items-center justify-center rounded-lg bg-gradient-to-r from-cyan-600 to-solana-purple px-4 py-2.5 text-base font-semibold text-white shadow-sm hover:opacity-95 disabled:opacity-50"
            data-testid="agent-register-submit"
          >
            {submitting ? 'Registering…' : 'Register agent'}
          </button>
        </form>
      </div>
    </div>
  );
}
