import React from 'react';
import { useParams } from 'react-router-dom';
import { PageLayout } from '../components/layout/PageLayout';
import { BountyDetail } from '../components/bounty/BountyDetail';
import { BountyDetailSkeleton } from '../components/skeletons';
import { useBounty } from '../hooks/useBounties';
import { fadeIn } from '../lib/animations';
import { motion } from 'framer-motion';

export function BountyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: bounty, isLoading, isError } = useBounty(id);

  return (
    <PageLayout>
      {isLoading && <BountyDetailSkeleton />}

      {isError && !isLoading && (
        <div className="max-w-4xl mx-auto px-4 py-16 text-center">
          <p className="text-text-muted text-lg mb-2">Bounty not found</p>
          <p className="text-text-muted text-sm">This bounty may have been removed or the ID is invalid.</p>
        </div>
      )}

      {bounty && !isLoading && <BountyDetail bounty={bounty} />}
    </PageLayout>
  );
}
