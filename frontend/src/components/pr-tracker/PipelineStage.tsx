/** PipelineStage -- single pipeline stage row. @module PipelineStage */
import type { PipelineStage as T, StageStatus } from '../../types/prStatus';
const C:Record<StageStatus,{b:string;d:string;t:string}>={pass:{b:'bg-green-500/10',d:'border-green-500/30',t:'text-green-400'},running:{b:'bg-yellow-500/10',d:'border-yellow-500/30',t:'text-yellow-400'},fail:{b:'bg-red-500/10',d:'border-red-500/30',t:'text-red-400'},pending:{b:'bg-gray-500/10',d:'border-gray-700',t:'text-gray-500'},skipped:{b:'bg-gray-500/5',d:'border-gray-800',t:'text-gray-600'}};
const L:Record<StageStatus,string>={pass:'Passed',running:'Running',fail:'Failed',pending:'Pending',skipped:'Skipped'};
const IC:Record<string,string>={submitted:'\u2B06',ci_running:'\u2699',ai_review:'\u2728',human_review:'\uD83D\uDC64',approved:'\u2705',denied:'\u274C',payout:'\uD83D\uDCB0'};
/** Renders one pipeline stage row. */
export function PipelineStage({stage,isActive,isLast,onSelect}:{stage:T;isActive:boolean;isLast:boolean;onSelect?:(s:T)=>void}){
  const c=C[stage.status];return(
    <div className={`relative flex items-start gap-4 p-3 rounded-lg cursor-pointer hover:bg-gray-800/50 ${isActive?'ring-1 ring-purple-500/40':''}`}
      onClick={()=>onSelect?.(stage)} onKeyDown={e=>{if(e.key==='Enter')onSelect?.(stage);}} role="button" tabIndex={0} data-testid={`pipeline-stage-${stage.name}`}>
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${c.b} ${c.d} ${stage.status==='running'?'animate-pulse':''}`}>
        <span className={`text-lg ${c.t}`} aria-hidden="true">{IC[stage.name]??'\u25CF'}</span></div>
      {!isLast&&<div className="absolute left-[1.55rem] top-[3.25rem] h-[calc(100%-2.5rem)] w-px bg-gray-700"/>}
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><span className="font-medium text-white">{stage.label}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold border ${c.b} ${c.t} ${c.d}`}>{L[stage.status]}</span></div>
        {stage.details&&<p className="mt-0.5 text-xs text-gray-400 truncate">{stage.details}</p>}
        {stage.startedAt&&<p className="mt-0.5 text-xs text-gray-500">{new Date(stage.startedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}{stage.completedAt&&` \u2022 ${Math.round((+new Date(stage.completedAt)- +new Date(stage.startedAt))/1e3)}s`}</p>}
      </div></div>);
}
