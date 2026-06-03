#!/usr/bin/env node

/**
 * generate-dashboard.js
 * Parses Playwright JSON report and generates dashboard data files.
 *
 * Reads:  reports/playwright-report.json
 * Writes: docs/data/latest.json
 *         docs/history/runs.json  (appends, keeps last 30 days of runs)
 *         docs/exports/current-run.csv
 *         docs/exports/all-runs-summary.csv
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(ROOT, 'reports', 'playwright-report.json');
const LATEST_PATH = path.join(ROOT, 'docs', 'data', 'latest.json');
const HISTORY_PATH = path.join(ROOT, 'docs', 'history', 'runs.json');
const CSV_CURRENT = path.join(ROOT, 'docs', 'exports', 'current-run.csv');
const CSV_ALL = path.join(ROOT, 'docs', 'exports', 'all-runs-summary.csv');
const ARTIFACTS_DIR = path.join(ROOT, 'docs', 'artifacts');
const RETENTION_DAYS = 30;
// Hard upper bound — guards against a misbehaving run loop ballooning the
// file. At the steady ~6 runs/day cadence, 30 days ≈ 180 entries; 1000
// leaves comfortable headroom.
const MAX_HISTORY = 1000;

// ── Module name mapping ──
const MODULE_MAP = {
  'api-keys': 'API Keys',
  'billing': 'Billing',
  'contact-us': 'Contact Us',
  'dashboard': 'Dashboard',
  'settings': 'Settings',
  'usage': 'Usage',
  'z-logout': 'Logout',
};

function getModuleFromFile(filePath) {
  const base = path.basename(filePath, '.spec.ts');
  return MODULE_MAP[base] || base;
}

function getModuleKey(filePath) {
  return path.basename(filePath, '.spec.ts');
}

const BROWSER_LABELS = {
  chromium: 'Chrome (Chromium)',
  chrome: 'Chrome',
  safari: 'Safari',
};

function browserLabel(name) {
  return BROWSER_LABELS[name] || name;
}

function rollupStatus(statuses) {
  if (statuses.some(s => s === 'failed')) return 'failed';
  if (statuses.some(s => s === 'timedOut')) return 'timedOut';
  if (statuses.some(s => s === 'skipped')) return 'skipped';
  return 'passed';
}

// ── Recursively extract per-browser runs from Playwright suite tree ──
function extractTests(suite, tests = []) {
  if (suite.specs) {
    for (const spec of suite.specs) {
      for (const test of spec.tests || []) {
        if (spec.file && spec.file.includes('auth.setup')) continue;
        if (test.projectName === 'setup') continue;

        const projectName = test.projectName || 'chromium';
        let best = null;
        for (const result of test.results || []) {
          const status = result.status === 'passed' ? 'passed'
            : result.status === 'timedOut' ? 'timedOut'
            : result.status === 'skipped' ? 'skipped'
            : 'failed';

          const errorMsg = result.errors && result.errors.length > 0
            ? result.errors.map(e => e.message || '').join('\n').substring(0, 500)
            : '';

          const attachments = (result.attachments || []).map(a => ({
            name: a.name,
            sourcePath: a.path || '',
            path: a.path ? path.basename(a.path) : '',
            contentType: a.contentType || '',
          }));

          const row = {
            title: spec.title,
            status,
            durationMs: result.duration || 0,
            file: spec.file || '',
            module: getModuleKey(spec.file || ''),
            moduleLabel: getModuleFromFile(spec.file || ''),
            attachments,
            error: errorMsg,
            retry: result.retry || 0,
            projectName,
          };
          if (!best || row.retry >= best.retry) best = row;
        }
        if (best) tests.push(best);
      }
    }
  }

  if (suite.suites) {
    for (const child of suite.suites) {
      extractTests(child, tests);
    }
  }

  return tests;
}

/** One dashboard row per test case; browsers nested (no duplicate TC rows). */
function mergeByTestCase(browserRuns) {
  const byCase = new Map();

  for (const run of browserRuns) {
    const key = `${run.file}::${run.title}`;
    if (!byCase.has(key)) {
      byCase.set(key, {
        title: run.title,
        file: run.file,
        module: run.module,
        moduleLabel: run.moduleLabel,
        browsers: {},
        durationMs: 0,
      });
    }
    const entry = byCase.get(key);
    entry.browsers[run.projectName] = {
      label: browserLabel(run.projectName),
      status: run.status,
      durationMs: run.durationMs,
      error: run.error,
      attachments: run.attachments,
    };
    entry.durationMs += run.durationMs;
  }

  return Array.from(byCase.values()).map(entry => {
    const browserStatuses = Object.values(entry.browsers).map(b => b.status);
    const status = rollupStatus(browserStatuses);
    const failedBrowsers = Object.entries(entry.browsers)
      .filter(([, b]) => b.status !== 'passed')
      .map(([name]) => name);

    let error = '';
    if (status !== 'passed') {
      error = failedBrowsers
        .map(name => {
          const b = entry.browsers[name];
          const msg = b.error ? b.error.split('\n')[0].substring(0, 200) : b.status;
          return `${browserLabel(name)}: ${msg}`;
        })
        .join(' | ');
    }

    const attachments = [];
    for (const [browserName, b] of Object.entries(entry.browsers)) {
      if (b.status === 'passed') continue;
      for (const a of b.attachments) {
        attachments.push({ ...a, browser: browserName });
      }
    }

    return {
      title: entry.title,
      file: entry.file,
      module: entry.module,
      moduleLabel: entry.moduleLabel,
      status,
      durationMs: entry.durationMs,
      browsers: entry.browsers,
      failedBrowsers,
      error,
      attachments,
    };
  });
}

