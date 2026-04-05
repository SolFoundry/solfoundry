import React from 'react';

interface ConfigEntry {
  key: string;
  value: string;
  is_secret: boolean;
  description: string;
}

interface EnvData {
  config_count: number;
  configs: ConfigEntry[];
}

interface Props {
  data: Record<string, EnvData> | null;
  isLoading: boolean;
}

export function EnvironmentConfigs({ data, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white/5 rounded-xl h-28" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-sm text-white/40 text-center py-8">
        No environment configurations found.
      </p>
    );
  }

  const envs = Object.entries(data);

  return (
    <div className="space-y-4">
      {envs.map(([env, envData]) => (
        <div key={env} className="bg-[#0d0d1a] border border-white/10 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-white">{env}</span>
            <span className="text-xs text-white/40">{envData.config_count} keys</span>
          </div>
          {envData.configs.length === 0 ? (
            <p className="text-xs text-white/30">No keys configured.</p>
          ) : (
            <div className="space-y-2">
              {envData.configs.map((cfg) => (
                <div key={cfg.key} className="flex items-center justify-between text-xs">
                  <span className="font-mono text-[#14F195]">{cfg.key}</span>
                  <span className={`font-mono ${cfg.is_secret ? 'text-white/30' : 'text-white/60'}`}>
                    {cfg.value}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
