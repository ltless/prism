import { test, expect } from '@playwright/test';
import { RegisterPage } from '../pages/register.page';
import { SetupPage } from '../pages/setup.page';

const TEST_USER = `e2e-reg-${Date.now()}`;
const TEST_PASS = 'testpass123';

test.describe('Registration', () => {
  test('new user registers, completes setup, lands on dashboard', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await expect(page.locator('#username')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();

    await register.register(TEST_USER, TEST_PASS);

    // Should now be on setup wizard
    await expect(page).toHaveURL(/\/setup/);

    // Complete the setup wizard
    const setup = new SetupPage(page);
    await setup.completeSetup();

    // Land on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verify media grid or empty state is visible
    await page.waitForTimeout(2000);
    await expect(page.locator('[data-testid="media-grid"], [data-testid="empty-library"]').first()).toBeVisible({ timeout: 10000 });
  });
});