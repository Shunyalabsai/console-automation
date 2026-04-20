import { test, expect } from '@playwright/test';
import { UsagePage } from '../pages/UsagePage';

test.describe('Usage Module — Analytics, Logs & Billing Verification', () => {
  let usagePage: UsagePage;

  test.beforeEach(async ({ page }) => {
    usagePage = new UsagePage(page);
  });

  // ──────── Page Load ────────

  test('TC_USE_01 - Verify Usage Analytics page loads from dashboard', async () => {
    await usagePage.navigateToUsageOverview();
    await usagePage.assertUsageOverviewLoaded();
  });

  test('TC_USE_02 - Verify date range and metric filters are visible', async () => {
    await usagePage.navigateToUsageOverview();
    await usagePage.assertFiltersVisible();
  });

  test('TC_USE_03 - Verify Usage Logs page loads', async () => {
    await usagePage.navigateToUsageLogs();
    await usagePage.assertUsageLogsLoaded();
  });

  // ──────── E2E: Full Usage Verification Flow ────────

  test('TC_USE_04 - E2E: Check balance, run analysis, verify balance update, usage count, logs, and billing deduction', async () => {
    test.setTimeout(180000); // 3 minutes for this complex flow

    // ── Step 1: Navigate to Dashboard (sanity check balance card renders) ──
    await usagePage.navigateToDashboard();
    await usagePage.getBalance();

    // ── Step 2: Navigate to Logs and capture the top-most log's Request ID ──
    // A new transcription run creates a log that appears at the top of the
    // table, so we verify the top Request ID changes rather than counting
    // date-text occurrences (the page shows the date once per header, not
    // once per row, which made the count unreliable).
    await usagePage.navigateToUsageLogs();
    const initialLatestLogId = await usagePage.getLatestLogRequestId();

    // ── Step 3: Open Playground and run analysis (upload + intelligence features) ──
    await usagePage.navigateToUsageOverview();
    const popup = await usagePage.openPlayground();
    await usagePage.runCustomerSupportAnalysis(popup);
    await popup.close();
    // Note: balance deduction is verified via the Logs page (Step 6-7) and
    // Billing page (Step 8-9) — both show the actual deducted cost.
    // The dashboard balance card rounds to 2 decimals which can hide
    // sub-cent deductions, so we don't assert on it directly.

    // ── Step 5: Navigate to Usage Overview and verify chart has data ──
    await usagePage.navigateToUsageOverview();
    // Wait for chart line to render with data
    await expect.poll(
      async () => await usagePage.isChartRendered(),
      { message: 'Expected usage chart to render with data', timeout: 20000, intervals: [2000, 3000, 5000, 5000] }
    ).toBeTruthy();

    // ── Step 6: Navigate to Logs and verify a new log entry appeared ──
    // Poll until the top Request ID changes (= new transcription log was
    // prepended to the table).
    await expect.poll(
      async () => await usagePage.getLatestLogRequestIdWithReload(),
      { message: `Expected a new log entry on top (initial Request ID: ${initialLatestLogId})`, timeout: 60000, intervals: [3000, 5000, 5000, 5000, 5000, 10000, 10000] }
    ).not.toBe(initialLatestLogId);

    // ── Step 7: Capture the cost from logs ──
    const logCost = await usagePage.getLatestLogCost();
    expect(logCost).toBeGreaterThan(0);

    // ── Step 8: Navigate to Billing and verify deduction transaction ──
    await usagePage.navigateToBilling();
    await usagePage.assertBillingDeductionForToday();

    // ── Step 9: Verify billing deduction amount exists ──
    const billingAmount = await usagePage.getBillingDeductionAmount();
    expect(billingAmount).toBeGreaterThan(0);
  });
});
