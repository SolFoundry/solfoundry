/** Route for /profile/:username — exact lookup via apiClient, resets on route change. */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ContributorProfile from '../components/ContributorProfile';
import { SkeletonCard } from '../components/common/Skeleton';
import { apiClient } from '../services/apiClient';

interface ContributorData { username: string; avatar_url?: string; wallet_address?: string; total_earned?: number; bounties_completed?: number; reputation_score?: number; }

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<ContributorData | null>(null);
  const [loading, setL] = useState(true);

  useEffect(() => {
    setP(null); setL(true);
    if (!username) { setL(false); return; }
    let ok = true;
    (async () => {
      try {
        const data = await apiClient<ContributorData>(`/api/contributors/${encodeURIComponent(username)}`, { retries: 1 });
        if (ok) setP(data);
      } catch { if (ok) setP({ username }); }
      finally { if (ok) setL(false); }
    })();
    return () => { ok = false; };
  }, [username]);

  if (loading) return <div className="p-6 max-w-3xl mx-auto" role="status"><SkeletonCard showAvatar bodyLines={3} showFooter /></div>;
  return (
    <ContributorProfile
      username={String(p?.username ?? username ?? '')}
      avatarUrl={String(p?.avatar_url ?? `https://avatars.githubusercontent.com/${username}`)}
      walletAddress={String(p?.wallet_address ?? '')}
      totalEarned={Number(p?.total_earned ?? 0)}
      bountiesCompleted={Number(p?.bounties_completed ?? 0)}
      reputationScore={Number(p?.reputation_score ?? 0)}
    />
  );
}
