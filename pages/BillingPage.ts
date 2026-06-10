import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class BillingPage extends BasePage {
  // ──────── Page Header ────────
  readonly pageHeading = this.page.getByRole('heading', { name: 'Billing - Overview' });
  readonly navBilling = this.page.getByRole('link', { name: 'Billing' });

  // ──────── Your Plan Section ────────
  readonly yourPlanSection = this.page.locator('div').filter({
    hasText: /^Your PlanPay as you goUpgrade your plan to receive better rates$/,
  }).first();

  // ──────── Plans Heading ────────
  readonly plansHeading = this.page.getByRole('heading', { name: 'Plans' });

  // ──────── Plan Card 1: Pay as you go ────────
  readonly payAsYouGoPlan = this.page.locator('span').filter({ hasText: 'Pay as you go' });
  readonly payAsYouGoFeatureTopUps = this.page.getByText('Flexible top ups');
  readonly payAsYouGoFeatureCredits = this.page.getByText('Add credits anytime, in any');
  readonly payAsYouGoFeatureSpeech = this.page.getByText('Industry leading speech to').first();
  readonly payAsYouGoFeatureIntel = this.page.getByText('Advanced intelligence features').first();
  readonly payAsYouGoFeatureVoice = this.page.getByText('Custom voice agent').first();
  readonly activeBadge = this.page.getByText('Active');

  // ──────── Plan Card 2: Volume ────────
  readonly volumePlan = this.page.getByText('Volume', { exact: true });
  readonly volumePrice = this.page.getByText('$500');
  readonly volumeFeatureCredits = this.page.getByText('Prepaid credits for the year');
  readonly volumeFeatureSpeech = this.page.getByText('Industry leading speech to').nth(1);
  readonly volumeFeatureIntel = this.page.getByText('Advanced intelligence features').nth(1);

  // ──────── Plan Card 3: Enterprise ────────
  readonly enterprisePlan = this.page.getByText('Enterprise');
  readonly enterprisePrice = this.page.getByText('Custom pricing');
  readonly enterpriseFeatureBusiness = this.page.getByText('For businesses with large');
  readonly enterpriseFeatureModels = this.page.getByText('Access all models with our');
  readonly enterpriseFeatureCustomModels = this.page.getByText('Access to custom-trained');
  readonly enterpriseFeatureVoice = this.page.getByText('Custom voice agent').nth(1);
  readonly enterpriseFeatureConcurrency = this.page.getByText('Highest concurrency support');
  readonly enterpriseFeatureSelfHosted = this.page.getByText('Self-hosted deployment options');
  readonly enterpriseFeatureSLA = this.page.getByText('Dedicated SLAs and support');

  // ──────── Transaction History ────────
  readonly transactionHistoryHeading = this.page.getByRole('heading', { name: 'Transaction History' });

  // ──────── External Links (popups) ────────
  readonly viewDetailedPricingLink = this.page.getByRole('link', { name: 'View detailed pricing' });
  readonly viewPaymentHistoryButton = this.page.getByRole('button', { name: 'View payment history' });

  // ──────── Popup Page Headings ────────
  readonly pricingPageHeading = (popup: Page) => popup.getByRole('heading', { name: 'Shunya Labs Plans' });
  readonly stripePortalLink = (popup: Page) => popup.getByRole('link', { name: 'Shunya Labs Inc', exact: true });

  // ──────── User Menu ────────
  readonly userMenuButton = this.page.getByRole('button', { name: /^Saira/ });
  readonly logoutMenuItem = this.page.getByRole('menuitem', { name: 'Log out' });

  constructor(page: Page) {
    super(page);
  }

  // ──────── Navigation ────────

  async navigateToBilling() {
    await this.goto('/dashboard');
    await this.waitForPageLoad();
    await this.navBilling.click();
    await this.waitForPageLoad();
  }

  // ──────── Popup Actions ────────

  async clickViewDetailedPricing(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.viewDetailedPricingLink.click();
    return await popupPromise;
  }

  async clickViewPaymentHistory(): Promise<Page> {
    const popupPromise = this.page.waitForEvent('popup');
    await this.viewPaymentHistoryButton.click();
    return await popupPromise;
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

  async assertYourPlanSectionVisible() {
    await expect(this.yourPlanSection).toBeVisible();
  }

  async assertPlansHeadingVisible() {
    await expect(this.plansHeading).toBeVisible();
  }

  async assertPayAsYouGoPlanVisible() {
    await expect(this.payAsYouGoPlan).toBeVisible();
    await expect(this.activeBadge).toBeVisible();
    await expect(this.payAsYouGoFeatureTopUps).toBeVisible();
    await expect(this.payAsYouGoFeatureCredits).toBeVisible();
    await expect(this.payAsYouGoFeatureSpeech).toBeVisible();
    await expect(this.payAsYouGoFeatureIntel).toBeVisible();
    await expect(this.payAsYouGoFeatureVoice).toBeVisible();
  }

  async assertVolumePlanVisible() {
    await expect(this.volumePlan).toBeVisible();
    await expect(this.volumePrice).toBeVisible();
    await expect(this.volumeFeatureCredits).toBeVisible();
    await expect(this.volumeFeatureSpeech).toBeVisible();
    await expect(this.volumeFeatureIntel).toBeVisible();
  }

  async assertEnterprisePlanVisible() {
    await expect(this.enterprisePlan).toBeVisible();
    await expect(this.enterprisePrice).toBeVisible();
    await expect(this.enterpriseFeatureBusiness).toBeVisible();
    await expect(this.enterpriseFeatureModels).toBeVisible();
    await expect(this.enterpriseFeatureCustomModels).toBeVisible();
    await expect(this.enterpriseFeatureConcurrency).toBeVisible();
    await expect(this.enterpriseFeatureSelfHosted).toBeVisible();
    await expect(this.enterpriseFeatureSLA).toBeVisible();
  }

  async assertTransactionHistoryVisible() {
    await expect(this.transactionHistoryHeading).toBeVisible();
  }
}
