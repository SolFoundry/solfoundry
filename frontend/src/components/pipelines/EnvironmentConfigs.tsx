/**
 * EnvironmentConfigs -- Displays environment configuration tables.
 *
 * Shows configuration key-value pairs for each environment (local,
 * devnet, staging, mainnet) with secret value masking. Used on the
 * Pipeline Dashboard environments tab.
 *
 * @module components/pipelines/EnvironmentConfigs
 */

/** Shape of a single config entry in the environment summary. */
interface ConfigEntry {
  key: string;
  value: string;
  is_secret: boolean;
  description: string | null;
}

/** Shape of an environment summary from the API. */
interface EnvironmentSummary {
  config_count: number;
  configs: ConfigEntry[];
}

/** Props for the EnvironmentConfigs component. */
interface EnvironmentConfigsProps {
  /** Environment summary data from the API (null while loading). */
  data: Record<string, unknown> | null;
  /** Whether the data is currently loading. */
  isLoading: boolean;
}

/** Map environment names to display colors for the header badge. */
const ENVIRONMENT_HEADER_COLORS: Record<string, string> = {
  local: 'border-gray-500/30 text-gray-400',
  devnet: 'border-blue-500/30 text-blue-400',
  staging: 'border-yellow-500/30 text-yellow-400',
  mainnet: 'border-[#14F195]/30 text-[#14F195]',
};

/**
 * Environment configurations display component.
 *
 * Renders a collapsible section for each environment showing all
 * configuration keys and their values. Secret values appear as
 * asterisks with a lock indicator.
 */
export function EnvironmentConfigs({
  data,
  isLoading,
}: EnvironmentConfigsProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((index) => (
          <div
            key={index}
            className="h-32 bg-white/5 rounded-lg animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">
          No environment configurations found.
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Use the API to seed default configurations.
        </p>
      </div>
    );
  }

  const environments = ['local', 'devnet', 'staging', 'mainnet'];

  return (
    <div className="space-y-6">
      {environments.map((envName) => {
        const envData = data[envName] as EnvironmentSummary | undefined;
        if (!envData) return null;

        return (
          <div
            key={envName}
            className="bg-white/5 rounded-lg border border-white/10 overflow-hidden"
          >
            {/* Environment Header */}
            <div
              className={`px-4 py-3 border-b border-white/5 flex items-center justify-between ${
                ENVIRONMENT_HEADER_COLORS[envName] ?? 'text-gray-400'
              }`}
            >
              <h3 className="text-sm font-medium uppercase tracking-wider">
                {envName}
              </h3>
              <span className="text-xs text-gray-500">
                {envData.config_count} keys
              </span>
            </div>

            {/* Config Table */}
            {envData.configs.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Key</th>
                    <th className="px-4 py-2 text-left">Value</th>
                    <th className="px-4 py-2 text-left hidden md:table-cell">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {envData.configs.map((config: ConfigEntry) => (
                    <tr key={config.key} className="hover:bg-white/5">
                      <td className="px-4 py-2 font-mono text-gray-300 whitespace-nowrap">
                        {config.key}
                        {config.is_secret && (
                          <span
                            className="ml-1 text-yellow-500"
                            title="Secret value (masked)"
                          >
                            *
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-gray-400 max-w-xs truncate">
                        {config.value}
                      </td>
                      <td className="px-4 py-2 text-gray-500 hidden md:table-cell max-w-sm truncate">
                        {config.description ?? '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-4 py-6 text-center text-gray-500 text-sm">
                No configurations set for this environment.
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
