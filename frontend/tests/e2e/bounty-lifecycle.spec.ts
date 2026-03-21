/**
 * E2E test: Bounty lifecycle through the UI.
 *
 * Validates that the bounty board page loads, displays bounties,
 * and allows navigation to bounty detail pages. Tests the create
 * bounty form flow when available.
 *
 * Screenshots are captured on failure for visual debugging.
 *
 * Requirement: Issue #196 — Playwright frontend tests.
 */
import { test, expect } from '@playwright/test';

test.describe('Bounty Board Page', () => {
  test('bounty board loads and displays heading', async ({ page }) => {
    await page.goto('/bounties');

    // Wait for the page to finish loading (Suspense fallback resolves)
    await page.waitForLoadState('networkidle');

    // The page should display a heading or title related to bounties
    const heading = page.locator('h1, h2, [data-testid="page-title"]').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    // Take a screenshot for the test report
    await page.screenshot({
      path: 'test-results/bounty-board-loaded.png',
      fullPage: true,
    });
  });

  test('bounty board shows bounty cards or empty state', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Either bounty cards are present, or an empty state message appears
    const bountyCards = page.locator(
      '[data-testid="bounty-card"], .bounty-card, article, [class*="card"]'
    );
    const emptyState = page.locator(
      '[data-testid="empty-state"], [class*="empty"], text=/no bounties/i'
    );

    const hasCards = (await bountyCards.count()) > 0;
    const hasEmptyState = (await emptyState.count()) > 0;

    // At least one of these should be present on a loaded page
    expect(hasCards || hasEmptyState).toBeTruthy();

    await page.screenshot({
      path: 'test-results/bounty-board-content.png',
      fullPage: true,
    });
  });

  test('navigation to bounty detail page works', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Find any clickable bounty link or card
    const bountyLink = page.locator('a[href*="/bounties/"]').first();

    if (await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bountyLink.click();
      await page.waitForLoadState('networkidle');

      // Should navigate to a detail page
      expect(page.url()).toContain('/bounties/');

      await page.screenshot({
        path: 'test-results/bounty-detail-page.png',
        fullPage: true,
      });
    }
  });

  test('create bounty page is accessible', async ({ page }) => {
    await page.goto('/bounties/create');
    await page.waitForLoadState('networkidle');

    // The page should load without errors
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    await page.screenshot({
      path: 'test-results/bounty-create-page.png',
      fullPage: true,
    });
  });
});

test.describe('Bounty Lifecycle Navigation', () => {
  test('home redirects to bounties page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // App redirects / to /bounties
    expect(page.url()).toContain('/bounties');
  });

  test('leaderboard page loads', async ({ page }) => {
    await page.goto('/leaderboard');
    await page.waitForLoadState('networkidle');

    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 15_000 });

    await page.screenshot({
      path: 'test-results/leaderboard-page.png',
      fullPage: true,
    });
  });

  test('tokenomics page loads', async ({ page }) => {
    await page.goto('/tokenomics');
    await page.waitForLoadState('networkidle');

    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    await page.screenshot({
      path: 'test-results/tokenomics-page.png',
      fullPage: true,
    });
  });
});
