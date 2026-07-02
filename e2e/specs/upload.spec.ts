import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/login.page';
import { DashboardPage } from '../pages/dashboard.page';
import path from 'path';

test.describe('Upload flow', () => {
  test('uploads an image and shows it in the grid', async ({ page }) => {
    const login = new LoginPage(page);
    await login.goto();
    await login.login('e2euser', 'testpass123');

    const dashboard = new DashboardPage(page);
    await dashboard.waitForLibrary();

    const beforeCount = await dashboard.getCardCount();
    
    const fixturePath = path.resolve(__dirname, '..', 'fixtures', 'test-image.jpg');
    await dashboard.uploadFile(fixturePath);

    await dashboard.waitForNewCard(beforeCount);
    
    const afterCount = await dashboard.getCardCount();
    expect(afterCount).toBeGreaterThan(beforeCount);
  });
});
