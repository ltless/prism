import type { Page } from '@playwright/test';

export class SetupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/setup');
  }

  async completeSetup() {
    // Profile step — click continue
    await this.page.getByText('Continue').click();
    // Vault step — the PIN is mandatory in this UI: enter 6 digits on the
    // numpad, then continue.
    for (const digit of '123456') {
      await this.page.getByRole('button', { name: digit }).click();
    }
    await this.page.getByText('Continue').click();
    // Finish step — "Initialize" lands on the dashboard
    await this.page.getByText('Initialize').click();
    await this.page.waitForURL('/dashboard', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }
}