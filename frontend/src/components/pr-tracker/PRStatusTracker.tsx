/** PRStatusTracker -- main PR pipeline card. @module PRStatusTracker */
import type { PRStatus, PROutcome } from '../../types/prStatus';
import { StageTimeline } from './StageTimeline';
const OC:Record<PROutcome,{l:string;c:string}>={in_progress:{l:'In Progress',c:'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'},approved:{l:'Approved',c:'bg-green-500/10 text-green-400 border-green-500/30'},denied:{l:'Denied',c:'bg-red-500/10 text-red-400 border-red-500/30'},paid:{l:'Paid',c:'bg-solana-green/10 text-solana-green border-solana-green/30'}};
function pct(pr:PRStatus){const v=pr.stages.filter(s=>s.status!=='skipped');return v.length?Math.round(v.filter(s=>s.status==='pass'||s.status==='fail').length/v.length*100):0;}
/** Renders PR status card. */
export function PRStatusTracker({prStatus:pr,compact=false,className=''}:{prStatus:PRStatus;compact?:boolean;className?:string}){
  const o=OC[pr.outcome],p=pct(pr);return(
    <div className={`rounded-xl border border-gray-800 bg-surface-50 ${className}`} data-testid="pr-status-tracker">
      <div className="border-b border-gray-800 p-4 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0">
        <div className="flex items-center gap-2"><h2 className="truncate text-lg font-bold text-white" data-testid="pr-title">{pr.prTitle}</h2>
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold border ${o.c}`} data-testid="pr-outcome-badge">{o.l}</span></div>
        <div className="mt-1 flex items-center gap-3 text-sm text-gray-400"><a href={pr.prUrl} target="_blank" rel="noopener noreferrer" className="hover:text-purple-400" data-testid="pr-link">#{pr.prNumber}</a><span>{pr.repositoryName}</span></div></div></div>
        {!compact&&<div className="mt-4" data-testid="progress-bar"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>Progress</span><span data-testid="progress-percentage">{p}%</span></div>
          <div className="h-2 rounded-full bg-gray-800 overflow-hidden"><div className="h-full rounded-full bg-purple-500" style={{width:`${p}%`}}/></div></div>}</div>
      {!compact&&<div className="p-4 sm:p-6"><StageTimeline stages={pr.stages} outcome={pr.outcome}/></div>}</div>);
}
