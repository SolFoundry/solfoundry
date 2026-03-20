/** Escrow funding status shown on the bounty detail page. */
import { solscanTxUrl, solscanAddressUrl, ESCROW_WALLET } from '../../config/constants';
import type { SolanaNetwork } from '../../types/wallet';

interface EscrowStatusProps {
  funded: boolean;
  amount: number;
  signature?: string;
  network?: SolanaNetwork;
}

export function EscrowStatus({
  funded,
  amount,
  signature,
  network = 'mainnet-beta',
}: EscrowStatusProps) {
  const escrowAddr = ESCROW_WALLET.toBase58();

  return (
    <div className="bg-gray-900 rounded-lg p-4 sm:p-6">
      <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full ${funded ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`}
        />
        Escrow Status
      </h2>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Status</span>
          <span className={`text-sm font-medium ${funded ? 'text-green-400' : 'text-yellow-400'}`}>
            {funded ? 'Funded' : 'Awaiting Funding'}
          </span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-gray-400 text-sm">Escrowed</span>
          <span className="text-green-400 font-bold">
            {funded ? `${amount.toLocaleString()} $FNDRY` : '—'}
          </span>
        </div>

        {funded && signature && (
          <a
            href={solscanTxUrl(signature, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-purple-700/30 text-purple-400 hover:bg-purple-900/20 text-sm transition-colors mt-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
              />
            </svg>
            View Transaction on Solscan
          </a>
        )}

        <a
          href={solscanAddressUrl(escrowAddr, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center py-1.5 text-xs text-gray-500 hover:text-gray-400 transition-colors"
        >
          Escrow Account ↗
        </a>
      </div>
    </div>
  );
}
