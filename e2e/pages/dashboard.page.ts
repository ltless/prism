import type { Page } from '@playwright/test';

export class DashboardPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async waitForLibrary() {
    // MediaLibrary is dynamically imported (ssr: false) — wait for it to hydrate.
    // Empty state shows "No Files Yet"; populated state shows [data-media-id] cards.
    await this.page.waitForFunction(() => {
      // Check if any media cards exist
      if (document.querySelectorAll('[data-media-id]').length > 0) return true;
      // Check if empty state text is visible
      const body = document.body.textContent || '';
      return body.includes('No Files Yet') || body.includes('Drop files');
    }, { timeout: 15000 });
  }

  async getCardCount() {
    return this.page.locator('[data-media-id]').count();
  }

  async uploadFile(filePath: string) {
    await this.page.setInputFiles('input[type="file"]', filePath);
    await this.page.waitForTimeout(2000);
  }

  async waitForNewCard(beforeCount: number) {
    await this.page.waitForFunction(
      (count: number) => document.querySelectorAll('[data-media-id]').length > count,
      beforeCount,
      { timeout: 15000 }
    );
  }
}
