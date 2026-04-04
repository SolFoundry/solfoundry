import React from 'react';

interface Deployment {
  id: string;
  environment: string;
  version: string;
  program_id: string | null;
  deployed_at: string;
  rollback_version: string | null;
  status: string;
}

interface Props {
  deployments: Deployment[];
  isLoading: boolean;
  total: number;
}

const ENV_STYLES: Record<string, string> = {
  mainnet: 'bg-purple-500/20 text-purple-400',
  devnet:  'bg-blue-500/20 text-blue-400',
  staging: 'bg-yellow-500/20 text-yellow-400',
  local:   'bg-white/10 text-white/50',
};

function EnvBadge({ env }: { env: string }) {
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ENV_STYLES[env] ?? 'bg-white/10 text-white/50'}`}>
      {env}
    </span>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function DeploymentHistory({ deployments, isLoading, total }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white/5 rounded-xl h-14" />
        ))}
      </div>
    );
  }

  if (!deployments.length) {
    return (
      <p className="text-sm text-white/40 text-center py-8">No deployments recorded yet.</p>
    );
  }

  return (
    <div>
      <p className="text-xs text-white/40 mb-3">{total} total deployments</p>
      <div className="space-y-3">
        {deployments.map((d) => (
          <div
            key={d.id}
            className="bg-[#0d0d1a] border border-white/10 rounded-xl px-4 py-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <EnvBadge env={d.environment} />
              <span className="text-sm font-semibold text-white">{d.version}</span>
              {d.rollback_version && (
                <span className="text-xs text-white/40">from {d.rollback_version}</span>
              )}
              {d.program_id && (
                <span className="text-xs font-mono text-white/30 truncate max-w-[120px]">
                  {d.program_id}
                </span>
              )}
            </div>
            <span className="text-xs text-white/30">{fmtDate(d.deployed_at)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
