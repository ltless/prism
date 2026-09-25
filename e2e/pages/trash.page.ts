import type { Page } from '@playwright/test';

export class TrashPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/dashboard/trash');
  }

  async getTrashCount() {
    // TrashLibrary wraps cards itself (class group/trash-card) — no
    // data-media-id like MediaGrid.
    return this.page.locator('div[role="button"][class*="group/trash-card"]').count();
  }

  async emptyTrash() {
    await this.page.locator('button:has-text("Empty Trash")').click();
    await this.page.waitForTimeout(1000);
  }

  async restoreFirstItem() {
    const restoreBtn = this.page.locator('div[class*="group/trash-card"] button[title="Restore"]').first();
    if (await restoreBtn.isVisible()) {
      await restoreBtn.click();
      await this.page.waitForTimeout(1000);
    }
  }
}