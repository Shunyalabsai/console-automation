import { Page, Locator, expect, type GotoOptions } from '@playwright/test';

const TRANSIENT_NAV_PATTERNS = [
  'ERR_NETWORK_CHANGED',
  'ERR_INTERNET_DISCONNECTED',
  'ERR_CONNECTION_RESET',
  'ERR_CONNECTION_CLOSED',
  'ERR_NETWORK_IO_SUSPENDED',
  'ERR_ADDRESS_UNREACHABLE',
  'NS_ERROR_NET_RESET',
  'NS_ERROR_NET_TIMEOUT',
] as const;

const DEFAULT_NAV_RETRIES = 3;
const DEFAULT_NAV_RETRY_DELAY_MS = 1500;

function isTransientNavigationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_NAV_PATTERNS.some((code) => message.includes(code));
}

export class BasePage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private async retryNavigation<T>(
    action: () => Promise<T>,
    retries = DEFAULT_NAV_RETRIES,
    baseDelayMs = DEFAULT_NAV_RETRY_DELAY_MS,
  ): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        return await action();
      } catch (err) {
        lastError = err;
        if (attempt === retries - 1 || !isTransientNavigationError(err)) {
          throw err;
        }
        await this.page.waitForTimeout(baseDelayMs * (attempt + 1));
      }
    }

    throw lastError;
  }

  async goto(path: string = '', options?: GotoOptions) {
    await this.retryNavigation(() => this.page.goto(path, options));
  }

  async reload(options?: Parameters<Page['reload']>[0]) {
    await this.retryNavigation(() => this.page.reload(options));
  }

  async waitForPageLoad() {
    await this.page.waitForLoadState('networkidle');
  }

  async waitForSelector(selector: string, timeout: number = 10000) {
    await this.page.waitForSelector(selector, { timeout });
  }

  async clickElement(locator: Locator) {
    await locator.waitFor({ state: 'visible' });
    await locator.click();
  }

  async fillInput(locator: Locator, value: string) {
    await locator.waitFor({ state: 'visible' });
    await locator.clear();
    await locator.fill(value);
  }

  async getText(locator: Locator): Promise<string> {
    await locator.waitFor({ state: 'visible' });
    return (await locator.textContent()) || '';
  }

  async isVisible(locator: Locator): Promise<boolean> {
    return await locator.isVisible();
  }

  async assertVisible(locator: Locator, message?: string) {
    await expect(locator, message).toBeVisible();
  }

  async assertText(locator: Locator, expectedText: string) {
    await expect(locator).toContainText(expectedText);
  }

  async assertURL(expectedURL: string) {
    await expect(this.page).toHaveURL(expectedURL);
  }

  async assertURLContains(urlPart: string) {
    await expect(this.page).toHaveURL(new RegExp(urlPart));
  }

  async takeScreenshot(name: string) {
    await this.page.screenshot({ path: `test-results/screenshots/${name}.png`, fullPage: true });
  }
}
