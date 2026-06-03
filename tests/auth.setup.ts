import { test as setup } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { TEST_CONFIG } from '../utils/testData';
import * as path from 'path';

setup('authenticate', async ({ page }, testInfo) => {
  const loginPage = new LoginPage(page);
  const browserKey = testInfo.project.name.replace(/^setup-/, '') || 'chromium';
  const authFile = path.join(__dirname, `../playwright/.auth/user-${browserKey}.json`);

  await loginPage.login(TEST_CONFIG.credentials.email, TEST_CONFIG.credentials.password);
  await loginPage.assertLoggedIn();

  await page.context().storageState({ path: authFile });
  console.log(`✅ Authentication state saved (${browserKey}):`, authFile);
});
