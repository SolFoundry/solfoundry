import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { ProfileDashboard } from '../components/profile/ProfileDashboard';
import { GitHubActivityGraph } from '../components/profile/GitHubActivityGraph';

export function ProfilePage() {
  return (
    <PageLayout>
      <ProfileDashboard />
      <GitHubActivityGraph stats={{ commits: 142, prs: 14, issues: 8, streak: 5 }} />
    </PageLayout>
  );
}
