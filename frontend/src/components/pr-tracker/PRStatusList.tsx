/** PRStatusList -- filterable list of PR tracker cards. @module PRStatusList */
import { useState } from 'react';
import type { PRStatus, PROutcome } from '../../types/prStatus';
import { PRStatusTracker } from './PRStatusTracker';
const ORD:Record<PROutcome,number>={in_progress:0,approved:1,paid:2,denied:3};
/** Renders sorted list of PR cards. */
export function PRStatusList({statuses,filterOutcome,className=''}:{statuses:PRStatus[];filterOutcome?:PROutcome;className?:string}){
  const [eid,setEid]=useState<string|null>(null);
  const list=[...(filterOutcome?statuses.filter(s=>s.outcome===filterOutcome):statuses)].sort((a,b)=>ORD[a.outcome]-ORD[b.outcome]);
  if(!list.length)return(<div className="rounded-xl border border-gray-800 bg-surface-50 p-8 text-center" data-testid="pr-status-list-empty"><p className="text-gray-500">No PR submissions found.</p></div>);
  return(<div className={`space-y-4 ${className}`} data-testid="pr-status-list">{list.map(s=>(
    <div key={s.id} onClick={()=>setEid(p=>p===s.id?null:s.id)} onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setEid(p=>p===s.id?null:s.id);}}}
      role="button" tabIndex={0} aria-expanded={eid===s.id} className="cursor-pointer" data-testid={`pr-status-item-${s.id}`}>
      <PRStatusTracker prStatus={s} compact={eid!==s.id}/></div>))}</div>);
}
