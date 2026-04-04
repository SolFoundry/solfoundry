import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';

export function HomePage() {
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
