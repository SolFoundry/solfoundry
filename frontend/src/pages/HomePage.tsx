import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { ForgeVisualization } from '../components/forge/ForgeVisualization';

export function HomePage() {
  return (
    <PageLayout noFooter={false}>
      <HeroSection />
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-2 text-forge-100">
          🔥 The Forge
        </h2>
        <p className="text-center text-forge-400 mb-8">
          Watch bounties being forged in real-time on the SolFoundry marketplace
        </p>
        <ForgeVisualization />
      </section>
      <ActivityFeed />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}
