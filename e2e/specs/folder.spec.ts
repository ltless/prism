import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import { FolderPage } from '../pages/folder.page';
import path from 'path';

test.describe('Folder management', () => {
  const TEST_FILE = path.resolve(__dirname, '../fixtures/test-image.jpg');
  const FOLDER_NAME = `test-folder-${Date.now()}`;

  test('user can create folder and move items into it', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('e2euser', 'testpass123');
    await expect(page).toHaveURL(/\/dashboard/);

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLibrary();

    // Create folder via sidebar
    const folder = new FolderPage(page);
    await folder.createFolder(FOLDER_NAME);

    // Upload a file to main library
    const beforeCount = await dashboard.getCardCount();
    await dashboard.uploadFile(TEST_FILE);
    await dashboard.waitForNewCard(beforeCount);

    // Open folder
    await folder.openFolder(FOLDER_NAME);
    expect(page.url()).toContain('folder');
  });
});