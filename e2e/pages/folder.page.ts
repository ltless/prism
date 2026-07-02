import type { Page } from '@playwright/test';

export class FolderPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createFolder(name: string) {
    await this.page.locator('button:has-text("New Folder")').click();
    await this.page.locator('input[placeholder="Folder name"]').fill(name);
    await this.page.locator('button:has-text("Create")').click();
    await this.page.waitForTimeout(1000);
  }

  async openFolder(name: string) {
    await this.page.locator(`text="${name}"`).first().click();
    await this.page.waitForTimeout(1000);
  }

  async getCardCount() {
    return this.page.locator('[data-media-id]').count();
  }
}