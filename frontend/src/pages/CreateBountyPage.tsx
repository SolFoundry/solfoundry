/** CreateBountyPage - 7-step bounty wizard. Auth-gated, XSS-safe preview, wallet-scoped drafts. @see issue #24 */
import { useState, useCallback, useEffect, useMemo } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { useWalletConnection } from '../hooks/useWallet';
import type { BountyTier } from '../types/bounty';
import { SKILL_OPTIONS } from '../types/bounty';

export interface BountyDraft { title: string; description: string; tier: BountyTier; skills: string[]; rewardAmount: string; currency: string; deadline: string; }
export interface BountySubmitPayload { title: string; description: string; tier: BountyTier; skills: string[]; rewardAmount: number; currency: string; deadline: string; }

const STEPS = ['Title','Description','Tier','Skills','Reward','Deadline','Review'] as const;
const EMPTY: BountyDraft = { title: '', description: '', tier: 'T1', skills: [], rewardAmount: '', currency: 'USDC', deadline: '' };
const TIERS: BountyTier[] = ['T1','T2','T3'];
const CUR = ['USDC','SOL'];
const dk = (a: string) => `solfoundry_bounty_draft_${a}`;

export function validateDraftShape(data: unknown): BountyDraft | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Record<string, unknown>;
  if (typeof d.title !== 'string' || typeof d.description !== 'string') return null;
  if (typeof d.tier !== 'string' || !TIERS.includes(d.tier as BountyTier)) return null;
  if (!Array.isArray(d.skills) || !d.skills.every((s: unknown) => typeof s === 'string')) return null;
  if (typeof d.rewardAmount !== 'string' || typeof d.deadline !== 'string') return null;
  if (typeof d.currency !== 'string' || !CUR.includes(d.currency)) return null;
  return { title: d.title, description: d.description, tier: d.tier as BountyTier, skills: d.skills as string[], rewardAmount: d.rewardAmount, currency: d.currency, deadline: d.deadline };
}

