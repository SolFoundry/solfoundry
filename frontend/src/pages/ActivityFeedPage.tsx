import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { EventFeed } from '../components/activity/EventFeed';

export function ActivityFeedPage() {
  return (
    <PageLayout>
      <div className="min-h-screen bg-forge-950 bg-[image:var(--background-image-grid-forge)] bg-[length:40px_40px]">
        <div className="pt-24 pb-12">
          <EventFeed />
        </div>
      </div>
    </PageLayout>
  );
}