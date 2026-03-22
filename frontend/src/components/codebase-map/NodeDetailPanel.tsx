/**
 * NodeDetailPanel — Side panel showing details for a selected codebase node.
 *
 * Displays file/directory information, related bounties, recent PRs, and
 * metadata when a user clicks a node in the codebase map visualization.
 *
 * Spec requirement: "Click node to see: file info, related bounties, recent PRs"
 *
 * @module components/codebase-map/NodeDetailPanel
 */

import type {
  CodebaseNode,
  PullRequestSummary,
  BountySummary,
} from '../../types/codebase-map';
import { MODULE_COLORS } from '../../types/codebase-map';
import { formatFileSize } from '../../data/codebaseMapTransformer';

/** Props for the NodeDetailPanel component. */
export interface NodeDetailPanelProps {
  /** The selected codebase node to display details for (null to hide panel). */
  node: CodebaseNode | null;
  /** Recent pull requests from the API for cross-referencing. */
  pullRequests: PullRequestSummary[];
  /** Callback to close the detail panel. */
  onClose: () => void;
}

/**
 * Side panel that displays detailed information about a selected tree node.
 *
 * Shows:
 * - File/directory name, path, type, and size
 * - Module association with color indicator
 * - Status indicators (bounty, recently modified, test coverage)
 * - Associated bounties list with reward amounts
 * - Related PRs that may affect this file/directory
 *
 * Slides in from the right when a node is selected, slides out when closed.
 */
export function NodeDetailPanel({
  node,
  pullRequests,
  onClose,
}: NodeDetailPanelProps): JSX.Element | null {
  if (!node) return null;

  const moduleColor = MODULE_COLORS[node.module] || MODULE_COLORS.root;

  // Find PRs related to this node's module
  const relatedPullRequests = pullRequests.filter((pr) => {
    const titleLower = pr.title.toLowerCase();
    const moduleLower = node.module.toLowerCase();
    return (
      titleLower.includes(moduleLower) ||
      titleLower.includes(node.name.toLowerCase())
    );
  });

  // Active bounties for this node's module
  const activeBounties = node.bounties.filter(
    (bounty) => bounty.status === 'open'
  );

  return (
    <div
      className="w-80 bg-surface-50 border-l border-white/10 overflow-y-auto flex-shrink-0"
      data-testid="node-detail-panel"
      role="complementary"
      aria-label={`Details for ${node.name}`}
    >
      {/* Header */}
      <div className="sticky top-0 bg-surface-50 border-b border-white/10 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: moduleColor }}
              aria-hidden="true"
            />
            <h3 className="text-sm font-bold text-white truncate">
              {node.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
            aria-label="Close detail panel"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-gray-500 font-mono mt-1 truncate">
          {node.path || '/'}
        </p>
      </div>

      <div className="p-4 space-y-4">
        {/* File Info Section */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            File Info
          </h4>
          <div className="space-y-2">
            <InfoRow
              label="Type"
              value={node.node_type === 'directory' ? 'Directory' : 'File'}
            />
            {node.extension && (
              <InfoRow label="Extension" value={`.${node.extension}`} />
            )}
            {node.node_type === 'file' && node.size !== undefined && (
              <InfoRow label="Size" value={formatFileSize(node.size)} />
            )}
            {node.node_type === 'directory' && node.file_count !== undefined && (
              <InfoRow label="Files" value={String(node.file_count)} />
            )}
            <InfoRow label="Module" value={node.module} />
            <InfoRow label="Category" value={node.category} />
          </div>
        </section>

        {/* Status Indicators */}
        <section>
          <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
            Status
          </h4>
          <div className="flex flex-wrap gap-2">
            {node.has_active_bounty && (
              <StatusBadge color="#14F195" label="Active Bounty" />
            )}
            {node.recently_modified && (
              <StatusBadge color="#9945FF" label="Recently Modified" />
            )}
            {node.has_test_coverage && (
              <StatusBadge color="#4DA8FF" label="Has Tests" />
            )}
            {!node.has_active_bounty &&
              !node.recently_modified &&
              !node.has_test_coverage && (
                <span className="text-xs text-gray-600">No active indicators</span>
              )}
          </div>
        </section>

        {/* Related Bounties */}
        {activeBounties.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Related Bounties ({activeBounties.length})
            </h4>
            <div className="space-y-2">
              {activeBounties.map((bounty) => (
                <BountyItem key={bounty.id} bounty={bounty} />
              ))}
            </div>
          </section>
        )}

        {/* Recent PRs */}
        {relatedPullRequests.length > 0 && (
          <section>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Recent PRs ({relatedPullRequests.length})
            </h4>
            <div className="space-y-2">
              {relatedPullRequests.slice(0, 5).map((pr) => (
                <PullRequestItem key={pr.number} pullRequest={pr} />
              ))}
            </div>
          </section>
        )}

        {/* GitHub Link */}
        {node.path && (
          <section>
            <a
              href={`https://github.com/SolFoundry/solfoundry/tree/main/${node.path}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-[#9945FF] hover:text-[#14F195]
                         transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              View on GitHub
            </a>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * A single key-value row in the file info section.
 *
 * @param props - The label and value to display.
 */
function InfoRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-300 font-mono">{value}</span>
    </div>
  );
}

/**
 * A colored status badge indicator.
 *
 * @param props - The badge color and label text.
 */
function StatusBadge({
  color,
  label,
}: {
  color: string;
  label: string;
}): JSX.Element {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{
        backgroundColor: `${color}15`,
        color: color,
        border: `1px solid ${color}30`,
      }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/**
 * A single bounty item in the related bounties list.
 *
 * @param props - The bounty summary data to display.
 */
function BountyItem({ bounty }: { bounty: BountySummary }): JSX.Element {
  const rewardDisplay =
    bounty.reward_amount >= 1000
      ? `${(bounty.reward_amount / 1000).toFixed(0)}K`
      : String(bounty.reward_amount);

  return (
    <div className="p-2 rounded-lg bg-surface-200 border border-white/5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-white truncate max-w-[180px]">
          {bounty.title}
        </span>
        <span className="text-xs text-[#14F195] font-mono flex-shrink-0">
          {rewardDisplay} $FNDRY
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-300 text-gray-400">
          {bounty.tier}
        </span>
        <span className="text-[10px] text-gray-500 capitalize">
          {bounty.status}
        </span>
      </div>
    </div>
  );
}

/**
 * A single pull request item in the recent PRs list.
 *
 * @param props - The PR summary data to display.
 */
function PullRequestItem({
  pullRequest,
}: {
  pullRequest: PullRequestSummary;
}): JSX.Element {
  const isOpen = pullRequest.state === 'open';
  const isMerged = pullRequest.merged_at !== null;

  return (
    <a
      href={pullRequest.html_url}
      target="_blank"
      rel="noopener noreferrer"
      className="block p-2 rounded-lg bg-surface-200 border border-white/5
                 hover:border-white/10 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-2 h-2 rounded-full flex-shrink-0 ${
            isMerged
              ? 'bg-[#9945FF]'
              : isOpen
              ? 'bg-[#14F195]'
              : 'bg-gray-500'
          }`}
          aria-hidden="true"
        />
        <span className="text-xs text-gray-300 truncate">
          #{pullRequest.number} {pullRequest.title}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 ml-4">
        <span className="text-[10px] text-gray-500">
          by {pullRequest.author}
        </span>
        <span className="text-[10px] text-gray-600">
          {new Date(pullRequest.created_at).toLocaleDateString()}
        </span>
      </div>
    </a>
  );
}

export default NodeDetailPanel;
