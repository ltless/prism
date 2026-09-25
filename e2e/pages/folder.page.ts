import type { Page } from '@playwright/test';

export class FolderPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard');
  }

  async createFolder(name: string) {
    // "New folder" is the icon button labelled in the sidebar Folders header.
    await this.page.getByRole("button", { name: "New folder" }).first().click();
    await this.page.locator('input[placeholder*="e.g."]').fill(name);
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