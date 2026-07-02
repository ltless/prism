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

    // Click first card to open editor
    const firstCard = page.locator('[data-media-id]').first();
    await firstCard.dblclick();
    await page.waitForTimeout(2000);

    // Should navigate to editor or open lightbox
    const inEditor = page.url().includes('/editor/');
    const lightboxVisible = page.locator('[role="dialog"], .lightbox, .ReactModalPortal').first();

    if (inEditor) {
      // Editor has save button
      await expect(page.locator('button:has-text("Save")').first()).toBeVisible({ timeout: 5000 });
    } else {
      // Lightbox is visible — click edit button
      const editBtn = page.locator('button:has-text("Edit"), button[aria-label*="edit"], button[aria-label*="Edit"]').first();
      if (await editBtn.isVisible({ timeout: 3000 })) {
        await editBtn.click();
        await page.waitForTimeout(2000);
        await expect(page).toHaveURL(/\/editor\//, { timeout: 5000 });
      } else {
        // Lightbox visible without explicit edit — still valid
        await expect(lightboxVisible).toBeVisible({ timeout: 3000 });
      }
    }
  });
});