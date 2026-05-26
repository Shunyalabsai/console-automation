import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  // ──────── Dashboard Heading & Subtitle ────────
  readonly dashboardHeading = this.page.getByRole('heading', { name: /'s Dashboard$/ });
  readonly dashboardSubtitle = this.page.getByText('Overview of your account and');

  // ──────── API Keys Section ────────
  readonly apiKeysSection = this.page.getByText('API KeysAPI KeysGenerate an API keyGenerate');

  // ──────── Your Plan Section ────────
  readonly yourPlanSection = this.page.getByText('Your PlanPay as you goUpgrade your plan to receive better ratesUpgrade');

  // ──────── Explore Playground Section ────────
  readonly explorePlaygroundHeading = this.page.getByRole('heading', { name: 'Explore Playground' });
  readonly speechToTextLink = this.page.getByRole('link', { name: 'Speech to Text' });

  // ──────── Documentation Section ────────
  readonly documentationHeading = this.page.getByRole('heading', { name: 'Documentation' });
  readonly transcribeAudioLink = this.page.getByRole('link', { name: 'Transcribe audio' });
  readonly seeFeaturesLink = this.page.getByRole('link', { name: 'See Features' });

  // ──────── Usage Section ────────
  readonly usageSectionHeading = this.page.getByRole('heading', { name: 'Usage' });
  readonly usageOverviewLink = this.page.getByRole('link', { name: 'Usage Overview' });

  // ──────── Sidebar / Top Navigation ────────
  readonly navDashboard = this.page.getByRole('link', { name: 'Dashboard' }).first();
  readonly navLogs = this.page.getByRole('link', { name: 'Logs' });
  readonly navPlayground = this.page.getByRole('link', { name: 'Playground' });
  readonly navDocs = this.page.getByRole('link', { name: 'Docs' });

  // ──────── User Menu ────────
  readonly userMenuButton = this.page.getByRole('button', { name: /^Saira/ });
  readonly settingsMenuItem = this.page.getByRole('menuitem', { name: 'Settings' });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  // ──────── Popup Page Headings (new tabs) ────────
  readonly playgroundHeading = (popup: Page) => popup.getByRole('heading', { name: 'API Playground' });
  /** Live docs (2026): Transcribe audio → /asr/overview */
  readonly asrOverviewHeading = (popup: Page) => popup.getByRole('heading', { name: 'Speech-to-Text (ASR)' });
  /** Live docs (2026): See Features → /asr/features */
  readonly asrFeaturesHeading = (popup: Page) => popup.getByRole('heading', { name: 'ASR features' });
  /** Live docs (2026): Docs nav → docs.shunyalabs.ai home */
  readonly docsHomeHeading = (popup: Page) =>
    popup.getByRole('heading', { name: "Voice AI that doesn't stop at English" });
  readonly docsPageNotFoundHeading = (popup: Page) => popup.getByRole('heading', { name: 'Page not found' });

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation Actions ────────

  async navigateToDashboard() {
    await this.page.goto('/dashboard');
    await this.waitForPageLoad();
  }

  async clickNavDashboard() {
    await this.navDashboard.click();
    await this.waitForPageLoad();
  }

  async clickNavLogs() {
    await this.navLogs.click();
    await this.waitForPageLoad();
  }

  async clickUsageOverview() {
    await this.usageOverviewLink.click();
    await this.waitForPageLoad();
  }

  // ──────── Popup Link Actions (open in new tab) ────────

  async clickSpeechToText(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.speechToTextLink.click();
    return await popupPromise;
  }

  async clickTranscribeAudio(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.transcribeAudioLink.click();
    return await popupPromise;
  }

  async clickSeeFeatures(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.seeFeaturesLink.click();
    return await popupPromise;
  }

  async clickNavPlayground(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.navPlayground.click();
    return await popupPromise;
  }

  async clickNavDocs(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.navDocs.click();
    return await popupPromise;
  }

  // ──────── User Menu Actions ────────

  async openUserMenu() {
    await this.userMenuButton.click();
  }

  async navigateToSettings() {
    await this.openUserMenu();
    await this.settingsMenuItem.click();
    await this.waitForPageLoad();
  }

  async logout() {
    await this.openUserMenu();
    await this.logoutMenuItem.click();
    await this.page.waitForURL('**/auth/sign-in', { timeout: 30000 });
  }

  // ──────── Assertions ────────

  async assertDashboardLoaded() {
    await expect(this.dashboardHeading).toBeVisible();
    await expect(this.dashboardSubtitle).toBeVisible();
  }

  async assertApiKeysSectionVisible() {
    await expect(this.apiKeysSection).toBeVisible();
  }

  async assertYourPlanSectionVisible() {
    await expect(this.yourPlanSection).toBeVisible();
  }

  async assertExplorePlaygroundVisible() {
    await expect(this.explorePlaygroundHeading).toBeVisible();
  }

  async assertDocumentationSectionVisible() {
    await expect(this.documentationHeading).toBeVisible();
  }

  async assertUsageSectionVisible() {
    await expect(this.usageSectionHeading).toBeVisible();
  }
}
