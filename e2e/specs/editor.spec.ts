import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import path from 'path';

test.describe('Editor', () => {
  const TEST_FILE = path.resolve(__dirname, '../fixtures/test-image.jpg');

  test('user can open image editor from media card', async ({ page }) => {
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

    // Click first card to open lightbox editor
    const firstCard = page.locator('[data-media-id]').first();
    await firstCard.dblclick();
    await page.waitForTimeout(2000);

    // Lightbox is visible — open the in-line editor
    const lightbox = page.locator('[role="dialog"]').first();
    await expect(lightbox).toBeVisible({ timeout: 5000 });
    await lightbox.locator('button[aria-label="Edit"]').click();
    // The Edit button toggles the in-line ImageEditor (no URL navigation).
    // Its top bar renders the menu labels ("File", "Edit"); "Save Copy" only
    // appears once the File menu is opened.
    await expect(lightbox.getByText('File').first()).toBeVisible({ timeout: 15000 });
    await expect(lightbox.getByText('Edit').first()).toBeVisible({ timeout: 15000 });
  });
});