import { Page, expect } from '@playwright/test';
import path from 'path';
import { BasePage } from './BasePage';

const AUDIO_FIXTURE = path.resolve(__dirname, '..', 'fixtures', 'audio', 'doctor.mp3');

export class UsagePage extends BasePage {
  // ──────── Dashboard ────────
  readonly dashboardHeading = this.page.getByRole('heading', { name: "Saira's Dashboard" });

  // ──────── Usage Analytics Page ────────
  readonly usageAnalyticsHeading = this.page.getByRole('heading', { name: 'Usage Analytics' });
  readonly dateRangeLabel = this.page.getByText('Date range');
  readonly showByLabel = this.page.getByText('Show by');
  readonly metricLabel = this.page.getByText('Metric');
  readonly confirmButton = this.page.getByRole('button', { name: 'Confirm' });
  readonly chartPath = this.page.locator('svg path[d]').first();
  readonly requestsHeading = this.page.getByText('Requests').first();

  // ──────── Usage Logs Page ────────
  readonly usageLogsHeading = this.page.getByRole('heading', { name: 'Usage Logs' });

  // ──────── Top Navigation ────────
  readonly navPlayground = this.page.getByRole('link', { name: 'Playground' });
  readonly navDashboard = this.page.getByRole('link', { name: 'Dashboard' }).first();
  readonly navBilling = this.page.getByRole('link', { name: 'Billing' });
  readonly navLogs = this.page.getByRole('link', { name: 'Logs' });

  // ──────── User Menu ────────
  readonly userMenuButton = this.page.getByRole('button', { name: 'Saira Automation' });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  // ──────── Playground Popup Elements ────────
  uploadAudioHeading(popup: Page) {
    return popup.getByRole('heading', { name: 'Upload Your Audio' });
  }
  audioFileInput(popup: Page) {
    return popup.locator('input[type="file"][accept="audio/*"]');
  }
  runAnalysisButton(popup: Page) {
    return popup.getByRole('button', { name: 'Run Analysis' });
  }
  transcriptPlaceholder(popup: Page) {
    return popup.getByText('Select audio above and run analysis to see the transcript here');
  }

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation ────────

  async navigateToDashboard() {
    await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(this.dashboardHeading).toBeVisible({ timeout: 15000 });
  }

  async navigateToUsageOverview() {
    await this.page.goto('/usage/overview', { waitUntil: 'domcontentloaded' });
    await expect(this.usageAnalyticsHeading).toBeVisible({ timeout: 15000 });
  }

  async navigateToUsageLogs() {
    await this.page.goto('/usage/logs', { waitUntil: 'domcontentloaded' });
    await expect(this.usageLogsHeading).toBeVisible({ timeout: 15000 });
  }

