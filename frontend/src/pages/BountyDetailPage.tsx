/** Route entry point for /bounties/:id — fetches bounty then renders detail */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import BountyDetailComponent from '../components/BountyDetailPage';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export default function BountyDetailRoute() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [bounty, setBounty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/bounties/${id}`);
        if (!cancelled && res.ok) {
          setBounty(await res.json());
        } else if (!cancelled) {
          setError(`Bounty #${id} not found`);
        }
      } catch {
        if (!cancelled) setError('Failed to load bounty');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-2 border-solana-purple border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !bounty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="text-gray-400 font-mono">{error ?? 'Bounty not found'}</p>
        <button
          onClick={() => navigate('/bounties')}
          className="px-4 py-2 rounded-lg bg-solana-purple/20 text-solana-purple hover:bg-solana-purple/30 transition-colors"
        >
          ← Back to Bounties
        </button>
      </div>
    );
  }

  return <BountyDetailComponent bounty={bounty} />;
}
