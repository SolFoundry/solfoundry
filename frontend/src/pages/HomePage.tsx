import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PageLayout } from '../components/layout/PageLayout';
import { HeroSection } from '../components/home/HeroSection';
import { ActivityFeed } from '../components/home/ActivityFeed';
import { HowItWorksCondensed } from '../components/home/HowItWorksCondensed';
import { FeaturedBounties } from '../components/home/FeaturedBounties';
import { WhySolFoundry } from '../components/home/WhySolFoundry';
import { consumeOAuthFlash, type OAuthFlashKind } from '../lib/oauthFlash';

export function HomePage() {
  const [oauthBanner, setOauthBanner] = useState<{
    message: string;
    kind: OAuthFlashKind;
  } | null>(null);

  useEffect(() => {
    const flash = consumeOAuthFlash();
    if (flash) setOauthBanner(flash);
  }, []);

  const bannerStyles: Record<OAuthFlashKind, string> = {
    error: 'border-status-error/30 bg-status-error/10 text-text-primary',
    success: 'border-emerald-border bg-emerald-bg text-text-primary',
    info: 'border-status-info/30 bg-status-info/10 text-text-primary',
  };

  return (
    <PageLayout noFooter={false}>
      {oauthBanner && (
        <div
          className="fixed top-20 left-1/2 z-[100] w-[min(100%,24rem)] -translate-x-1/2 px-4"
          role="alert"
        >
          <div
            className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-sm ${bannerStyles[oauthBanner.kind]}`}
          >
            <p className="flex-1 text-sm leading-snug">{oauthBanner.message}</p>
            <button
              type="button"
              onClick={() => setOauthBanner(null)}
              className="rounded-lg p-1 text-text-muted hover:bg-forge-800 hover:text-text-primary transition-colors"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
      <HeroSection />
      <ActivityFeed />
      <HowItWorksCondensed />
      <FeaturedBounties />
      <WhySolFoundry />
    </PageLayout>
  );
}
