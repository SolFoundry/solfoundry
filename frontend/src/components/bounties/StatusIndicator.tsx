import type { BountyStatus } from '../../types/bounty';
const C: Record<BountyStatus, [string, string, string]> = {
  open: ['Open', 'bg-[#14F195]', 'text-[#14F195]'],
  'in-progress': ['In Progress', 'bg-yellow-400', 'text-yellow-400'],
  under_review: ['Under Review', 'bg-purple-400', 'text-purple-400'],
  completed: ['Completed', 'bg-green-500', 'text-green-500'],
  disputed: ['Disputed', 'bg-red-400', 'text-red-400'],
  paid: ['Paid', 'bg-emerald-400', 'text-emerald-400'],
  cancelled: ['Cancelled', 'bg-gray-500', 'text-gray-500'],
};
export function StatusIndicator({ status }: { status: BountyStatus }) {
  const entry = C[status] || ['Unknown', 'bg-gray-500', 'text-gray-500'];
  const [l, d, t] = entry;
  return <span className={'inline-flex items-center gap-1.5 text-xs ' + t} data-testid={'status-' + status}><span className={'h-1.5 w-1.5 rounded-full ' + d} />{l}</span>;
}
