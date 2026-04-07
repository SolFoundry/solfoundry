import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { ProfileDashboard } from '../components/profile/ProfileDashboard';

export function ProfilePage() {
  return (
    <PageLayout>
      <ProfileDashboard />
    </PageLayout>
  );
}
