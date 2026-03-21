/** ReviewPanel — AI review scores, creator controls, completion state. Closes #191. */
import React, { useState, useEffect, useCallback } from 'react';
interface Score { id: string; model: string; overall_score: number; categories: {name:string;score:number}[]; created_at: string }
interface Summary { submission_id:string; scores:Score[]; overall_average:number; meets_threshold:boolean; threshold:number; auto_approve_at:string|null }
interface CState { bounty_id:string; winner_wallet:string|null; payout_tx_hash:string|null; payout_amount:number|null; payout_solscan_url:string|null; completed_at:string|null }
const MN:Record<string,string>={gpt:'GPT-5.4',gemini:'Gemini 2.5 Pro',grok:'Grok 4'};
const MC:Record<string,string>={gpt:'text-green-400 bg-green-500/20',gemini:'text-blue-400 bg-blue-500/20',grok:'text-orange-400 bg-orange-500/20'};
const sc=(s:number,t:number)=>s>=t?'text-green-400':'text-red-400';
const tw=(w:string)=>w.length<=12?w:`${w.slice(0,6)}...${w.slice(-4)}`;
export const ReviewPanel:React.FC<{bountyId:string;submissionId:string;isCreator:boolean;apiBase?:string}>=({bountyId:bid,submissionId:sid,isCreator,apiBase=''})=>{
  const[sum,setSum]=useState<Summary|null>(null);const[comp,setComp]=useState<CState|null>(null);
  const[ld,setLd]=useState(true);
  const[busy,setBusy]=useState(false);const[notes,setNotes]=useState('');const[err,setErr]=useState<string|null>(null);
  const bp=`${apiBase}/api/bounties/${bid}/submissions/${sid}`;
  const load=useCallback(async()=>{try{
    const[a,b]=await Promise.all([fetch(`${bp}/scores`),fetch(`${apiBase}/api/bounties/${bid}/completion`)]);
    if(a.ok)setSum(await a.json());if(b.ok)setComp(await b.json());
  }catch{setErr('Failed');}finally{setLd(false);}},[bp,apiBase,bid]);
  useEffect(()=>{load();const id=setInterval(load,30000);return()=>clearInterval(id);},[load]);
  const decide=async(d:'approve'|'dispute')=>{setBusy(true);setErr(null);try{
    const r=await fetch(`${bp}/decision`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({decision:d,notes})});
    if(!r.ok){setErr((await r.json()).detail??'Failed');return;}await load();}catch{setErr('Network error');}finally{setBusy(false);}};
  if(ld)return<div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/></div>;
  return(<div className="space-y-6" data-testid="review-panel">
    {comp?.completed_at&&<div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 space-y-2">
      <h3 className="text-green-400 font-semibold">Bounty Completed</h3>
      {comp.winner_wallet&&<p className="text-sm text-gray-300">Winner: <span className="font-mono">{tw(comp.winner_wallet)}</span></p>}
      {comp.payout_amount!=null&&<p className="text-sm text-green-400 font-bold">{comp.payout_amount.toLocaleString()} FNDRY</p>}
      {comp.payout_solscan_url&&<a href={comp.payout_solscan_url} target="_blank" rel="noopener noreferrer" className="text-sm text-purple-400">View on Solscan</a>}
    </div>}
    {sum&&sum.scores.length>0&&<div>
      <h3 className="text-sm font-semibold text-gray-300 uppercase mb-3">AI Review Scores</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">{sum.scores.map(s=><div key={s.id} className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div className="flex justify-between mb-2"><span className={`px-2 py-1 rounded text-xs ${MC[s.model]??'text-gray-400'}`}>{MN[s.model]??s.model}</span>
        <span className={`text-2xl font-bold font-mono ${sc(s.overall_score,sum.threshold)}`}>{s.overall_score.toFixed(1)}</span></div>
        {s.categories.map(c=><div key={c.name} className="flex justify-between text-sm"><span className="text-gray-400">{c.name}</span><span className="font-mono">{c.score.toFixed(1)}</span></div>)}
      </div>)}</div>
      <div className="mt-3 bg-gray-900 rounded-lg p-4 flex justify-between items-center">
        <span className="text-gray-300">Overall</span>
        <span className={`text-3xl font-bold font-mono ${sc(sum.overall_average,sum.threshold)}`}>{sum.overall_average.toFixed(1)}<span className="text-sm text-gray-500 ml-1">/10</span>
        <span className={`ml-2 px-2 py-1 text-xs rounded ${sum.meets_threshold?'bg-green-500/20 text-green-400':'bg-red-500/20 text-red-400'}`}>{sum.meets_threshold?'PASSES':'BELOW'}</span></span>
      </div></div>}
    {isCreator&&!comp?.completed_at&&sum&&sum.scores.length>0&&<div className="bg-gray-900 rounded-lg p-4 space-y-3">
      <h3 className="text-sm font-semibold text-gray-300 uppercase">Creator Decision</h3>
      <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notes..." className="w-full bg-gray-800 border border-gray-700 rounded-lg p-3 text-sm text-white resize-none" rows={2}/>
      <div className="flex gap-3">
        <button onClick={()=>decide('approve')} disabled={busy} className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-lg min-h-[44px]">Approve & Pay</button>
        <button onClick={()=>decide('dispute')} disabled={busy} className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white py-3 rounded-lg min-h-[44px]">Dispute</button>
      </div></div>}
    {err&&<p className="text-red-400 text-sm">{err}</p>}
  </div>);};
export default ReviewPanel;
