/** AIReviewScores -- AI review breakdown with score bars. @module AIReviewScores */
import type { AIReviewResult, AIScore } from '../../types/prStatus';
const c=(n:number)=>n>=80?{b:'bg-green-400',t:'text-green-400'}:n>=60?{b:'bg-yellow-400',t:'text-yellow-400'}:n>=40?{b:'bg-orange-400',t:'text-orange-400'}:{b:'bg-red-400',t:'text-red-400'};
function Bar({score:s}:{score:AIScore}){const k=c(s.score),p=Math.round(s.score/s.maxScore*100);return(
  <div className="space-y-1" data-testid={`ai-score-${s.category}`}>
    <div className="flex justify-between text-sm"><span className="text-gray-300">{s.label}</span>
      <span className={`font-mono font-semibold ${k.t}`}>{s.score}/{s.maxScore}</span></div>
    <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
      <div className={`h-full rounded-full ${k.b}`} style={{width:`${p}%`}} role="progressbar" aria-valuenow={s.score} aria-valuemin={0} aria-valuemax={s.maxScore}/></div>
    {s.details&&<p className="text-xs text-gray-500">{s.details}</p>}</div>);}
/** Renders AI review scores. */
export function AIReviewScores({review:r}:{review:AIReviewResult}){const k=c(r.overallScore);return(
  <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-4 space-y-4" data-testid="ai-review-scores">
    <div className="flex items-center justify-between">
      <h3 className="font-semibold text-white">AI Review Scores</h3>
      <div className="flex items-center gap-2">
        <span className={`text-lg font-bold font-mono ${k.t}`}>{r.overallScore}/{r.maxScore}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${r.passed?'bg-green-500/10 text-green-400 border border-green-500/30':'bg-red-500/10 text-red-400 border border-red-500/30'}`}>{r.passed?'PASSED':'FAILED'}</span></div></div>
    <div className="space-y-3">{r.scores.map(s=><Bar key={s.category} score={s}/>)}</div></div>);}
