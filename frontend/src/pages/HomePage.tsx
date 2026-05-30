import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { useActivity } from '../hooks/useActivity';

export function HomePage() {
  const { data: events } = useActivity();

  return (
    <PageLayout noFooter={false}>
      <HeroSection />
      <ActivityFeed events={events} />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}
