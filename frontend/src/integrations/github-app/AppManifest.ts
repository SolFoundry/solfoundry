/**
 * AppManifest — GitHub App manifest for one-click installation.
 *
 * Defines the GitHub App manifest that controls:
 * - App name, description, and URL
 * - Webhook URL and events
 * - Permissions (read/write access to PRs, issues, etc.)
 * - Redirect URL for OAuth flow
 *
 * The manifest can be used for:
 * 1. One-click installation via GitHub's manifest flow
 * 2. Programmatic app creation via the GitHub API
 * 3. Configuration reference for manual setup
 *
 * @see https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-a-manifest-to-create-github-apps
 *
 * @module integrations/github-app/AppManifest
 */

/**
 * GitHub App manifest structure.
 * @see https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/using-a-manifest-to-create-github-apps#about-app-manifests
 */
export interface GitHubAppManifest {
  /** The name of the GitHub App */
  name: string;
  /** A short description of the app */
  description: string;
  /** The URL of the app's homepage */
  url: string;
  /** The callback URL for the OAuth web flow */
  callback_urls: string[];
  /** The callback URL for setup (post-installation) */
  setup_url?: string;
  /** Whether the app is public (can be installed by any user/org) */
  public: boolean;
  /** The URL to redirect to after a user authorizes the app */
  redirect_url?: string;
  /** Webhook configuration */
  hook_attributes: {
    /** The URL to receive webhook payloads */
    url: string;
    /** Whether the webhook is active */
    active: boolean;
    /** The secret used to validate webhook payloads */
    secret?: string;
  };
  /** The events the app subscribes to */
  default_events: AppWebhookEvent[];
  /** The permissions the app requests */
  default_permissions: AppPermissions;
  /** The repositories the app is requested to access */
  request_oauth_on_install?: boolean;
  /** OAuth client settings (if OAuth is enabled) */
  oauth_scopes?: string[];
}

/**
 * Webhook events the AI Code Review app subscribes to.
 */
export type AppWebhookEvent =
  | 'pull_request'
  | 'pull_request_review_comment'
  | 'push'
  | 'installation'
  | 'installation_repositories';

/**
 * Permissions the app requests from the installing user/org.
 */
export interface AppPermissions {
  /** Pull request access */
  pull_requests: 'read' | 'write' | 'admin';
  /** Issue access (for linking reviews to issues) */
  issues: 'read' | 'write' | 'none';
  /** Repository contents access (for reading diffs) */
  contents: 'read' | 'write' | 'none';
  /** Metadata access (always read-only) */
  metadata: 'read' | 'none';
  /** Commit statuses access */
  statuses: 'read' | 'write' | 'none';
}

/**
 * The default app manifest for the AI Code Review GitHub App.
 *
 * This manifest is designed for one-click installation from the SolFoundry platform.
 * It requests the minimum permissions needed for AI code review functionality.
 */
export const AI_CODE_REVIEW_MANIFEST: GitHubAppManifest = {
  name: 'SolFoundry AI Code Review',
  description:
    'Automated multi-LLM code reviews on pull requests. ' +
    'Powered by Claude, Codex, and Gemini for comprehensive code analysis.',
  url: 'https://solfoundry.dev', // SolFoundry platform URL
  callback_urls: ['https://solfoundry.dev/auth/github-app/callback'],
  setup_url: 'https://solfoundry.dev/settings/github-app/setup',
  public: true,
  redirect_url: 'https://solfoundry.dev/settings/github-app/installed',
  hook_attributes: {
    url: 'https://solfoundry.dev/api/github/webhook',
    active: true,
  },
  default_events: [
    'pull_request',
    'pull_request_review_comment',
    'push',
    'installation',
    'installation_repositories',
  ],
  default_permissions: {
    pull_requests: 'write', // Post review comments on PRs
    issues: 'read', // Read linked issues for context
    contents: 'read', // Read file contents for review
    metadata: 'read', // Required for all GitHub Apps
    statuses: 'write', // Update commit statuses with review results
  },
  request_oauth_on_install: true,
  oauth_scopes: ['repo', 'read:org'],
};

/**
 * Generate the manifest JSON string for the GitHub App creation flow.
 */
export function generateManifestJson(manifest?: Partial<GitHubAppManifest>): string {
  const fullManifest = { ...AI_CODE_REVIEW_MANIFEST, ...manifest };
  return JSON.stringify(fullManifest, null, 2);
}

/**
 * Build the GitHub URL for one-click app installation via manifest flow.
 *
 * The manifest is base64-encoded and passed as a query parameter.
 *
 * @param manifest - The app manifest (uses default if not provided)
 * @returns The GitHub URL for installing the app
 */
export function buildInstallUrl(manifest?: Partial<GitHubAppManifest>): string {
  const manifestJson = generateManifestJson(manifest);
  const encoded = Buffer.from(manifestJson).toString('base64');
  return `https://github.com/apps/new?manifest=${encoded}`;
}

/**
 * Build the SolFoundry platform URL for one-click app installation.
 * The SolFoundry backend handles the manifest flow and redirects to GitHub.
 *
 * @param installationToken - Optional installation token for pre-authenticated installs
 * @returns The SolFoundry URL for installing the app
 */
export function buildSolFoundryInstallUrl(installationToken?: string): string {
  const base = 'https://solfoundry.dev/settings/github-app/install';
  if (installationToken) {
    return `${base}?token=${installationToken}`;
  }
  return base;
}

/**
 * Available strictness presets for the app configuration.
 */
export const STRICTNESS_PRESETS = {
  lenient: {
    label: 'Lenient',
    description: 'Focus on critical issues only. Minimal noise, maximum signal.',
    emoji: '😌',
  },
  normal: {
    label: 'Normal',
    description: 'Balanced review covering bugs, security, and code quality.',
    emoji: '🤖',
  },
  strict: {
    label: 'Strict',
    description: 'Comprehensive review including style, docs, and architecture.',
    emoji: '🔍',
  },
};

/**
 * Available comment style presets.
 */
export const COMMENT_PRESETS = {
  inline: {
    label: 'Inline Comments',
    description: 'Post findings as inline comments on specific lines of code.',
    emoji: '📝',
  },
  summary: {
    label: 'Summary Comment',
    description: 'Post a single summary comment on the PR with all findings.',
    emoji: '📋',
  },
  both: {
    label: 'Inline + Summary',
    description: 'Post both inline comments and a summary comment.',
    emoji: '📝📋',
  },
};

/**
 * Available LLM provider configurations.
 */
export const PROVIDER_PRESETS = {
  claude: {
    label: 'Claude',
    provider: 'claude',
    description: 'Anthropic Claude — strong at security analysis and code quality.',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229'],
    emoji: '🟣',
  },
  codex: {
    label: 'Codex',
    provider: 'codex',
    description: 'OpenAI Codex — excellent at bug detection and performance analysis.',
    models: ['o1', 'o1-mini'],
    emoji: '🔵',
  },
  gemini: {
    label: 'Gemini',
    provider: 'gemini',
    description: 'Google Gemini — strong at architectural review and best practices.',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro'],
    emoji: '🟠',
  },
};
