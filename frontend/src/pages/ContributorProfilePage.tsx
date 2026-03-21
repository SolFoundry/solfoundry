/** Route entry for /profile/:username — fetches from GET /api/contributors. */
import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import ContributorProfile from '../components/ContributorProfile';
import { SkeletonCard } from '../components/common/Skeleton';

const API = (import.meta.env?.VITE_API_URL as string) || '';

export default function ContributorProfilePage() {
  const { username } = useParams<{ username: string }>();
  const [p, setP] = useState<Record<string, unknown> | null>(null);
  const [loading, setL] = useState(true);

  useEffect(() => {
    if (!username) { setL(false); return; }
    let ok = true;
    (async () => {
      try {
        const res = await fetch(`${API}/api/contributors?search=${encodeURIComponent(username)}&limit=1`);
        if (ok && res.ok) { const d = await res.json(); if (d.items?.[0]) { setP(d.items[0]); return; } }
      } catch { /* API unavailable */ }
      if (ok) setP({ username });
    })().finally(() => { if (ok) setL(false); });
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
