/**
 * Agent runtime configuration.
 *
 * Driven by environment variables so it runs safely in CI and local dev.
 * @module @solfoundry/auto-submit-agent/config
 */

/** Valid LLM backends the agent can route to. */
export type LLMBackend = 'claude' | 'codex' | 'gemini' | 'openai' | 'mock';

/** Required environment variables for each backend. */
export type RequiredEnv = Record<LLMBackend, string[]>;

/** Known environment variables per backend. */
export const REQUIRED_ENV: RequiredEnv = {
  claude: ['ANTHROPIC_API_KEY'],
  codex: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY'],
  openai: ['OPENAI_API_KEY'],
  mock: [],
} as const;

/** Agent configuration resolved from environment. */
export interface AgentConfig {
  /** SolFoundry REST API base URL. */
  readonly baseUrl: string;
  /** SolFoundry JWT auth token (for submission writes). */
  readonly authToken: string | undefined;
  /** GitHub token for repo ops / claim checks. */
  readonly githubToken: string | undefined;
  /** Primary LLM backend. */
  readonly llmBackend: LLMBackend;
  /** LLM provider base URL (for self-hosted / OpenAI-compatible). */
  readonly llmBaseUrl: string;
  /** Default LLM model to use. */
  readonly llmModel: string;
  /** Max rewards to consider (USD equivalent). */
  readonly maxReward: number;
  /** Max bounties to evaluate per run. */
  readonly maxBounties: number;
  /** Dry-run: discover + classify only, no implementation or PR. */
  readonly dryRun: boolean;
  /** Solana payout wallet. */
  readonly payoutWallet: string | undefined;
  /** GitHub owner/repo to submit solutions into. */
  readonly targetOwner: string;
  readonly targetRepo: string;
  /** Head branch template for PRs. */
  readonly branchTemplate: string;
  /** Max time (seconds) the agent spends on a single bounty. */
  readonly maxRunSeconds: number;
  /** Whether to actually push PRs (requires githubToken + repo write perms). */
  readonly submitPrs: boolean;
}

/** Resolve agent config from environment variables with sensible defaults. */
export function loadAgentConfig(): AgentConfig {
  return {
    baseUrl: process.env.SOLFOUNDRY_API_URL ?? 'https://api.solfoundry.io',
    authToken: process.env.SOLFOUNDRY_API_TOKEN,
    githubToken: process.env.GITHUB_TOKEN,
    llmBackend: (process.env.LLM_BACKEND as LLMBackend) ?? 'claude',
    llmBaseUrl: process.env.LLM_BASE_URL ?? '',
    llmModel: process.env.LLM_MODEL ?? 'claude-3-5-sonnet-20241022',
    maxReward: parseInt(process.env.MAX_REWARD ?? '1000', 10),
    maxBounties: parseInt(process.env.MAX_BOUNTIES ?? '5', 10),
    dryRun: process.env.DRY_RUN === 'true',
    payoutWallet: process.env.PAYOUT_WALLET,
    targetOwner: process.env.TARGET_OWNER ?? 'SolFoundry',
    targetRepo: process.env.TARGET_REPO ?? 'solfoundry',
    branchTemplate: process.env.BRANCH_TEMPLATE ?? 'agent/t1-bounty-{issue_number}',
    maxRunSeconds: parseInt(process.env.MAX_RUN_SECONDS ?? '600', 10),
    submitPrs: process.env.SUBMIT_PRS !== 'false',
  };
}

/** Validate required env vars for the selected backend. */
export function validateConfig(cfg: AgentConfig): string[] {
  const missing: string[] = [];
  for (const key of REQUIRED_ENV[cfg.llmBackend]) {
    if (!process.env[key]) missing.push(key);
  }
  if (cfg.submitPrs && !cfg.githubToken) {
    missing.push('GITHUB_TOKEN (required when SUBMIT_PRS=true)');
  }
  if (cfg.submitPrs && !cfg.authToken) {
    missing.push('SOLFOUNDRY_API_TOKEN (required for submitting solutions)');
  }
  return missing;
}
