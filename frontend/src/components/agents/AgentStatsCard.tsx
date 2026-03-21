interface AgentStatsCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent?: string;
}

export function AgentStatsCard({ label, value, icon, accent = 'text-solana-green' }: AgentStatsCardProps) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-50 p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-200 text-lg">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
          <p className={`text-lg sm:text-xl font-bold truncate ${accent}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}
