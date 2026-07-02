import type { Page } from '@playwright/test';

export class TrashPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard/trash');
  }

  async getTrashCount() {
    return this.page.locator('[data-media-id]').count();
  }

  async emptyTrash() {
    await this.page.locator('button:has-text("Empty Trash")').click();
    await this.page.waitForTimeout(1000);
  }

  async restoreFirstItem() {
    const restoreBtn = this.page.locator('[data-media-id] button:has-text("Restore")').first();
    if (await restoreBtn.isVisible()) {
      await restoreBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }
}