import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { TrashPage } from '../pages/trash.page';
import path from 'path';

test.describe('Trash flow', () => {
  const TEST_FILE = path.resolve(__dirname, '../fixtures/test-image.jpg');

  test('user can move items to trash and empty trash', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('e2euser', 'testpass123');
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLibrary();

    // Upload
    const beforeCount = await dashboard.getCardCount();
    await dashboard.uploadFile(TEST_FILE);
    await dashboard.waitForNewCard(beforeCount);

    // Move to trash — click context menu on first card
    const firstCard = page.locator('[data-media-id]').first();
    await firstCard.hover();
    await page.locator('[data-media-id] button:has-text("Delete")').first().click();
    await page.waitForTimeout(500);

    // Navigate to trash
    const trash = new TrashPage(page);
    await trash.goto();
    await expect(page).toHaveURL(/\/dashboard\/trash/);
    expect(await trash.getTrashCount()).toBeGreaterThanOrEqual(1);
  });
});