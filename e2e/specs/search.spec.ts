import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import path from 'path';

test.describe('Search', () => {
  const TEST_FILE = path.resolve(__dirname, '../fixtures/test-image.jpg');

  test('user can search media by title', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('e2euser', 'testpass123');
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLibrary();

    // Upload a file first so there's something to search
    const beforeCount = await dashboard.getCardCount();
    await dashboard.uploadFile(TEST_FILE);
    await dashboard.waitForNewCard(beforeCount);

    // Focus search input and type
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('test');
    await page.waitForTimeout(1000);

    // Should match at least the uploaded file
    const results = page.locator('[data-media-id]');
    expect(await results.count()).toBeGreaterThanOrEqual(1);

    // Clear search — should see all items
    await searchInput.clear();
    await page.waitForTimeout(500);
    expect(await page.locator('[data-media-id]').count()).toBeGreaterThanOrEqual(beforeCount + 1);
  });

  test('empty search shows no results', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('e2euser', 'testpass123');
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLibrary();

    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('zzz_nonexistent_' + Date.now());
    await page.waitForTimeout(1000);

    const results = page.locator('[data-media-id]');
    expect(await results.count()).toBe(0);
  });
});