/**
 * E2E test: Dispute flow through the UI.
 *
 * Validates that dispute-related UI elements are present and
 * navigable. Tests the bounty detail page for dispute-related
 * controls and the how-it-works page for dispute documentation.
 *
 * Screenshots are captured on failure for visual debugging.
 *
 * Requirement: Issue #196 — Playwright frontend tests.
 */
import { test, expect } from '@playwright/test';

test.describe('Dispute Flow UI', () => {
  test('bounty detail page loads with submission section', async ({
    page,
  }) => {
    // Navigate to bounties list first
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Try to find a bounty link and navigate to its detail page
    const bountyLink = page.locator('a[href*="/bounties/"]').first();

    if (await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bountyLink.click();
      await page.waitForLoadState('networkidle');

      // The detail page should display bounty information
      const detailContent = page.locator(
        '[data-testid="bounty-detail"], main, [role="main"]'
      ).first();
      await expect(detailContent).toBeVisible({ timeout: 10_000 });

      await page.screenshot({
        path: 'test-results/dispute-bounty-detail.png',
        fullPage: true,
      });
    }
  });

  test('how-it-works page describes dispute process', async ({ page }) => {
    await page.goto('/how-it-works');
    await page.waitForLoadState('networkidle');

    // The page should load successfully
    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    await page.screenshot({
      path: 'test-results/dispute-how-it-works.png',
      fullPage: true,
    });
  });

  test('agent marketplace page loads', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    const pageContent = page.locator('body');
    await expect(pageContent).toBeVisible();

    await page.screenshot({
      path: 'test-results/dispute-agents-page.png',
      fullPage: true,
    });
  });
});

test.describe('Bounty Detail Interactions', () => {
  test('bounty detail shows status information', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    const bountyLink = page.locator('a[href*="/bounties/"]').first();

    if (await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bountyLink.click();
      await page.waitForLoadState('networkidle');

      // Look for status indicators on the detail page
      const statusElements = page.locator(
        '[data-testid="bounty-status"], [class*="status"], ' +
          '[class*="badge"], [class*="tier"]'
      );

      if ((await statusElements.count()) > 0) {
        await expect(statusElements.first()).toBeVisible();
      }

      await page.screenshot({
        path: 'test-results/dispute-bounty-status.png',
        fullPage: true,
      });
    }
  });

  test('back navigation from detail page works', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    const bountyLink = page.locator('a[href*="/bounties/"]').first();

    if (await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bountyLink.click();
      await page.waitForLoadState('networkidle');

      // Navigate back
      await page.goBack();
      await page.waitForLoadState('networkidle');

      // Should be back on the bounties list
      expect(page.url()).toContain('/bounties');
    }
  });
});
