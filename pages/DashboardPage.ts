import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class DashboardPage extends BasePage {
  // ──────── Dashboard Heading & Subtitle ────────
  readonly dashboardHeading = this.page.getByRole('heading', { name: /'s Dashboard$/ });
  readonly dashboardSubtitle = this.page.getByText('Overview of your account and');

  // ──────── API Keys Section ────────
  readonly apiKeysCardLabel = this.page.getByRole('main').getByText('API Keys', { exact: true }).first();
  readonly apiKeysCardDescription = this.page.getByText('Generate an API key and access token');
  readonly generateApiKeyButton = this.page.getByRole('link', { name: 'Generate API key and access token' });

  // ──────── Your Plan Section ────────
  readonly yourPlanCardLabel = this.page.getByRole('main').getByText('Your Plan', { exact: true });
  readonly yourPlanName = this.page.getByRole('main').getByText('Pay as you go', { exact: true });
  readonly upgradePlanButton = this.page.getByRole('link', { name: 'Upgrade plan' });

  // ──────── Explore Playground Section ────────
  readonly explorePlaygroundHeading = this.page.getByRole('heading', { name: 'Explore Playground' });
  readonly speechToTextLink = this.page.getByRole('link', { name: 'Speech to Text' });
  readonly textToSpeechLink = this.page.getByRole('link', { name: 'Text to Speech' });

  // ──────── Documentation Section ────────
  readonly documentationHeading = this.page.getByRole('heading', { name: 'Documentation' });
  readonly transcribeAudioLink = this.page.getByRole('link', { name: 'Transcribe audio' });
  readonly generateAudioLink = this.page.getByRole('link', { name: 'Generate audio' });
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
  readonly playgroundTextToSpeechMode = (popup: Page) => popup.getByRole('button', { name: 'Text to Speech' });
  readonly playgroundSttModeLabel = (popup: Page) => popup.getByText('TRANSCRIPTION MODE');
  readonly playgroundTtsModeLabel = (popup: Page) => popup.getByText('SYNTHESIS MODE');
  readonly playgroundTtsEnterText = (popup: Page) => popup.getByText('Enter your Text');
  readonly playgroundTtsRunSynthesis = (popup: Page) => popup.getByRole('button', { name: 'Run Synthesis' });
  /** Live docs: Transcribe audio → /asr/overview */
  readonly asrOverviewHeading = (popup: Page) => popup.getByRole('heading', { name: 'Speech-to-Text (ASR)' });
  /** Live docs: Generate audio → /tts/overview */
  readonly ttsOverviewHeading = (popup: Page) => popup.getByRole('heading', { name: 'Text-to-Speech (TTS)' });
  /** Live docs: See Features → /asr/features */
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
    await this.goto('/dashboard');
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
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }

  async clickTextToSpeech(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.textToSpeechLink.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    return popup;
  }

  async clickTranscribeAudio(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.transcribeAudioLink.click();
    return await popupPromise;
  }

  async clickGenerateAudio(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.generateAudioLink.click();
    return await popupPromise;
  }

  async clickSeeFeatures(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.seeFeaturesLink.click();
    return await popupPromise;
  }

  /** Playground opens on STT by default; switch to TTS for synthesis UI. */
  async assertPlaygroundTtsMode(popup: Page) {
    await expect(this.playgroundHeading(popup)).toBeVisible({ timeout: 15000 });
    await popup.waitForLoadState('networkidle');
    await expect(this.playgroundTextToSpeechMode(popup)).toBeVisible({ timeout: 15000 });
    await this.playgroundTextToSpeechMode(popup).click();
    await popup.waitForLoadState('networkidle');
    await expect(this.playgroundTtsModeLabel(popup)).toBeVisible({ timeout: 20000 });
    await expect(this.playgroundTtsEnterText(popup)).toBeVisible();
    await expect(this.playgroundTtsRunSynthesis(popup)).toBeVisible();
  }

  async assertPlaygroundSttMode(popup: Page) {
    await expect(this.playgroundHeading(popup)).toBeVisible({ timeout: 15000 });
    await popup.waitForLoadState('networkidle');
    await expect(this.playgroundSttModeLabel(popup)).toBeVisible({ timeout: 15000 });
    await expect(popup.getByRole('heading', { name: 'Upload Your Audio' })).toBeVisible();
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
    await expect(this.apiKeysCardLabel).toBeVisible();
    await expect(this.apiKeysCardDescription).toBeVisible();
    await expect(this.generateApiKeyButton).toBeVisible();
  }

  async assertYourPlanSectionVisible() {
    await expect(this.yourPlanCardLabel).toBeVisible();
    await expect(this.yourPlanName).toBeVisible();
    await expect(this.upgradePlanButton).toBeVisible();
  }

  async assertExplorePlaygroundVisible() {
    await expect(this.explorePlaygroundHeading).toBeVisible();
    await expect(this.speechToTextLink).toBeVisible();
    await expect(this.textToSpeechLink).toBeVisible();
  }

  async assertDocumentationSectionVisible() {
    await expect(this.documentationHeading).toBeVisible();
    await expect(this.transcribeAudioLink).toBeVisible();
    await expect(this.generateAudioLink).toBeVisible();
    await expect(this.seeFeaturesLink).toBeVisible();
  }

  async assertUsageSectionVisible() {
    await expect(this.usageSectionHeading).toBeVisible();
  }
}
