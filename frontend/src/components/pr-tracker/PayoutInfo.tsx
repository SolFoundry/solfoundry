/** PayoutInfo -- on-chain payout details with Solscan link. @module PayoutInfo */
import type { PayoutDetails } from '../../types/prStatus';
/** Renders payout amount, tx hash link, network, and timestamp. */
export function PayoutInfo({payout:p}:{payout:PayoutDetails}){
  const h=p.txHash,t=h.length>19?h.slice(0,8)+'...'+h.slice(-8):h;return(
  <div className="rounded-lg border border-green-500/20 bg-green-500/5 p-4 space-y-3" data-testid="payout-info">
    <h3 className="font-semibold text-green-400">Payout Complete</h3>
    <div className="flex items-baseline gap-2"><span className="text-3xl font-bold text-white" data-testid="payout-amount">{p.amount.toLocaleString()}</span>
      <span className="text-lg text-gray-400">{p.currency}</span></div>
    <div className="space-y-2 text-sm">
      <div className="flex justify-between"><span className="text-gray-500">Tx</span>
        <a href={`https://solscan.io/tx/${h}${p.network==='mainnet-beta'?'':`?cluster=${p.network}`}`} target="_blank" rel="noopener noreferrer"
          className="font-mono text-purple-400" data-testid="tx-link">{t}</a></div>
      <div className="flex justify-between"><span className="text-gray-500">Network</span><span className="text-gray-300">{p.network}</span></div>
    </div></div>);}