export function sanitizeHtml(raw: string): string {
  return raw.replace(/<script[\s>][\s\S]*?<\/script\s*>/gi, '').replace(/<\/?script[^>]*>/gi, '')
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/(href|src)\s*=\s*["']?\s*javascript\s*:/gi, '$1="')
    .replace(/(href|src)\s*=\s*["']?\s*data\s*:/gi, '$1="');
}

export function buildPayload(d: BountyDraft): BountySubmitPayload {
  return { title: d.title.trim(), description: d.description.trim(), tier: d.tier, skills: [...d.skills], rewardAmount: Number(d.rewardAmount), currency: d.currency, deadline: d.deadline };
}

function isValid(s: number, d: BountyDraft): boolean {
  if (s===0) return d.title.trim().length >= 5;
  if (s===1) return d.description.trim().length >= 20;
  if (s===2) return TIERS.includes(d.tier);
  if (s===3) return d.skills.length >= 1;
  if (s===4) return Number(d.rewardAmount) > 0 && CUR.includes(d.currency);
  if (s===5) return d.deadline !== '' && new Date(d.deadline) > new Date();
  return s===6;
}

const IC = 'w-full rounded-lg border border-gray-700 bg-surface-100 px-4 py-2 text-white';
const LC = 'mb-2 block text-sm font-medium text-gray-300';
const BC = 'rounded-lg border px-6 py-2 text-sm font-medium';

export function CreateBountyPage() {
  const [col, setCol] = useState(false);
  const { connected, displayInfo } = useWalletConnection();
  const wa = displayInfo?.address ?? '';
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<BountyDraft>(EMPTY);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string|null>(null);

  useEffect(() => {
    if (!wa) return;
    try { const r = localStorage.getItem(dk(wa)); if (!r) return; const v = validateDraftShape(JSON.parse(r)); if (v) setDraft(v); else localStorage.removeItem(dk(wa)); }
    catch { localStorage.removeItem(dk(wa)); }
  }, [wa]);
  useEffect(() => { if (!wa||done) return; try { localStorage.setItem(dk(wa), JSON.stringify(draft)); } catch {} }, [draft, wa, done]);

  const ok = useMemo(() => isValid(step, draft), [step, draft]);
  const S = useCallback(<K extends keyof BountyDraft>(k: K, v: BountyDraft[K]) => setDraft(d => ({ ...d, [k]: v })), []);
  const tog = useCallback((sk: string) => setDraft(d => ({ ...d, skills: d.skills.includes(sk) ? d.skills.filter(x => x !== sk) : [...d.skills, sk] })), []);
  const submit = useCallback(async () => {
    setErr(null);
    try { const r = await fetch('/api/bounties', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify(buildPayload(draft)) }); if (!r.ok) throw new Error(`Server error: ${r.status}`); setDone(true); if (wa) localStorage.removeItem(dk(wa)); }
    catch (e) { setErr(e instanceof Error ? e.message : 'Submission failed'); }
  }, [draft, wa]);

  return (
    <div className="flex min-h-screen bg-surface dark">
      <Sidebar collapsed={col} onToggle={() => setCol(c => !c)} />
      <main className={'flex-1 transition-all ' + (col ? 'ml-16' : 'ml-64')} role="main" aria-label="Create bounty">
        <div className="mx-auto max-w-2xl p-8">
          <h1 className="mb-6 text-2xl font-bold text-white">Create Bounty</h1>
          {!connected ? <div data-testid="auth-gate" className="rounded-xl border border-gray-700 p-8 text-center"><p className="text-gray-300">Connect your wallet to create a bounty.</p></div>
          : done ? <div data-testid="success-message" className="rounded-xl border border-green-700 p-8 text-center"><p className="text-green-400 font-semibold">Bounty submitted successfully!</p></div>
          : <>
            <nav aria-label="Wizard steps" className="mb-8"><ol className="flex gap-2" data-testid="step-indicators">
              {STEPS.map((l,i) => <li key={l} className={'flex-1 rounded px-2 py-1 text-center text-xs ' + (i===step ? 'bg-[#00FF88] text-black' : i<step ? 'bg-gray-700 text-gray-300' : 'bg-gray-800 text-gray-500')}>{l}</li>)}
            </ol></nav>
            <div data-testid="step-content" className="mb-6 space-y-4">
              {step===0 && <div><label htmlFor="bt" className={LC}>Title (min 5 chars)</label><input id="bt" data-testid="input-title" maxLength={100} value={draft.title} onChange={e => S('title', e.target.value)} className={IC} /></div>}
              {step===1 && <div><label htmlFor="bd" className={LC}>Description (min 20 chars)</label><textarea id="bd" data-testid="input-description" rows={6} value={draft.description} onChange={e => S('description', e.target.value)} className={IC} /></div>}
              {step===2 && <fieldset><legend className={LC}>Tier</legend><div className="flex gap-3" data-testid="tier-select">{TIERS.map(t => <button key={t} type="button" onClick={() => S('tier', t)} className={BC+' '+(draft.tier===t?'border-[#00FF88] text-[#00FF88]':'border-gray-700 text-gray-400')}>{t}</button>)}</div></fieldset>}
              {step===3 && <fieldset><legend className={LC}>Skills (at least 1)</legend><div className="flex flex-wrap gap-2" data-testid="skill-select">{SKILL_OPTIONS.map(sk => <button key={sk} type="button" onClick={() => tog(sk)} className={'rounded-full border px-4 py-1 text-sm '+(draft.skills.includes(sk)?'border-[#00FF88] text-[#00FF88]':'border-gray-700 text-gray-400')}>{sk}</button>)}</div></fieldset>}
              {step===4 && <div className="flex gap-4"><div className="flex-1"><label htmlFor="br" className={LC}>Reward</label><input id="br" data-testid="input-reward" type="number" min="1" value={draft.rewardAmount} onChange={e => S('rewardAmount', e.target.value)} className={IC} /></div><div><label htmlFor="bc" className={LC}>Currency</label><select id="bc" data-testid="select-currency" value={draft.currency} onChange={e => S('currency', e.target.value)} className={IC}>{CUR.map(c => <option key={c}>{c}</option>)}</select></div></div>}
              {step===5 && <div><label htmlFor="bdl" className={LC}>Deadline</label><input id="bdl" data-testid="input-deadline" type="date" value={draft.deadline} onChange={e => S('deadline', e.target.value)} className={IC} min={new Date().toISOString().split('T')[0]} /></div>}
              {step===6 && <div data-testid="review-step" className="space-y-3">
                <h2 className="text-lg font-semibold text-white">Review</h2>
                <dl className="space-y-1 text-sm">
                  {[['Title',draft.title,'review-title'],['Tier',draft.tier],['Skills',draft.skills.join(', ')],['Reward',`${draft.rewardAmount} ${draft.currency}`],['Deadline',draft.deadline]].map(([k,v,tid]) => <div key={k} className="flex justify-between"><dt className="text-gray-400">{k}</dt><dd className="text-white" {...(tid?{'data-testid':tid}:{})}>{v}</dd></div>)}
                </dl>
                <div data-testid="description-preview" className="prose prose-invert text-sm border border-gray-700 rounded p-3" dangerouslySetInnerHTML={{ __html: sanitizeHtml(draft.description) }} />
                {err && <p data-testid="submit-error" className="text-red-400 text-sm">{err}</p>}
              </div>}
            </div>
            <div className="flex justify-between">
              <button type="button" onClick={() => step>0 && setStep(s=>s-1)} disabled={step===0} data-testid="btn-prev" className={BC+' border-gray-700 text-gray-300 disabled:opacity-40'}>Back</button>
              {step<6 ? <button type="button" onClick={() => ok&&setStep(s=>s+1)} disabled={!ok} data-testid="btn-next" className={BC+' bg-[#00FF88] text-black disabled:opacity-40'}>Next</button>
                : <button type="button" onClick={submit} data-testid="btn-submit" className={BC+' bg-[#00FF88] text-black'}>Submit Bounty</button>}
            </div>
          </>}
        </div>
      </main>
    </div>);
}
export default CreateBountyPage;
