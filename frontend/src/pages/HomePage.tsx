import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { FNDRYPriceWidget } from '../components/fndry/FNDRYPriceWidget';

export function HomePage() {
 return (
 <PageLayout noFooter={false}>
 <HeroSection />
 <div className="max-w-7xl mx-auto px-4 -mt-8 mb-8">
 <FNDRYPriceWidget variant="default" />
 </div>
 <ActivityFeed />
 <HowItWorksCondensed />
 <FeaturedBounties />
 <WhySolFoundry />
 </PageLayout>
 );
}
