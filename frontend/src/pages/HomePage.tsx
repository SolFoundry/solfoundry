import React, { useState, useEffect } from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { fetchActivities } from '../services/activities';
import type { ActivityEvent } from '../services/activities';

const ACTIVITY_POLL_INTERVAL_MS = 30_000;

export function HomePage() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);

  useEffect(() => {
    fetchActivities().then(setActivities).catch(() => {});

    const interval = setInterval(async () => {
      try {
        const data = await fetchActivities();
        setActivities(data);
      } catch {}
    }, ACTIVITY_POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, []);

  return (
    <PageLayout noFooter={false}>
      <HeroSection />
      <ActivityFeed events={activities} />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}
