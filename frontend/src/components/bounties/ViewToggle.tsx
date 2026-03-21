export type ViewMode = 'grid' | 'list';

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  return (
    <div className="flex rounded-lg border border-surface-300 overflow-hidden" data-testid="view-toggle">
      <button
        type="button"
        onClick={() => onChange('grid')}
        className={
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ' +
          (mode === 'grid' ? 'bg-solana-green/15 text-solana-green' : 'text-gray-400 hover:text-white')
        }
        aria-pressed={mode === 'grid'}
        data-testid="view-grid"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M5 3a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2H5zm0 8a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2H5zm6-6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V5zm0 8a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
        </svg>
        Grid
      </button>
      <button
        type="button"
        onClick={() => onChange('list')}
        className={
          'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors border-l border-surface-300 ' +
          (mode === 'list' ? 'bg-solana-green/15 text-solana-green' : 'text-gray-400 hover:text-white')
        }
        aria-pressed={mode === 'list'}
        data-testid="view-list"
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
        </svg>
        List
      </button>
    </div>
  );
}
