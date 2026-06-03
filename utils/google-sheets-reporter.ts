import type {
  FullResult,
  Reporter,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

interface TestRow {
  testcaseId: string;
  testName: string;
  description: string;
  updateDateTime: string;
  status: string;
  reason: string;
  comment: string;
}

const BROWSER_LABELS: Record<string, string> = {
  chromium: 'Chrome (Chromium)',
  chrome: 'Chrome',
  safari: 'Safari',
};

function browserLabel(name: string): string {
  return BROWSER_LABELS[name] || name;
}

/** Reporter V2 TestCase — project name from parent suite chain. */
function getProjectName(test: TestCase): string {
  let suite = test.parent;
  while (suite) {
    const s = suite as { project?: () => { name: string }; parent?: typeof suite };
    if (typeof s.project === 'function') {
      return s.project().name;
    }
    suite = s.parent;
  }
  return 'chromium';
}

interface BrowserRun {
  status: 'PASS' | 'FAIL' | 'SKIP';
  reason: string;
  comment: string;
}

interface AggregatedCase {
  testcaseId: string;
  testName: string;
  description: string;
  updateDateTime: string;
  browsers: Record<string, BrowserRun>;
}

class GoogleSheetsReporter implements Reporter {
  private byCase = new Map<string, AggregatedCase>();
  private results: TestRow[] = [];
  private appsScriptUrl: string;

  constructor() {
    this.appsScriptUrl = process.env.GOOGLE_APPS_SCRIPT_URL || '';
  }

  onTestEnd(test: TestCase, result: TestResult) {
    if (test.title === 'authenticate') return;
    const projectName = getProjectName(test);
    if (projectName === 'setup') return;

    const titleMatch = test.title.match(/^(TC_\w+_\d+)\s*-\s*(.+)$/);
    const testcaseId = titleMatch ? titleMatch[1] : test.title;
    const testName = titleMatch ? titleMatch[2].trim() : test.title;
    const suiteName = test.parent?.title || '';
    const description = `[${suiteName}] ${testName}`;

    const updateDateTime = new Date().toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    });

    const status: BrowserRun['status'] =
      result.status === 'passed' ? 'PASS' : result.status === 'skipped' ? 'SKIP' : 'FAIL';

    let reason = '';
    if (status === 'FAIL' && result.errors?.length > 0) {
      reason = this.simplifyError(result.errors[0]?.message || 'Unknown error');
    }

    let comment = '';
    if (status === 'PASS') {
      comment = `Passed in ${browserLabel(projectName)}`;
    } else if (status === 'FAIL') {
      const screenshot = result.attachments?.find((a) => a.name === 'screenshot');
      comment = screenshot?.path
        ? `${browserLabel(projectName)} screenshot: ${path.basename(screenshot.path)}`
        : `Failed in ${browserLabel(projectName)}`;
    } else {
      comment = `Skipped in ${browserLabel(projectName)}`;
    }

    if (!this.byCase.has(testcaseId)) {
      this.byCase.set(testcaseId, {
        testcaseId,
        testName,
        description,
        updateDateTime,
        browsers: {},
      });
    }
    const entry = this.byCase.get(testcaseId)!;
    entry.updateDateTime = updateDateTime;
    entry.browsers[projectName] = { status, reason, comment };
  }

  private buildRows(): TestRow[] {
    return Array.from(this.byCase.values()).map((entry) => {
      const runs = Object.values(entry.browsers);
      const failedNames = Object.entries(entry.browsers)
        .filter(([, b]) => b.status === 'FAIL')
        .map(([name]) => browserLabel(name));

      let status: TestRow['status'] = 'PASS';
      if (runs.some((b) => b.status === 'FAIL')) status = 'FAIL';
      else if (runs.some((b) => b.status === 'SKIP')) status = 'SKIP';

      let reason = '';
      if (status === 'FAIL') {
        reason = Object.entries(entry.browsers)
          .filter(([, b]) => b.status === 'FAIL')
          .map(([name, b]) => `${browserLabel(name)}: ${b.reason || 'Failed'}`)
          .join(' | ');
      }

      const browserSummary = Object.entries(entry.browsers)
        .map(([name, b]) => `${browserLabel(name)}=${b.status}`)
        .join(', ');

      let comment = `Browsers: ${browserSummary}`;
      if (failedNames.length > 0) {
        comment += ` | Failed in: ${failedNames.join(', ')}`;
      }

      return {
        testcaseId: entry.testcaseId,
        testName: entry.testName,
        description: entry.description,
        updateDateTime: entry.updateDateTime,
        status,
        reason,
        comment,
      };
    });
  }

  async onEnd(_result: FullResult) {
    this.results = this.buildRows();

    if (!this.appsScriptUrl) {
      console.log('\n⚠️  GOOGLE_APPS_SCRIPT_URL not set in .env — skipping Google Sheets update');
      console.log('   Deploy the Apps Script and add the URL to .env to enable reporting\n');
      this.printConsoleTable();
      return;
    }

    try {
      await this.pushToGoogleSheets();
      console.log(`\n✅ Google Sheets updated — ${this.results.length} test cases pushed`);
    } catch (error: any) {
      console.error('\n❌ Failed to update Google Sheets:', error.message);
      this.printConsoleTable();
    }
  }

  private async pushToGoogleSheets() {
    const payload = JSON.stringify({ results: this.results });

    const postResponse = await fetch(this.appsScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: payload,
      redirect: 'follow',
    });

    if (postResponse.ok) {
      const body = (await postResponse.json()) as { status: string; message?: string };
      if (body.status !== 'success') {
        throw new Error(body.message || 'Apps Script returned an error');
      }
      return;
    }

    if (postResponse.status >= 300 && postResponse.status < 400) {
      const redirectUrl = postResponse.headers.get('location');
      if (redirectUrl) {
        const getResponse = await fetch(redirectUrl);
        if (!getResponse.ok) {
          throw new Error(`HTTP ${getResponse.status}: ${getResponse.statusText}`);
        }
        const body = (await getResponse.json()) as { status: string; message?: string };
        if (body.status !== 'success') {
          throw new Error(body.message || 'Apps Script returned an error');
        }
        return;
      }
    }

    throw new Error(`HTTP ${postResponse.status}: ${postResponse.statusText}`);
  }

  private simplifyError(rawError: string): string {
    if (rawError.includes('toBeVisible') && rawError.includes('not found')) {
      const locatorMatch = rawError.match(/Locator: (.+)/);
      const element = locatorMatch ? locatorMatch[1].trim() : 'an element';
      return `Expected element was not visible on the page: ${element}`;
    }
    if (rawError.includes('toHaveURL')) {
      return 'Page did not navigate to the expected URL';
    }
    if (rawError.includes('Timeout')) {
      return 'Page or element took too long to load (timeout)';
    }
    if (rawError.includes('toContainText') || rawError.includes('toHaveText')) {
      return 'Text content on the page did not match expected value';
    }
    if (rawError.includes('toBeEnabled')) {
      return 'A button or input was disabled when it should have been enabled';
    }
    if (rawError.includes('net::ERR') || rawError.includes('Navigation')) {
      return 'Network error — page failed to load';
    }
    const firstLine = rawError.split('\n')[0].replace(/\[2m|\[22m|\[31m|\[39m/g, '').trim();
    return firstLine.length > 150 ? firstLine.substring(0, 150) + '...' : firstLine;
  }

  private printConsoleTable() {
    console.log('\n📋 Test Results Summary (one row per test case):');
    console.log('─'.repeat(100));
    console.log(
      'ID'.padEnd(14) +
        'Status'.padEnd(8) +
        'Test Name'.padEnd(50) +
        'Browsers / Reason'
    );
    console.log('─'.repeat(100));
    for (const r of this.results) {
      const icon = r.status === 'PASS' ? '✅' : r.status === 'FAIL' ? '❌' : '⏭️';
      console.log(
        r.testcaseId.padEnd(14) +
          `${icon} ${r.status}`.padEnd(10) +
          r.testName.substring(0, 48).padEnd(50) +
          (r.reason || r.comment || '-').substring(0, 80)
      );
    }
    console.log('─'.repeat(100));
    const passed = this.results.filter((r) => r.status === 'PASS').length;
    const failed = this.results.filter((r) => r.status === 'FAIL').length;
    const skipped = this.results.filter((r) => r.status === 'SKIP').length;
    console.log(
      `Total: ${this.results.length} test cases | ✅ ${passed} passed | ❌ ${failed} failed | ⏭️ ${skipped} skipped\n`
    );
  }
}

export default GoogleSheetsReporter;
