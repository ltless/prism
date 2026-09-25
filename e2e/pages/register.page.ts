import type { Page } from '@playwright/test';

export class RegisterPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/register');
  }

  async register(username: string, password: string, inviteCode?: string) {
    await this.page.fill('#username', username);
    await this.page.fill('#password', password);
    await this.page.fill('#confirmPassword', password);
    // REQUIRE_INVITE=true by default — always fill the invite field so both
    // positive (env code) and negative (wrong code) flows exercise validation.
    await this.page.fill('#inviteCode', inviteCode ?? process.env.REGISTRATION_INVITE_CODE ?? '');
    await this.page.click('button[type="submit"]');
    // Success navigates to /setup after an 800ms delay; a rejected invite
    // stays here with a [role="alert"] — caller decides which to expect.
  }
}