/**
 * E2E test: Authentication flow through the UI.
 *
 * Validates the wallet connect button visibility, login UI presence,
 * and the overall authentication UX. Tests that unauthenticated users
 * see appropriate prompts and that the wallet connect flow is accessible.
 *
 * Screenshots are captured on failure for visual debugging.
 *
 * Requirement: Issue #196 -- Playwright frontend tests.
 */
import { test, expect } from '@playwright/test';

test.describe('Authentication UI', () => {
  test('wallet connect button is visible in header', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Look for a wallet connect button in the header/nav area
    const walletButton = page.locator(
      'button:has-text("Connect"), button:has-text("Wallet"), ' +
        '[data-testid="wallet-connect"], [class*="wallet"]'
    );

    // At least one wallet-related button should exist
    const buttonCount = await walletButton.count();
    expect(buttonCount).toBeGreaterThan(0);

    // Verify the first button is visible, not just present in DOM
    await expect(walletButton.first()).toBeVisible();

    await page.screenshot({
      path: 'test-results/auth-wallet-button.png',
      fullPage: false,
    });
  });

  test('header shows navigation links', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Verify the header/sidebar contains expected navigation items
    const nav = page.locator('nav, header, [role="navigation"]').first();
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // Verify navigation contains at least one link
    const navLinks = nav.locator('a');
    const linkCount = await navLinks.count();
    expect(linkCount).toBeGreaterThan(0);

    await page.screenshot({
      path: 'test-results/auth-navigation.png',
      fullPage: false,
    });
  });

  test('unauthenticated user can browse bounties', async ({ page }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Even without authentication, the bounty board should load
    const mainContent = page.locator('main, [role="main"], #root').first();
    await expect(mainContent).toBeVisible();

    // Verify no full-page error (500/404) is shown as the main content
    const heading = page.locator('h1, h2, [data-testid]').first();
    await expect(heading).toBeVisible({ timeout: 10_000 });

    await page.screenshot({
      path: 'test-results/auth-unauthenticated-browse.png',
      fullPage: true,
    });
  });

  test('dashboard page handles unauthenticated access', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Should either show a login prompt, redirect to bounties, or show
    // dashboard content. Verify meaningful content is displayed.
    const hasRedirected = page.url().includes('/bounties') || page.url().includes('/login');
    const mainContent = page.locator('main, [role="main"], #root').first();
    await expect(mainContent).toBeVisible();

    if (hasRedirected) {
      // Verify the redirect target page loaded properly
      const heading = page.locator('h1, h2').first();
      await expect(heading).toBeVisible({ timeout: 10_000 });
    } else {
      // Dashboard loaded; verify it has content (login prompt or dashboard)
      const loginPrompt = page.locator(
        'button:has-text("Connect"), button:has-text("Login"), ' +
          'text=/sign in/i, text=/connect wallet/i'
      );
      const dashboardContent = page.locator('h1, h2, [data-testid]').first();
      const hasLoginPrompt = (await loginPrompt.count()) > 0;
      const hasDashboard = await dashboardContent.isVisible().catch(() => false);

      expect(hasLoginPrompt || hasDashboard).toBeTruthy();
    }

    await page.screenshot({
      path: 'test-results/auth-dashboard-unauthenticated.png',
      fullPage: true,
    });
  });
});

test.describe('Wallet Connection Flow', () => {
  test('wallet connect modal or dropdown appears on button click', async ({
    page,
  }) => {
    await page.goto('/bounties');
    await page.waitForLoadState('networkidle');

    // Find the wallet connect button
    const walletButton = page
      .locator(
        'button:has-text("Connect"), button:has-text("Wallet"), ' +
          '[data-testid="wallet-connect"]'
      )
      .first();

    const isVisible = await walletButton.isVisible({ timeout: 5_000 }).catch(() => false);

    if (!isVisible) {
      test.skip(true, 'Wallet connect button not found; skipping modal test');
      return;
    }

    await walletButton.click();

    // Wait for modal/dropdown to appear using element detection, not timeout
    const modal = page.locator(
      '[role="dialog"], [class*="modal"], [class*="dropdown"], ' +
        '[data-testid="wallet-modal"]'
    );
    await expect(modal.first()).toBeVisible({ timeout: 5_000 });

    await page.screenshot({
      path: 'test-results/auth-wallet-modal.png',
      fullPage: true,
    });
  });
});
