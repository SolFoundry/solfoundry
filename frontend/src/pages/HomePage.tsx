import React, { useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { useToast } from '../contexts/ToastContext';

export function HomePage() {
  const { showToast } = useToast();

  useEffect(() => {
    // Demo toast on mount
    showToast('Welcome to SolFoundry! Forge the future.', 'success');
  }, [showToast]);

  return (
    <PageLayout noFooter={false}>
      <HeroSection />
      <ActivityFeed />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}
