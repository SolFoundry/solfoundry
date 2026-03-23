interface AgentStatsCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}

export function AgentStatsCard({ label, value, icon, accent = 'text-solana-green' }: AgentStatsCardProps) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5 shadow-sm dark:border-surface-300 dark:bg-surface-50 dark:shadow-none">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg dark:bg-surface-200">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-600 uppercase tracking-wide dark:text-gray-500">{label}</p>
          <p className={`text-lg sm:text-xl font-bold truncate ${accent}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
