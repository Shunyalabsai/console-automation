import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ContactUsPage extends BasePage {
  // ──────── Page Header ────────
  readonly pageHeading = this.page.getByRole('heading', { name: 'Contact Us' });
  readonly navContactUs = this.page.getByRole('link', { name: 'Contact Us' });

  // ──────── Form Fields ────────
  readonly messageInput = this.page.getByRole('textbox', { name: 'Message *' });
  readonly submitButton = this.page.getByRole('button', { name: 'Submit' });

  // ──────── Success Notification ────────
  readonly successNotification = this.page.getByRole('region', { name: 'Notifications alt+T' }).getByRole('listitem');

  // ──────── User Menu ────────
  readonly userMenuButton = this.page.getByRole('button', { name: /^Saira/ });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation ────────

  async navigateToContactUs() {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
    await this.navContactUs.click();
    await this.waitForPageLoad();
  }

  // ──────── Form Actions ────────

  async fillMessage(message: string) {
    await this.messageInput.click();
    await this.messageInput.fill(message);
  }

  async clickSubmit() {
    await this.submitButton.click();
  }

  async submitFeedback(message: string) {
    await this.fillMessage(message);
    await this.clickSubmit();
  }

  // ──────── Logout ────────

  async logout() {
    await this.userMenuButton.click();
    await this.logoutMenuItem.click();
    await this.page.waitForURL('**/auth/sign-in', { timeout: 15000 });
  }

  // ──────── Assertions ────────

  async assertPageLoaded() {
    await expect(this.pageHeading).toBeVisible();
  }

  async assertMessageFieldVisible() {
    await expect(this.messageInput).toBeVisible();
  }

  async assertSubmitButtonVisible() {
    await expect(this.submitButton).toBeVisible();
  }

  async assertSuccessNotificationVisible() {
    await expect(this.successNotification).toBeVisible({ timeout: 10000 });
  }
}
