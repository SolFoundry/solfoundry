import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { BountyGrid } from '../components/bounty/BountyGrid';

export function HomePage() {
  return (
    <PageLayout noFooter={false}>
      <HeroSection />
      <ActivityFeed />
      <BountyGrid />
    </PageLayout>
  );
}
