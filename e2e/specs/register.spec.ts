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

    // Valid invite code accepted → setup wizard
    await expect(page).toHaveURL(/\/setup/, { timeout: 15000 });

    // Complete the setup wizard
    const setup = new SetupPage(page);
    await setup.completeSetup();

    // Land on dashboard
    await expect(page).toHaveURL('/dashboard');

    // Verify media grid or empty state is visible
    const cards = page.locator('[data-media-id]');
    if ((await cards.count()) > 0) {
      await expect(cards.first()).toBeVisible({ timeout: 10000 });
    } else {
      await page.waitForFunction(
        () => (document.body.textContent || '').includes('No Files Yet'),
        { timeout: 10000 },
      );
    }
  });

  test('register rejects a wrong invite code', async ({ page }) => {
    const register = new RegisterPage(page);
    await register.goto();
    await register.register(`e2e-bad-${Date.now()}`, TEST_PASS, 'definitely-not-the-code');

    // Rejected: inline error (Next's route announcer is also role=alert — take first), no redirect
    await expect(page.locator('[role="alert"]').first()).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/\/register/);
  });
});