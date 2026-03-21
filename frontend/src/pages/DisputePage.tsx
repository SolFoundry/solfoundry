/** Route entry point for /disputes/:id — fetches and renders dispute detail */
import { useParams, useNavigate } from 'react-router-dom';
import { useWallet } from '@solana/wallet-adapter-react';
import { DisputePage as DisputePageComponent } from '../components/disputes';

export default function DisputeRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { publicKey } = useWallet();

  if (!id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400 font-mono">No dispute ID provided</p>
        <button
          onClick={() => navigate('/bounties')}
          className="px-4 py-2 rounded-lg bg-[#9945FF]/20 text-[#9945FF] hover:bg-[#9945FF]/30 transition-colors"
        >
          Back to Bounties
        </button>
      </div>
    );
  }

  const currentUserId = publicKey?.toBase58() ?? '';

  return (
    <DisputePageComponent
      disputeId={id}
      currentUserId={currentUserId}
      isAdmin={false}
    />
  );
}
