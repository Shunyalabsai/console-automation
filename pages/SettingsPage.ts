import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class SettingsPage extends BasePage {
  // ──────── Navigation ────────
  readonly navSettings = this.page.getByRole('link', { name: 'Settings' });
  readonly navDashboard = this.page.getByRole('link', { name: 'Dashboard' }).first();

  // ──────── Profile Form ────────
  readonly firstNameInput = this.page.getByRole('textbox', { name: 'First name' });
  readonly lastNameInput = this.page.getByRole('textbox', { name: 'Last name' });
  readonly saveChangesButton = this.page.getByRole('button', { name: 'Save Changes' });

  // ──────── Success Toast ────────
  readonly successToast = this.page.getByText('Personal information updated');

  // ──────── User Menu ────────
  userMenuButton(displayName: string) {
    return this.page.getByRole('button', { name: displayName });
  }
  readonly settingsMenuItem = this.page.getByRole('menuitem', { name: 'Settings' });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  // ──────── Dashboard Heading (dynamic) ────────
  dashboardHeading(firstName: string) {
    return this.page.getByRole('heading', { name: `${firstName}'s Dashboard` });
  }

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation Actions ────────

  async navigateToSettings() {
    await this.goto('/dashboard');
    await this.waitForPageLoad();
    await this.navSettings.click();
    await this.waitForPageLoad();
  }

  async navigateToSettingsViaUserMenu(currentDisplayName: string) {
    await this.userMenuButton(currentDisplayName).click();
    await this.settingsMenuItem.click();
    await this.waitForPageLoad();
  }

  async navigateToDashboard() {
    await this.navDashboard.click();
    await this.waitForPageLoad();
  }

  // ──────── Profile Actions ────────

  async fillFirstName(name: string) {
    await this.firstNameInput.click();
    await this.firstNameInput.fill(name);
  }

  async fillLastName(name: string) {
    await this.lastNameInput.click();
    await this.lastNameInput.fill(name);
  }

  async saveChanges() {
    await this.saveChangesButton.click();
  }

  async updateProfile(firstName: string, lastName: string) {
    await this.fillFirstName(firstName);
    await this.fillLastName(lastName);
    await this.saveChanges();
  }

  // ──────── Logout ────────

  async logout(currentDisplayName: string) {
    await this.userMenuButton(currentDisplayName).click();
    await this.logoutMenuItem.click();
    await this.page.waitForURL('**/auth/sign-in', { timeout: 15000 });
  }

  // ──────── Assertions ────────

  async assertProfileFieldsVisible() {
    await expect(this.firstNameInput).toBeVisible();
    await expect(this.lastNameInput).toBeVisible();
  }

  async assertSaveButtonVisible() {
    await expect(this.saveChangesButton).toBeVisible();
  }

  async assertSuccessToastVisible() {
    await expect(this.successToast).toBeVisible({ timeout: 10000 });
  }

  async assertDashboardHeading(firstName: string) {
    await expect(this.dashboardHeading(firstName)).toBeVisible();
  }
}
