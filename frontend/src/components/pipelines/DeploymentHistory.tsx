/**
 * DeploymentHistory -- Lists deployment records with environment badges.
 *
 * Displays a chronological list of deployments showing environment,
 * version, program ID, and rollback information. Used on the Pipeline
 * Dashboard deployments tab.
 *
 * @module components/pipelines/DeploymentHistory
 */
import type { DeploymentRecord } from '../../pages/PipelineDashboardPage';

/** Props for the DeploymentHistory component. */
interface DeploymentHistoryProps {
  /** Array of deployment records from the API. */
  deployments: DeploymentRecord[];
  /** Whether the data is currently loading. */
  isLoading: boolean;
  /** Total count of deployment records. */
  total: number;
}

/** Map environment names to display colors. */
const ENVIRONMENT_COLORS: Record<string, string> = {
  local: 'bg-gray-500/20 text-gray-400',
  devnet: 'bg-blue-500/20 text-blue-400',
  staging: 'bg-yellow-500/20 text-yellow-400',
  mainnet: 'bg-[#14F195]/20 text-[#14F195]',
};

/**
 * Format an ISO date string for display.
 *
 * @param isoString - ISO 8601 date string.
 * @returns Formatted date string or "--" if null.
 */
function formatDate(isoString: string | null): string {
  if (!isoString) return '--';
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Deployment history list component.
 *
 * Renders each deployment as a card with environment badge, version,
 * optional program ID, and rollback version reference.
 */
export function DeploymentHistory({
  deployments,
  isLoading,
  total,
}: DeploymentHistoryProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-16 bg-white/5 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (deployments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">No deployments recorded yet.</p>
      </div>
    );
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-4">{total} total deployments</p>
      <div className="space-y-3">
        {deployments.map((deployment) => (
          <div
            key={deployment.id}
            className="bg-white/5 rounded-lg border border-white/10 px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              {/* Environment Badge */}
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  ENVIRONMENT_COLORS[deployment.environment] ??
                  'bg-gray-500/20 text-gray-400'
                }`}
              >
                {deployment.environment}
              </span>

              {/* Version */}
              <div>
                <span className="text-sm text-white font-mono">
                  {deployment.version}
                </span>
                {deployment.program_id && (
                  <span className="ml-2 text-xs text-gray-500 font-mono">
                    Program: {deployment.program_id.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Rollback Version */}
              {deployment.rollback_version && (
                <span className="text-xs text-gray-500">
                  from {deployment.rollback_version}
                </span>
              )}

              {/* Status */}
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  deployment.status === 'success'
                    ? 'bg-[#14F195]/20 text-[#14F195]'
                    : deployment.status === 'failure'
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-yellow-500/20 text-yellow-400'
                }`}
              >
                {deployment.status}
              </span>

              {/* Date */}
              <span className="text-xs text-gray-500 w-28 text-right">
                {formatDate(deployment.deployed_at)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
