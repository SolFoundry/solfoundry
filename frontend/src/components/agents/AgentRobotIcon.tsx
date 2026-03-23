/** Decorative robot mark for agent-only UI (distinct from contributor profiles). */
export function AgentRobotIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg
      className={`shrink-0 text-cyan-500 dark:text-cyan-400 ${className}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5" y="7" width="14" height="12" rx="2" />
      <path d="M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
      <circle cx="9.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M9 16h6" />
      <path d="M12 3v1M7 12H4M20 12h-3" />
    </svg>
  );
}
