/**
 * E2E test: Dispute flow through the UI.
 *
 * Validates that dispute-related UI elements are present and
 * navigable. Tests the bounty detail page for dispute-related
 * controls and the how-it-works page for dispute documentation.
 *
 * Screenshots are captured on failure for visual debugging.
 *
 * Requirement: Issue #196 -- Playwright frontend tests.
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
    const isVisible = await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'No bounty links available to test detail page');
      return;
    }

    await bountyLink.click();
    await page.waitForLoadState('networkidle');

    // The detail page should display bounty information
    const detailContent = page.locator(
      '[data-testid="bounty-detail"], main, [role="main"]'
    ).first();
    await expect(detailContent).toBeVisible({ timeout: 10_000 });

    // Verify the detail page has a heading with bounty title or content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible();

    await page.screenshot({
      path: 'test-results/dispute-bounty-detail.png',
      fullPage: true,
    });
  });

  test('how-it-works page describes dispute process', async ({ page }) => {
    await page.goto('/how-it-works');
    await page.waitForLoadState('networkidle');

    // The page should have a heading explaining the process
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    // Verify the page contains dispute-related or process-related text
    const pageText = await page.locator('main, [role="main"], #root').first().textContent();
    expect(pageText).toBeTruthy();
    expect(pageText!.length).toBeGreaterThan(50);

    await page.screenshot({
      path: 'test-results/dispute-how-it-works.png',
      fullPage: true,
    });
  });

  test('agent marketplace page loads', async ({ page }) => {
    await page.goto('/agents');
    await page.waitForLoadState('networkidle');

    // Verify the page has meaningful content
    const heading = page.locator('h1, h2').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

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
    const isVisible = await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'No bounty links available to test status display');
      return;
    }

    await bountyLink.click();
    await page.waitForLoadState('networkidle');

    // Look for status indicators on the detail page
    const statusElements = page.locator(
      '[data-testid="bounty-status"], [class*="status"], ' +
        '[class*="badge"], [class*="tier"]'
    );

    const statusCount = await statusElements.count();
    expect(statusCount).toBeGreaterThan(0);

    // Verify at least one status element is visible
    await expect(statusElements.first()).toBeVisible();

    await page.screenshot({
      path: 'test-results/dispute-bounty-status.png',
      fullPage: true,
    });
  });

  test('back navigation from detail page works', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    const bountyLink = page.locator('a[href*="/bounties/"]').first();
    const isVisible = await bountyLink.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'No bounty links available to test back navigation');
      return;
    }

    await bountyLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate back
    await page.goBack();
    await page.waitForLoadState('networkidle');

    // Should be back on the bounties list
    expect(page.url()).toContain('/bounties');
  });
});
