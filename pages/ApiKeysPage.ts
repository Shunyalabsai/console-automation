import { Page, Locator, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class ApiKeysPage extends BasePage {
  // ──────── Page Header ────────
  readonly pageHeading = this.page.getByRole('heading', { name: 'API Keys' });
  readonly navApiKeys = this.page.getByRole('link', { name: 'API Keys' });

  // ──────── Create Key Flow ────────
  readonly createKeyButton = this.page.getByRole('button', { name: 'Create a new API key' });
  readonly keyNameInput = this.page.getByRole('textbox', { name: 'Key Name *' });
  readonly createApiKeyButton = this.page.getByRole('button', { name: 'Create API Key' });

  // ──────── New Key Created Dialog ────────
  readonly newKeyHeading = this.page.getByRole('heading', { name: 'Your New API Key' });
  readonly acknowledgeSwitch = this.page.getByRole('switch', { name: "I know I can't see this API" });
  readonly copyApiKeyButton = this.page.getByRole('button', { name: 'Copy API key' });
  readonly gotItButton = this.page.getByRole('button', { name: 'Got it' });

  // ──────── Deactivation Flow ────────
  readonly deactivateDialog = this.page.getByRole('alertdialog', { name: 'Deactivate API Key?' });
  readonly deactivateButton = this.page.getByRole('button', { name: 'Deactivate' });

  // ──────── Toasts ────────
  readonly deactivatedToast = this.page.getByText('API key deactivated');
  readonly revokedSuccessToast = this.page.getByText('API key revoked successfully');

  // ──────── Tabs ────────
  readonly deactivatedTab = this.page.getByRole('tab', { name: 'Deactivated' });
  readonly apiKeysTab = this.page.getByRole('tab', { name: 'API Keys' });

  // ──────── Table Column Headers ────────
  readonly deactivatedOnColumn = this.page.getByText('Deactivated on');

  // ──────── User Menu ────────
  readonly userMenuButton = this.page.getByRole('button', { name: /^Saira/ });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation ────────

  async navigateToApiKeys() {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
    await this.navApiKeys.click();
    await this.waitForPageLoad();
  }

  // ──────── Create Key ────────

  async clickCreateKey() {
    await this.createKeyButton.click();
  }

  async fillKeyName(name: string) {
    await this.keyNameInput.fill(name);
  }

  async submitCreateKey() {
    await this.createApiKeyButton.click();
  }

  async acknowledgeAndCopyKey() {
    await expect(this.newKeyHeading).toBeVisible({ timeout: 10000 });
    await this.acknowledgeSwitch.click();
    await this.copyApiKeyButton.click();
    await this.gotItButton.click();
  }

  async createApiKeyFull(keyName: string) {
    await this.clickCreateKey();
    await this.fillKeyName(keyName);
    await this.submitCreateKey();
    await this.acknowledgeAndCopyKey();
  }

  // ──────── Deactivation ────────

  revokeButton(keyName: string): Locator {
    return this.page.getByRole('button', { name: `Revoke API key ${keyName}` });
  }

  async revokeKey(keyName: string) {
    await this.revokeButton(keyName).click();
    await expect(this.deactivateDialog).toBeVisible();
    await this.deactivateButton.click();
    // Wait for page to fully reload after deactivation
    await this.pageHeading.waitFor({ state: 'visible', timeout: 15000 });
    await this.page.waitForLoadState('networkidle');
    // Ensure the active tab is loaded before trying to switch
    await expect(this.apiKeysTab).toBeVisible({ timeout: 10000 });
  }

  // ──────── Key List Helpers ────────

  keyNameInList(keyName: string): Locator {
    return this.page.getByText(keyName, { exact: true });
  }

  // ──────── Date/Time Helpers ────────

  getCurrentDatePattern(): string {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[now.getMonth()];
    const day = now.getDate();
    return `${month} ${day},`;
  }

  createdDateText(): Locator {
    return this.page.getByText(this.getCurrentDatePattern()).first();
  }

  deactivatedDateText(): Locator {
    return this.page.getByText(this.getCurrentDatePattern());
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
    await expect(this.createKeyButton).toBeVisible();
  }

  async assertNewKeyDialogVisible() {
    await expect(this.newKeyHeading).toBeVisible();
  }

  async assertKeyInActiveList(keyName: string) {
    await expect(this.keyNameInList(keyName)).toBeVisible();
  }

  async assertCreatedDateVisible() {
    await expect(this.createdDateText()).toBeVisible();
  }

  async assertDeactivationToasts() {
    await expect(this.deactivatedToast).toBeVisible({ timeout: 10000 });
    await expect(this.revokedSuccessToast).toBeVisible({ timeout: 10000 });
  }

  async assertKeyInDeactivatedTab(keyName: string) {
    await expect(this.deactivatedTab).toBeVisible({ timeout: 15000 });
    await this.deactivatedTab.click();
    await expect(this.deactivatedOnColumn).toBeVisible({ timeout: 20000 });
    await expect.poll(
      async () => this.keyNameInList(keyName).isVisible(),
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    ).toBe(true);
  }

  async assertDeactivatedOnColumnVisible() {
    await expect(this.deactivatedOnColumn).toBeVisible();
  }

  async assertDeactivatedDateVisible() {
    await expect(this.deactivatedDateText().first()).toBeVisible();
  }
}
