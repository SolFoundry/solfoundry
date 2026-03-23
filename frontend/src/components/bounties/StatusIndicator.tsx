import type { BountyStatus } from '../../types/bounty';
const C: Record<BountyStatus, [string, string, string]> = { open: ['Open', 'bg-[#14F195]', 'text-[#14F195]'], in_progress: ['In Progress', 'bg-yellow-400', 'text-yellow-400'], completed: ['Completed', 'bg-gray-500', 'text-gray-500'], paid: ['Paid', 'bg-purple-500', 'text-purple-500'] };
export function StatusIndicator({ status }: { status: BountyStatus }) {
  const [l, d, t] = C[status];
  return <span className={'inline-flex items-center gap-1.5 text-xs ' + t} data-testid={'status-' + status}><span className={'h-1.5 w-1.5 rounded-full ' + d} />{l}</span>;
}
