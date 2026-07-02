import type { Page } from '@playwright/test';

export class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.page.fill('#username', username);
    await this.page.fill('#password', password);
    await this.page.click('button[type="submit"]');
    // Server action calls redirect("/dashboard") on success
    await this.page.waitForURL('/dashboard', { timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
  }
}
