import React from 'react';
import { PageLayout } from '../components/layout/PageLayout';
import { ContributorOnboardingWizard } from '../components/onboarding/ContributorOnboardingWizard';

export function OnboardingPage() {
  return (
    <PageLayout>
      <div className="pt-8">
        <ContributorOnboardingWizard />
      </div>
    </PageLayout>
  );
}