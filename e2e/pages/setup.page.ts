import type { Page } from '@playwright/test';

export class SetupPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/setup');
  }

  async completeSetup() {
    // Profile step — click continue
    await this.page.getByText('Continue').click();
    // Storage step — click continue
    await this.page.getByText('Continue').click();
    // Vault step — skip
    await this.page.getByText('Skip').click();
    // Finish step — should land on dashboard
    await this.page.waitForURL('/dashboard', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }
}