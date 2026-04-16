import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { ForgeVisualization } from '../components/home/ForgeVisualization';

export function HomePage() {
  return (
    <PageLayout noFooter={false}>
      {/* 3D Forge Visualization - Interactive WebGL scene showing bounties being forged */}
      <div className="relative w-full h-[500px] md:h-[600px] overflow-hidden rounded-xl border border-border bg-forge-950">
        <ForgeVisualization bountyCount={5} />
      </div>
      <HeroSection />
      <ActivityFeed />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}