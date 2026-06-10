import { Page, expect } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  // Locators — matched from actual Clerk sign-in recording
  readonly emailInput = this.page.getByRole('textbox', { name: 'Email address' });
  readonly passwordInput = this.page.getByRole('textbox', { name: 'Password' });
  readonly continueButton = this.page.getByRole('button', { name: 'Continue' });

  constructor(page: Page) {
    super(page);
  }

  async navigateToLogin() {
    await this.goto('/auth/sign-in');
    await this.waitForPageLoad();
  }

  async enterEmail(email: string) {
    await this.emailInput.click();
    await this.emailInput.fill(email);
  }

  async clickContinue() {
    await this.continueButton.click();
  }

  async enterPassword(password: string) {
    await this.passwordInput.fill(password);
  }

  async login(email: string, password: string) {
    await this.navigateToLogin();
    await this.enterEmail(email);
    await this.clickContinue();
    await this.passwordInput.waitFor({ state: 'visible', timeout: 10000 });
    await this.enterPassword(password);
    await this.clickContinue();
    await this.page.waitForURL('**/dashboard', { timeout: 30000 });
  }

  async assertLoginPageVisible() {
    await expect(this.emailInput).toBeVisible();
  }

  async assertLoggedIn() {
    await expect(this.page).not.toHaveURL(/sign-in/);
  }
}
