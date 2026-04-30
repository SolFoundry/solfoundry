/**
 * GitHubAppSetup — Setup page for installing and configuring the AI Code Review GitHub App.
 *
 * Provides a UI for:
 * - One-click app installation
 * - Configuring review strictness and comment preferences
 * - Managing LLM provider settings
 * - Viewing webhook status
 *
 * @module components/GitHubAppSetup
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github,
  CheckCircle,
  AlertCircle,
  Settings,
  Shield,
  MessageSquare,
  Zap,
  ChevronRight,
  Loader2,
  RefreshCw,
  Trash2,
  ExternalLink,
  GitPullRequest,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useGitHubApp } from '../hooks/useGitHubApp';
import {
  AI_CODE_REVIEW_MANIFEST,
  buildInstallUrl,
  STRICTNESS_PRESETS,
  COMMENT_PRESETS,
  PROVIDER_PRESETS,
} from '../integrations/github-app/AppManifest';
import type { ReviewStrictness, CommentPreference, LLMProvider } from '../integrations/github-app/ReviewConfig';

// ─── Main Component ──────────────────────────────────────────────────────────

export function GitHubAppSetup() {
  const {
    isInstalled,
    installations,
    installationsLoading,
    config,
    configLoading,
    updateStrictness,
    updateCommentPreference,
    toggleProvider,
    webhookStatus,
    webhookStatusLoading,
    installUrl,
    installUrlLoading,
    triggerReview,
    reviews,
    reviewsLoading,
    isLoading,
    error,
    uninstallApp,
    uninstallLoading,
  } = useGitHubApp();

  const [activeTab, setActiveTab] = useState<'install' | 'configure' | 'status'>('install');
  const [selectedRepo, setSelectedRepo] = useState<string>('');

  // Determine selected repo from installations
  const availableRepos = installations.flatMap((i) => i.repositories);
  const displayRepo = selectedRepo || (availableRepos[0] ?? '*');

  if (isLoading && !isInstalled) {
    return (
      <div className="min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-forge-800 border border-border flex items-center justify-center">
          <Github className="w-6 h-6 text-text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">AI Code Review</h1>
          <p className="text-text-muted text-sm">
            Multi-LLM code reviews powered by Claude, Codex, and Gemini
          </p>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 p-4 rounded-lg bg-status-error/10 border border-status-error/20 text-status-error"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>Failed to load GitHub App configuration. Please try again.</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 rounded-lg bg-forge-800 border border-border">
        {[
          { id: 'install' as const, label: 'Install', icon: Github },
          { id: 'configure' as const, label: 'Configure', icon: Settings },
          { id: 'status' as const, label: 'Status', icon: Zap },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-forge-700 text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'install' && (
          <motion.div
            key="install"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <InstallSection
              isInstalled={isInstalled}
              installations={installations}
              installUrl={installUrl}
              installUrlLoading={installUrlLoading}
              onUninstall={uninstallApp}
              uninstallLoading={uninstallLoading}
            />
          </motion.div>
        )}

        {activeTab === 'configure' && (
          <motion.div
            key="configure"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            {!isInstalled ? (
              <div className="text-center py-12">
                <Github className="w-12 h-12 text-text-muted mx-auto mb-4" />
                <h3 className="text-lg font-medium text-text-primary mb-2">App Not Installed</h3>
                <p className="text-text-muted mb-4">
                  Install the AI Code Review app to configure review settings.
                </p>
                <button
                  onClick={() => setActiveTab('install')}
                  className="px-4 py-2 rounded-lg bg-emerald text-forge-950 font-medium text-sm hover:bg-emerald/90 transition-colors"
                >
                  Go to Install
                </button>
              </div>
            ) : (
              <ConfigureSection
                config={config}
                configLoading={configLoading}
                displayRepo={displayRepo}
                availableRepos={availableRepos}
                selectedRepo={selectedRepo}
                onSelectRepo={setSelectedRepo}
                onUpdateStrictness={updateStrictness}
                onUpdateCommentPreference={updateCommentPreference}
                onToggleProvider={toggleProvider}
              />
            )}
          </motion.div>
        )}

        {activeTab === 'status' && (
          <motion.div
            key="status"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <StatusSection
              webhookStatus={webhookStatus}
              webhookStatusLoading={webhookStatusLoading}
              reviews={reviews}
              reviewsLoading={reviewsLoading}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Install Section ─────────────────────────────────────────────────────────

interface InstallSectionProps {
  isInstalled: boolean;
  installations: Array<{
    id: number;
    accountLogin: string;
    accountType: string;
    repositories: string[];
  }>;
  installUrl?: string;
  installUrlLoading: boolean;
  onUninstall: (id: number) => void;
  uninstallLoading: boolean;
}

function InstallSection({
  isInstalled,
  installations,
  installUrl,
  installUrlLoading,
  onUninstall,
  uninstallLoading,
}: InstallSectionProps) {
  const manifestUrl = buildInstallUrl();

  if (isInstalled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-lg bg-emerald/10 border border-emerald/20">
          <CheckCircle className="w-5 h-5 text-emerald flex-shrink-0" />
          <div>
            <h3 className="font-medium text-text-primary">App Installed</h3>
            <p className="text-text-muted text-sm">
              AI Code Review is active on {installations.length} account(s)
            </p>
          </div>
        </div>

        {installations.map((install) => (
          <div
            key={install.id}
            className="p-4 rounded-lg bg-forge-800 border border-border space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-forge-700 flex items-center justify-center">
                  <Github className="w-4 h-4 text-text-primary" />
                </div>
                <div>
                  <p className="font-medium text-text-primary">{install.accountLogin}</p>
                  <p className="text-xs text-text-muted">{install.accountType}</p>
                </div>
              </div>
              <button
                onClick={() => onUninstall(install.id)}
                disabled={uninstallLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {uninstallLoading ? 'Removing...' : 'Remove'}
              </button>
            </div>

            {install.repositories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {install.repositories.map((repo) => (
                  <span
                    key={repo}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-forge-700 text-text-muted text-xs font-mono"
                  >
                    <GitPullRequest className="w-3 h-3" />
                    {repo}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Card */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-forge-800 p-6">
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald/5 rounded-full -translate-y-20 translate-x-20" />
        <div className="relative space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald/10 border border-emerald/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-emerald" />
            </div>
            <div>
              <h3 className="font-semibold text-text-primary">One-Click Installation</h3>
              <p className="text-text-muted text-sm">
                Install the AI Code Review app on your GitHub account
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <a
              href={installUrl ?? manifestUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald text-forge-950 font-medium text-sm hover:bg-emerald/90 transition-colors"
            >
              <Github className="w-4 h-4" />
              {installUrlLoading ? 'Loading...' : 'Install on GitHub'}
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* Permissions */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <Shield className="w-4 h-4 text-emerald" />
          App Permissions
        </h4>
        <div className="space-y-2">
          {Object.entries(AI_CODE_REVIEW_MANIFEST.default_permissions).map(
            ([permission, access]) => (
              <div key={permission} className="flex items-center justify-between text-sm">
                <span className="text-text-muted capitalize">{permission.replace('_', ' ')}</span>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-medium ${
                    access === 'write' || access === 'admin'
                      ? 'bg-amber/10 text-amber'
                      : access === 'read'
                      ? 'bg-emerald/10 text-emerald'
                      : 'bg-forge-700 text-text-muted'
                  }`}
                >
                  {access}
                </span>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Webhook Events */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <GitPullRequest className="w-4 h-4 text-emerald" />
          Subscribed Events
        </h4>
        <div className="flex flex-wrap gap-2">
          {AI_CODE_REVIEW_MANIFEST.default_events.map((event) => (
            <span
              key={event}
              className="px-2.5 py-1 rounded-md bg-forge-700 text-text-muted text-xs font-mono"
            >
              {event}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Configure Section ───────────────────────────────────────────────────────

interface ConfigureSectionProps {
  config: {
    strictness: ReviewStrictness;
    commentPreference: CommentPreference;
    providers: Array<{
      provider: LLMProvider;
      enabled: boolean;
      model: string;
      temperature: number;
      maxTokens: number;
    }>;
    enabled: boolean;
    includePatterns: string[];
    excludePatterns: string[];
    minLinesChanged: number;
    reviewDrafts: boolean;
    customInstructions: string;
  } | null;
  configLoading: boolean;
  displayRepo: string;
  availableRepos: string[];
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
  onUpdateStrictness: (repo: string, strictness: ReviewStrictness) => void;
  onUpdateCommentPreference: (repo: string, preference: CommentPreference) => void;
  onToggleProvider: (repo: string, provider: LLMProvider, enabled: boolean) => void;
}

function ConfigureSection({
  config,
  configLoading,
  displayRepo,
  availableRepos,
  selectedRepo,
  onSelectRepo,
  onUpdateStrictness,
  onUpdateCommentPreference,
  onToggleProvider,
}: ConfigureSectionProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-emerald animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Repository Selector */}
      {availableRepos.length > 1 && (
        <div className="p-4 rounded-lg bg-forge-800 border border-border">
          <label className="block text-sm font-medium text-text-primary mb-2">Repository</label>
          <select
            value={selectedRepo}
            onChange={(e) => onSelectRepo(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-forge-700 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald/50"
          >
            <option value="*">All Repositories (Global)</option>
            {availableRepos.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Strictness Level */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <Shield className="w-4 h-4 text-emerald" />
          Review Strictness
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(STRICTNESS_PRESETS) as [ReviewStrictness, typeof STRICTNESS_PRESETS.lenient][]).map(
            ([key, preset]) => (
              <button
                key={key}
                onClick={() => onUpdateStrictness(displayRepo, key)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  config?.strictness === key
                    ? 'border-emerald bg-emerald/10'
                    : 'border-border bg-forge-700 hover:border-border/80'
                }`}
              >
                <span className="text-lg">{preset.emoji}</span>
                <p className={`font-medium text-sm mt-1 ${
                  config?.strictness === key ? 'text-emerald' : 'text-text-primary'
                }`}>
                  {preset.label}
                </p>
                <p className="text-text-muted text-xs mt-1">{preset.description}</p>
              </button>
            ),
          )}
        </div>
      </div>

      {/* Comment Preference */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <MessageSquare className="w-4 h-4 text-emerald" />
          Comment Style
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(Object.entries(COMMENT_PRESETS) as [CommentPreference, typeof COMMENT_PRESETS.inline][]).map(
            ([key, preset]) => (
              <button
                key={key}
                onClick={() => onUpdateCommentPreference(displayRepo, key)}
                className={`p-3 rounded-lg border text-left transition-all ${
                  config?.commentPreference === key
                    ? 'border-emerald bg-emerald/10'
                    : 'border-border bg-forge-700 hover:border-border/80'
                }`}
              >
                <span className="text-lg">{preset.emoji}</span>
                <p className={`font-medium text-sm mt-1 ${
                  config?.commentPreference === key ? 'text-emerald' : 'text-text-primary'
                }`}>
                  {preset.label}
                </p>
                <p className="text-text-muted text-xs mt-1">{preset.description}</p>
              </button>
            ),
          )}
        </div>
      </div>

      {/* LLM Providers */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <Zap className="w-4 h-4 text-emerald" />
          AI Providers
        </h4>
        <div className="space-y-3">
          {(Object.entries(PROVIDER_PRESETS) as [LLMProvider, typeof PROVIDER_PRESETS.claude][]).map(
            ([key, preset]) => {
              const providerConfig = config?.providers.find((p) => p.provider === key);
              const isEnabled = providerConfig?.enabled ?? true;

              return (
                <div
                  key={key}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    isEnabled ? 'border-border bg-forge-700' : 'border-border/50 bg-forge-800/50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{preset.emoji}</span>
                    <div>
                      <p className={`font-medium text-sm ${isEnabled ? 'text-text-primary' : 'text-text-muted'}`}>
                        {preset.label}
                      </p>
                      <p className="text-text-muted text-xs">{preset.description}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => onToggleProvider(displayRepo, key, !isEnabled)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      isEnabled ? 'bg-emerald' : 'bg-forge-600'
                    }`}
                    aria-label={`Toggle ${preset.label}`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-forge-950 shadow transition-transform ${
                        isEnabled ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            },
          )}
        </div>
      </div>

      {/* Advanced Settings */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center justify-between w-full text-left"
        >
          <span className="font-medium text-text-primary text-sm">Advanced Settings</span>
          <ChevronRight
            className={`w-4 h-4 text-text-muted transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
          />
        </button>

        <AnimatePresence>
          {showAdvanced && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Minimum Lines Changed
                  </label>
                  <input
                    type="number"
                    defaultValue={config?.minLinesChanged ?? 5}
                    className="w-full px-3 py-2 rounded-lg bg-forge-700 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald/50"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-primary">Review Draft PRs</span>
                  <button
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      config?.reviewDrafts ? 'bg-emerald' : 'bg-forge-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 rounded-full bg-forge-950 shadow transition-transform ${
                        config?.reviewDrafts ? 'translate-x-5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-1">
                    Custom Instructions
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Add custom instructions for the AI reviewer..."
                    className="w-full px-3 py-2 rounded-lg bg-forge-700 border border-border text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-emerald/50 resize-none"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Status Section ──────────────────────────────────────────────────────────

interface StatusSectionProps {
  webhookStatus: {
    active: boolean;
    lastDelivery?: { id: string; createdAt: string; status: string; event: string };
    totalDeliveries: number;
  } | null;
  webhookStatusLoading: boolean;
  reviews: Array<{
    id: string;
    prNumber: number;
    repository: string;
    findings: Array<{ severity: string }>;
    passed: boolean;
    completedAt: string;
  }>;
  reviewsLoading: boolean;
}

function StatusSection({ webhookStatus, webhookStatusLoading, reviews, reviewsLoading }: StatusSectionProps) {
  return (
    <div className="space-y-4">
      {/* Webhook Status */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <Zap className="w-4 h-4 text-emerald" />
          Webhook Status
        </h4>
        {webhookStatusLoading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading...
          </div>
        ) : webhookStatus ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${webhookStatus.active ? 'bg-emerald' : 'bg-status-error'}`} />
              <span className="text-sm text-text-primary">
                {webhookStatus.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            {webhookStatus.lastDelivery && (
              <div className="text-xs text-text-muted space-y-1">
                <p>Last delivery: {webhookStatus.lastDelivery.event}</p>
                <p>Status: <span className={webhookStatus.lastDelivery.status === '200' ? 'text-emerald' : 'text-status-error'}>{webhookStatus.lastDelivery.status}</span></p>
                <p>Time: {new Date(webhookStatus.lastDelivery.createdAt).toLocaleString()}</p>
              </div>
            )}
            <p className="text-xs text-text-muted">
              Total deliveries: {webhookStatus.totalDeliveries}
            </p>
          </div>
        ) : (
          <p className="text-text-muted text-sm">No webhook data available</p>
        )}
      </div>

      {/* Recent Reviews */}
      <div className="p-4 rounded-lg bg-forge-800 border border-border">
        <h4 className="flex items-center gap-2 font-medium text-text-primary mb-3">
          <GitPullRequest className="w-4 h-4 text-emerald" />
          Recent Reviews
        </h4>
        {reviewsLoading ? (
          <div className="flex items-center gap-2 text-text-muted text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading reviews...
          </div>
        ) : reviews.length > 0 ? (
          <div className="space-y-2">
            {reviews.slice(0, 5).map((review) => (
              <div
                key={review.id}
                className="flex items-center justify-between p-3 rounded-lg bg-forge-700"
              >
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    PR #{review.prNumber}
                  </p>
                  <p className="text-xs text-text-muted">{review.repository}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-text-muted">
                    {review.findings.length} findings
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
                      review.passed
                        ? 'bg-emerald/10 text-emerald'
                        : 'bg-amber/10 text-amber'
                    }`}
                  >
                    {review.passed ? 'Passed' : 'Issues Found'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-sm text-center py-4">
            No reviews yet. Open a PR to trigger an AI review.
          </p>
        )}
      </div>
    </div>
  );
}
