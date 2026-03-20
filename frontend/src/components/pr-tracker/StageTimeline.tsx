/** StageTimeline -- vertical stages with outcome filtering. @module StageTimeline */
import { useState } from 'react';
import type { PipelineStage as T, PROutcome } from '../../types/prStatus';
import { PipelineStage } from './PipelineStage';
import { AIReviewScores } from './AIReviewScores';
import { PayoutInfo } from './PayoutInfo';
function vis(ss:T[],o:PROutcome){return ss.filter(s=>{
  if((o==='approved'||o==='paid')&&s.name==='denied')return false;
  if(o==='denied'&&(s.name==='approved'||s.name==='payout'))return false;
  return o!=='in_progress'||s.status!=='skipped';});}
function ai(ss:T[]){const r=ss.findIndex(s=>s.status==='running');if(r!==-1)return r;let l=-1;ss.forEach((s,i)=>{if(s.status==='pass'||s.status==='fail')l=i;});return l;}
/** Renders stage list with expandable details. */
export function StageTimeline({stages,outcome}:{stages:T[];outcome:PROutcome}){
  const [exp,setExp]=useState<string|null>(null);const v=vis(stages,outcome),a=ai(v);
  return(<div className="space-y-0" data-testid="stage-timeline">{v.map((s,i)=>(
    <div key={s.name}><PipelineStage stage={s} isActive={i===a} isLast={i===v.length-1} onSelect={x=>setExp(p=>p===x.name?null:x.name)}/>
      {exp===s.name&&s.aiReview&&<div className="ml-14 mb-2"><AIReviewScores review={s.aiReview}/></div>}
      {exp===s.name&&s.payout&&<div className="ml-14 mb-2"><PayoutInfo payout={s.payout}/></div>}
    </div>))}</div>);}