// ── Main ──
function main() {
  if (!fs.existsSync(REPORT_PATH)) {
    console.error('Report not found:', REPORT_PATH);
    console.error('Run tests first: npx playwright test');
    process.exit(1);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const browserRuns = extractTests(report);
  const tests = mergeByTestCase(browserRuns);
  const browsersTested = [...new Set(browserRuns.map(t => t.projectName))].sort();

  // Compute summary
  const passed = tests.filter(t => t.status === 'passed').length;
  const failed = tests.filter(t => t.status === 'failed').length;
  const skipped = tests.filter(t => t.status === 'skipped').length;
  const timedOut = tests.filter(t => t.status === 'timedOut').length;
  const total = tests.length;
  const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Compute per-module stats
  const modules = {};
  for (const t of tests) {
    if (!modules[t.module]) {
      modules[t.module] = { label: t.moduleLabel, total: 0, passed: 0, failed: 0, skipped: 0, timedOut: 0 };
    }
    modules[t.module].total++;
    if (t.status === 'passed') modules[t.module].passed++;
    else if (t.status === 'failed') modules[t.module].failed++;
    else if (t.status === 'skipped') modules[t.module].skipped++;
    else if (t.status === 'timedOut') modules[t.module].timedOut++;
  }

  const runId = crypto.randomUUID();
  const startedAt = report.stats?.startTime || new Date().toISOString();
  const durationMs = report.stats?.duration || tests.reduce((sum, t) => sum + t.durationMs, 0);

  // Copy artifacts (screenshots, videos, traces) for failed tests
  // Clean previous artifacts first
  if (fs.existsSync(ARTIFACTS_DIR)) {
    fs.rmSync(ARTIFACTS_DIR, { recursive: true });
  }
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });

  let artifactCount = 0;
  for (const t of tests) {
    if (t.status === 'passed') continue;
    const slug = t.title.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40).toLowerCase();
    for (const a of t.attachments) {
      if (!a.sourcePath || !fs.existsSync(a.sourcePath)) continue;
      const ext = path.extname(a.path) || '';
      const browserPrefix = a.browser ? `${a.browser}-` : '';
      const destName = `${slug}-${browserPrefix}${a.name}${ext}`;
      const destPath = path.join(ARTIFACTS_DIR, destName);
      try {
        fs.copyFileSync(a.sourcePath, destPath);
        a.webPath = `./artifacts/${destName}`;
        artifactCount++;
      } catch { /* skip if copy fails */ }
    }
  }
  if (artifactCount > 0) {
    console.log(`Copied ${artifactCount} artifacts to docs/artifacts/`);
  }

  const latest = {
    id: runId,
    startedAt,
    durationMs,
    browsersTested,
    summary: { total, passed, failed, skipped, timedOut },
    passRate,
    modules,
    tests: tests.map((t) => ({
      ...t,
      attachments: t.attachments.map(({ sourcePath, browser, ...a }) => ({
        ...a,
        browser,
      })),
    })),
  };

  // Write latest.json
  fs.mkdirSync(path.dirname(LATEST_PATH), { recursive: true });
  fs.writeFileSync(LATEST_PATH, JSON.stringify(latest, null, 2));
  console.log('Written:', LATEST_PATH);

  // Update history (append, cap at MAX_HISTORY)
  let history = [];
  if (fs.existsSync(HISTORY_PATH)) {
    try { history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8')); } catch { history = []; }
  }

  const runSummary = {
    id: runId,
    startedAt,
    durationMs,
    browsersTested,
    summary: { total, passed, failed, skipped, timedOut },
    passRate,
    modules,
  };

  history.unshift(runSummary);

  // Drop runs older than RETENTION_DAYS (based on startedAt). Entries
  // without a parseable startedAt are kept to avoid silent data loss.
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  history = history.filter(r => {
    const t = Date.parse(r.startedAt);
    return Number.isNaN(t) || t >= cutoff;
  });
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);

  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true });
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
  console.log('Written:', HISTORY_PATH);

  // Write current-run.csv
  const csvHeader = 'Test ID,Test Name,Module,Status,Failed Browsers,Duration (ms),Error\n';
  const csvRows = tests.map(t => {
    const titleMatch = t.title.match(/^(TC_\w+_\d+)\s*-\s*(.+)$/);
    const id = titleMatch ? titleMatch[1] : '';
    const name = titleMatch ? titleMatch[2].trim() : t.title;
    const error = (t.error || '').replace(/"/g, '""').replace(/\n/g, ' ');
    const failedIn = (t.failedBrowsers || []).map(browserLabel).join('; ');
    return `"${id}","${name}","${t.moduleLabel}","${t.status}","${failedIn}",${t.durationMs},"${error}"`;
  }).join('\n');

  fs.mkdirSync(path.dirname(CSV_CURRENT), { recursive: true });
  fs.writeFileSync(CSV_CURRENT, csvHeader + csvRows);
  console.log('Written:', CSV_CURRENT);

  // Write all-runs-summary.csv
  const summaryHeader = 'Run ID,Date,Total,Passed,Failed,Skipped,Timed Out,Pass Rate (%),Duration (ms)\n';
  const summaryRows = history.map(r => {
    const date = new Date(r.startedAt).toLocaleString('en-US');
    return `"${r.id}","${date}",${r.summary.total},${r.summary.passed},${r.summary.failed},${r.summary.skipped},${r.summary.timedOut},${r.passRate},${r.durationMs}`;
  }).join('\n');

  fs.writeFileSync(CSV_ALL, summaryHeader + summaryRows);
  console.log('Written:', CSV_ALL);

  console.log(`\nDashboard data generated: ${total} test cases (${passed} passed, ${failed} failed, ${passRate}% pass rate)`);
  console.log(`Browsers: ${browsersTested.map(browserLabel).join(', ')}`);
}

main();