  async navigateToBilling() {
    await this.page.goto('/billing', { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle');
  }

  // ──────── Balance ────────

  async getBalance(): Promise<number> {
    await expect(this.dashboardHeading).toBeVisible();
    // The BALANCE card has "Credit remaining" text
    // Navigate up from that label to the card container to find the dollar amount
    const creditLabel = this.page.getByText('Credit remaining');
    await expect(creditLabel).toBeVisible();

    // Walk up parent chain to find the dollar amount in the card
    let container = creditLabel.locator('..');
    for (let i = 0; i < 5; i++) {
      const text = await container.textContent();
      const match = text!.match(/\$([\d,]+\.\d{2})/);
      if (match) return parseFloat(match[1].replace(',', ''));
      container = container.locator('..');
    }
    throw new Error('Balance not found on dashboard');
  }

  /** Reload dashboard and read balance — used with expect.poll() for retry */
  async getBalanceWithReload(): Promise<number> {
    await this.page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(this.dashboardHeading).toBeVisible({ timeout: 15000 });
    return this.getBalance();
  }

  // ──────── Usage Chart ────────

  async isChartRendered(): Promise<boolean> {
    await expect(this.usageAnalyticsHeading).toBeVisible();
    await this.page.waitForTimeout(2000); // Wait for chart to render

    // Chart is a line chart — check if SVG path with actual data exists
    // A rendered path has a 'd' attribute with coordinates (not just M0,0)
    const pathEl = this.page.locator('svg path[d]');
    const count = await pathEl.count();
    if (count === 0) return false;

    // Verify at least one path has meaningful data (length > 20 chars means actual line)
    for (let i = 0; i < count; i++) {
      const d = await pathEl.nth(i).getAttribute('d');
      if (d && d.length > 20) return true;
    }
    return false;
  }

  // ──────── Playground ────────

  async openPlayground(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.navPlayground.click();
    return await popupPromise;
  }

  async runCustomerSupportAnalysis(popup: Page): Promise<void> {
    await popup.waitForLoadState('networkidle');

    // Verify Upload section is ready
    await expect(this.uploadAudioHeading(popup)).toBeVisible({ timeout: 15000 });

    // Upload audio file directly to the hidden file input
    await this.audioFileInput(popup).setInputFiles(AUDIO_FIXTURE);

    // Click Run Analysis
    const button = this.runAnalysisButton(popup);
    await expect(button).toBeVisible({ timeout: 10000 });
    await expect(button).toBeEnabled({ timeout: 10000 });
    await button.click();

    // Wait for transcription output — placeholder text disappears once transcript arrives
    await expect(this.transcriptPlaceholder(popup)).toBeHidden({ timeout: 90000 });
  }

  // ──────── Date Helpers ────────

  getTodayDatePattern(): string {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  }

  getTodayShortPattern(): string {
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[now.getMonth()]} ${now.getDate()},`;
  }

  // ──────── Logs Verification ────────

  async assertLogEntryForToday(): Promise<void> {
    const pattern = this.getTodayDatePattern();
    await expect(this.page.getByText(pattern).first()).toBeVisible({ timeout: 10000 });
  }

  async getLogEntriesCountForToday(): Promise<number> {
    const pattern = this.getTodayDatePattern();
    return await this.page.getByText(new RegExp(pattern)).count();
  }

  /** Reload logs page and get count — used with expect.poll() for retry */
  async getLogEntriesCountWithReload(): Promise<number> {
    await this.page.goto('/usage/logs', { waitUntil: 'domcontentloaded' });
    await expect(this.usageLogsHeading).toBeVisible({ timeout: 15000 });
    await this.page.waitForTimeout(1000); // Let log entries render
    return this.getLogEntriesCountForToday();
  }

  async getLatestLogCost(): Promise<number> {
    // Cost displayed as decimal like "0.0091"
    const costElement = this.page.getByText(/^0\.\d+$/).first();
    if (await costElement.isVisible().catch(() => false)) {
      const text = await costElement.textContent();
      return parseFloat(text!);
    }
    return 0;
  }

  // ──────── Billing Verification ────────

  async assertBillingDeductionForToday(): Promise<void> {
    // Scroll to Transaction History section
    const txnHeading = this.page.getByRole('heading', { name: 'Transaction History' });
    await expect(txnHeading).toBeVisible({ timeout: 10000 });
    await txnHeading.scrollIntoViewIfNeeded();

    // Verify a Debit entry exists (visible on all viewports)
    await expect(this.page.getByText('Debit').first()).toBeVisible({ timeout: 10000 });

    // The date span may be hidden via Tailwind's sm:hidden on desktop,
    // so verify today's date via textContent of the Transaction History container
    const pattern = this.getTodayShortPattern();
    const sectionText = await txnHeading.locator('..').locator('..').textContent();
    if (!sectionText?.includes(pattern)) {
      throw new Error(`Expected billing section to contain today's date "${pattern}" but got: ${sectionText?.substring(0, 200)}`);
    }
  }

  async getBillingDeductionAmount(): Promise<number> {
    // Debit amount displayed as "-$X.XX"
    const debitAmount = this.page.getByText(/^-\$/).first();
    if (await debitAmount.isVisible().catch(() => false)) {
      const text = await debitAmount.textContent();
      const match = text!.match(/\$([\d.]+)/);
      return match ? parseFloat(match[1]) : 0;
    }
    return 0;
  }

  // ──────── Assertions ────────

  async assertUsageOverviewLoaded(): Promise<void> {
    await expect(this.usageAnalyticsHeading).toBeVisible();
  }

  async assertFiltersVisible(): Promise<void> {
    await expect(this.dateRangeLabel).toBeVisible();
    await expect(this.showByLabel).toBeVisible();
    await expect(this.metricLabel).toBeVisible();
    await expect(this.confirmButton).toBeVisible();
  }

  async assertUsageLogsLoaded(): Promise<void> {
    await expect(this.usageLogsHeading).toBeVisible();
  }
}
