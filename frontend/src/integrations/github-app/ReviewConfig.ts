/**
 * ReviewConfig — Configurable review strictness and comment preferences
 * for the AI Code Review GitHub App.
 *
 * Provides typed configuration for:
 * - Review strictness levels (lenient, normal, strict)
 * - Comment preferences (inline, summary, both)
 * - Per-repo override support
 * - Default configuration factory
 *
 * @module integrations/github-app/ReviewConfig
 */

/** Review strictness levels that control how aggressively the AI reviews code. */
export type ReviewStrictness = 'lenient' | 'normal' | 'strict';

/** Comment style preferences for how reviews are posted on PRs. */
export type CommentPreference = 'inline' | 'summary' | 'both';

/** LLM provider identifiers supported by the review pipeline. */
export type LLMProvider = 'claude' | 'codex' | 'gemini';

/**
 * Configuration for a single LLM provider within the review pipeline.
 */
export interface LLMProviderConfig {
  /** Unique provider identifier */
  provider: LLMProvider;
  /** Whether this provider is enabled for reviews */
  enabled: boolean;
  /** Model name/version to use (e.g. "claude-3-5-sonnet-20241022") */
  model: string;
  /** Maximum tokens for the review response */
  maxTokens: number;
  /** Temperature for generation (0.0–1.0) */
  temperature: number;
  /** System prompt prefix for this provider */
  systemPrompt: string;
}

/**
 * Review configuration for a repository or installation.
 */
export interface ReviewConfig {
  /** Unique configuration identifier */
  id: string;
  /** GitHub repository full name (owner/repo) or '*' for global */
  repository: string;
  /** Review strictness level */
  strictness: ReviewStrictness;
  /** Comment preference style */
  commentPreference: CommentPreference;
  /** LLM providers and their configurations */
  providers: LLMProviderConfig[];
  /** Whether the AI review is enabled for this repo */
  enabled: boolean;
  /** File patterns to include in reviews (glob patterns) */
  includePatterns: string[];
  /** File patterns to exclude from reviews (glob patterns) */
  excludePatterns: string[];
  /** Minimum PR size (lines changed) to trigger a review */
  minLinesChanged: number;
  /** Whether to review draft PRs */
  reviewDrafts: boolean;
  /** Custom instructions appended to every review prompt */
  customInstructions: string;
  /** Created/updated timestamps */
  createdAt: string;
  updatedAt: string;
}

/** Default system prompts per strictness level */
const STRICTNESS_PROMPTS: Record<ReviewStrictness, string> = {
  lenient:
    'You are a helpful code reviewer. Focus on critical issues only — major bugs, security vulnerabilities, and significant architectural problems. Be encouraging and constructive. Skip minor style nits.',
  normal:
    'You are a thorough code reviewer. Look for bugs, security issues, performance problems, code style violations, and potential improvements. Provide actionable feedback with clear explanations.',
  strict:
    'You are a rigorous code reviewer. Examine every line carefully for bugs, security vulnerabilities, performance issues, code style violations, naming problems, missing documentation, test coverage gaps, and architectural concerns. Be detailed and precise.',
};

/** Default LLM provider configurations */
const DEFAULT_PROVIDERS: LLMProviderConfig[] = [
  {
    provider: 'claude',
    enabled: true,
    model: 'claude-3-5-sonnet-20241022',
    maxTokens: 4096,
    temperature: 0.3,
    systemPrompt: STRICTNESS_PROMPTS.normal,
  },
  {
    provider: 'codex',
    enabled: true,
    model: 'o1',
    maxTokens: 4096,
    temperature: 0.1,
    systemPrompt: STRICTNESS_PROMPTS.normal,
  },
  {
    provider: 'gemini',
    enabled: true,
    model: 'gemini-2.0-flash',
    maxTokens: 4096,
    temperature: 0.2,
    systemPrompt: STRICTNESS_PROMPTS.normal,
  },
];

/**
 * Create a default review configuration.
 * @param repository - Repository full name (default: '*' for global)
 * @param strictness - Strictness level (default: 'normal')
 */
export function createDefaultConfig(
  repository = '*',
  strictness: ReviewStrictness = 'normal',
): ReviewConfig {
  const now = new Date().toISOString();
  return {
    id: `config_${Date.now()}`,
    repository,
    strictness,
    commentPreference: 'both',
    providers: DEFAULT_PROVIDERS.map((p) => ({
      ...p,
      systemPrompt: STRICTNESS_PROMPTS[strictness],
    })),
    enabled: true,
    includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.py', '**/*.rs', '**/*.go'],
    excludePatterns: ['**/node_modules/**', '**/dist/**', '**/build/**', '**/*.test.*', '**/*.spec.*'],
    minLinesChanged: 5,
    reviewDrafts: false,
    customInstructions: '',
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Update the system prompts for all providers based on strictness.
 */
export function updateStrictness(
  config: ReviewConfig,
  strictness: ReviewStrictness,
): ReviewConfig {
  return {
    ...config,
    strictness,
    providers: config.providers.map((p) => ({
      ...p,
      systemPrompt: STRICTNESS_PROMPTS[strictness],
    })),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Validate a review configuration.
 * @returns Array of validation error messages (empty if valid)
 */
export function validateConfig(config: ReviewConfig): string[] {
  const errors: string[] = [];

  if (!config.id) errors.push('Configuration ID is required');
  if (!config.repository) errors.push('Repository is required');
  if (!['lenient', 'normal', 'strict'].includes(config.strictness)) {
    errors.push('Invalid strictness level');
  }
  if (!['inline', 'summary', 'both'].includes(config.commentPreference)) {
    errors.push('Invalid comment preference');
  }
  if (config.providers.length === 0) {
    errors.push('At least one LLM provider must be configured');
  }
  const enabledProviders = config.providers.filter((p) => p.enabled);
  if (enabledProviders.length === 0) {
    errors.push('At least one LLM provider must be enabled');
  }
  for (const provider of config.providers) {
    if (provider.temperature < 0 || provider.temperature > 1) {
      errors.push(`Provider ${provider.provider}: temperature must be between 0 and 1`);
    }
    if (provider.maxTokens < 100 || provider.maxTokens > 32000) {
      errors.push(`Provider ${provider.provider}: maxTokens must be between 100 and 32000`);
    }
  }
  if (config.minLinesChanged < 0) {
    errors.push('minLinesChanged must be non-negative');
  }

  return errors;
}

/**
 * Merge a repository-specific config with the global defaults.
 * Repository-specific settings override global ones.
 */
export function mergeWithDefaults(
  globalConfig: ReviewConfig,
  repoConfig: Partial<ReviewConfig>,
): ReviewConfig {
  return {
    ...globalConfig,
    ...repoConfig,
    id: repoConfig.id ?? globalConfig.id,
    repository: repoConfig.repository ?? globalConfig.repository,
    providers: repoConfig.providers ?? globalConfig.providers,
    updatedAt: new Date().toISOString(),
  };
}
