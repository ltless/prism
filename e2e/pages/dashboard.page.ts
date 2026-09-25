import fs from 'node:fs';
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
    // Append a random tail to the fixture so every upload has a distinct
    // hash — thumbnailing still works (JPEG decoders stop at the EOI
    // marker), but Re-run uploads never dedup against each other.
    const base = fs.readFileSync(filePath);
    const unique = Buffer.concat([base, Buffer.from(String(Date.now() + Math.random()))]);
    await this.page.setInputFiles('input[type="file"]', {
      name: 'test-image.jpg',
      mimeType: 'image/jpeg',
      buffer: unique,
    });
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
