import { defineConfig, devices } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

/** Comma-separated: chromium, chrome, safari (webkit). Default: chromium + safari. */
const BROWSER_LIST = (process.env.PLAYWRIGHT_BROWSERS || 'chromium,safari')
  .split(',')
  .map((b) => b.trim().toLowerCase())
  .filter(Boolean);

const BROWSER_USE = {
  chromium: { ...devices['Desktop Chrome'] },
  chrome: { ...devices['Desktop Chrome'], channel: 'chrome' as const },
  safari: { ...devices['Desktop Safari'] },
} as const;

type BrowserName = keyof typeof BROWSER_USE;

const enabledBrowsers = BROWSER_LIST.filter((name): name is BrowserName => {
  if (!(name in BROWSER_USE)) {
    console.warn(`[playwright] Unknown browser "${name}" — skipped. Use: chromium, chrome, safari`);
    return false;
  }
  return true;
});

if (enabledBrowsers.length === 0) {
  throw new Error('No valid browsers in PLAYWRIGHT_BROWSERS. Example: chromium,safari');
}

const setupProjects = enabledBrowsers.map((name) => ({
  name: `setup-${name}`,
  testMatch: '**/auth.setup.ts',
  use: { ...BROWSER_USE[name] },
}));

const browserProjects = enabledBrowsers.map((name) => ({
  name,
  use: {
    ...BROWSER_USE[name],
    storageState: `playwright/.auth/user-${name}.json`,
  },
  dependencies: [`setup-${name}`] as const,
}));

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
    ['json', { outputFile: 'reports/playwright-report.json' }],
    ['list'],
    ['./utils/google-sheets-reporter.ts'],
  ],
  timeout: 60000,
  expect: {
    timeout: 10000,
  },
  use: {
    baseURL: process.env.BASE_URL || 'https://console.shunyalabs.ai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
    headless: true,
  },
  projects: [...setupProjects, ...browserProjects],
});
