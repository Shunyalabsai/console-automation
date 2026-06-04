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
  readonly deactivatedToast = this.page.getByText('API key deactivated successfully', { exact: true });
  readonly revokedSuccessToast = this.page.getByText('API key revoked successfully', { exact: true });

  // ──────── Tabs ────────
  readonly deactivatedTab = this.page.getByRole('tab', { name: 'Deactivated' });
  readonly apiKeysTab = this.page.getByRole('tab', { name: 'API Keys' });
  readonly activeKeysPanel = this.page.getByRole('tabpanel', { name: 'API Keys' });
  readonly deactivatedKeysPanel = this.page.getByRole('tabpanel', { name: 'Deactivated' });

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

    await expect(this.deactivateDialog).toBeHidden({ timeout: 15000 });
    await expect(this.deactivatedToast).toBeVisible({ timeout: 15000 });
    await expect(this.revokedSuccessToast).toBeVisible({ timeout: 15000 });
    await this.waitForKeyRemovedFromActiveList(keyName);
  }

  // ──────── Key List Helpers ────────

  keyNameInList(keyName: string): Locator {
    return this.page.getByText(keyName, { exact: true });
  }

  keyNameInActiveList(keyName: string): Locator {
    return this.activeKeysPanel.getByText(keyName, { exact: true });
  }

  keyNameInDeactivatedList(keyName: string): Locator {
    return this.deactivatedKeysPanel.getByText(keyName, { exact: true });
  }

  async openDeactivatedTab() {
    await expect(this.deactivatedTab).toBeVisible({ timeout: 15000 });
    await this.deactivatedTab.click();
    await expect(this.deactivatedTab).toHaveAttribute('aria-selected', 'true', { timeout: 10000 });
    await expect(this.deactivatedOnColumn).toBeVisible({ timeout: 20000 });
  }

  async waitForKeyRemovedFromActiveList(keyName: string) {
    const revokeBtn = this.revokeButton(keyName);
    const activeKey = this.keyNameInActiveList(keyName);

    await expect.poll(
      async () => {
        const revokeVisible = await revokeBtn.isVisible().catch(() => false);
        const stillActive = await activeKey.isVisible().catch(() => false);
        return !revokeVisible && !stillActive;
      },
      {
        timeout: 30_000,
        intervals: [500, 1000, 2000],
        message: `Expected "${keyName}" to disappear from the active API Keys list after deactivation`,
      },
    ).toBe(true);
  }

  async waitForKeyInDeactivatedList(keyName: string) {
    const key = this.keyNameInDeactivatedList(keyName);

    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) {
        await this.page.reload({ waitUntil: 'networkidle' });
        await expect(this.pageHeading).toBeVisible({ timeout: 15000 });
      }

      await this.openDeactivatedTab();

      try {
        await expect.poll(
          async () => key.isVisible(),
          {
            timeout: attempt === 0 ? 20_000 : 15_000,
            intervals: [500, 1000, 2000],
            message: `Expected "${keyName}" in the Deactivated tab`,
          },
        ).toBe(true);
        return;
      } catch (err) {
        if (attempt === 1) throw err;
      }
    }
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
    await expect(this.keyNameInActiveList(keyName)).toBeVisible();
  }

  async assertCreatedDateVisible() {
    await expect(this.createdDateText()).toBeVisible();
  }

  async assertDeactivationToasts() {
    await expect(this.deactivatedToast).toBeVisible({ timeout: 10000 });
    await expect(this.revokedSuccessToast).toBeVisible({ timeout: 10000 });
  }

  async assertKeyInDeactivatedTab(keyName: string) {
    await this.waitForKeyRemovedFromActiveList(keyName);
    await this.waitForKeyInDeactivatedList(keyName);
  }

  async assertDeactivatedOnColumnVisible() {
    await expect(this.deactivatedOnColumn).toBeVisible();
  }

  async assertDeactivatedDateVisible() {
    await expect(this.deactivatedDateText().first()).toBeVisible();
  }
}
