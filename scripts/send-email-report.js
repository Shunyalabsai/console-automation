#!/usr/bin/env node

/**
 * send-email-report.js
 * Reads latest dashboard data and sends a styled HTML email report
 * via the Google Apps Script email endpoint.
 *
 * Env vars:
 *   EMAIL_WEB_APP_URL   — Google Apps Script web app URL (doPost endpoint)
 *   REPORT_RECIPIENTS   — Comma-separated email addresses
 *
 * Reads: docs/data/latest.json
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const LATEST_PATH = path.join(ROOT, 'docs', 'data', 'latest.json');
const HISTORY_PATH = path.join(ROOT, 'docs', 'history', 'runs.json');
const EMAIL_URL = process.env.EMAIL_WEB_APP_URL || '';
const RECIPIENTS = process.env.REPORT_RECIPIENTS || '';
const DASHBOARD_URL = 'https://saira-uwc.github.io/Shunyalabs_console/';
const SHEETS_URL = process.env.GOOGLE_SHEETS_URL || 'https://docs.google.com/spreadsheets/d/1GfMd1xcNuaagSpjvAENlZrBrWbYr2JsIXHSvFwK0rHo/edit?gid=0#gid=0';

function main() {
  if (!EMAIL_URL) {
    console.log('\n⚠️  EMAIL_WEB_APP_URL not set — skipping email report');
    console.log('   Add EMAIL_WEB_APP_URL to .env to enable email reports\n');
    return;
  }

  if (!RECIPIENTS) {
    console.log('\n⚠️  REPORT_RECIPIENTS not set — skipping email report');
    console.log('   Add REPORT_RECIPIENTS to .env (comma-separated emails)\n');
    return;
  }

  if (!fs.existsSync(LATEST_PATH)) {
    console.error('No dashboard data found:', LATEST_PATH);
    console.error('Run tests and generate dashboard first.');
    return;
  }

  const data = JSON.parse(fs.readFileSync(LATEST_PATH, 'utf8'));
  const failCount = data.summary.failed + (data.summary.timedOut || 0);

  // Only send email if the last run had failures
  if (failCount === 0) {
    console.log('\n✅ Last run passed with 0 failures — no email needed.');
    console.log(`   Pass rate: ${data.passRate}% | Total: ${data.summary.total} | Passed: ${data.summary.passed}`);
    console.log('   Skipping email report.\n');
    return;
  }

  console.log(`\n⚠️  Last run had ${failCount} failure(s) — sending email report...`);

  let todayRuns = 1;
  if (fs.existsSync(HISTORY_PATH)) {
    try {
      const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
      const today = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      todayRuns = history.filter(r => new Date(r.startedAt).toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) === today).length;
    } catch { /* ignore */ }
  }
  data.todayRuns = todayRuns;
  const subject = buildSubject(data);
  const body = buildEmailHTML(data);

  sendEmail(RECIPIENTS, subject, body);
}

function buildSubject(data) {
  const d = new Date(data.startedAt);
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  return `QC Shunyalabs Console Automation Report – ${dateStr} – ${data.passRate}% Pass Rate`;
}

function buildEmailHTML(data) {
  const s = data.summary;
  const d = new Date(data.startedAt);
  const dateStr = d.toLocaleDateString('en-US', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).toLowerCase();

  const passRateIcon = data.passRate === 100 ? '✅' : data.passRate >= 80 ? '🟡' : '🔴';
  const failCount = s.failed + (s.timedOut || 0);

  // Build module rows
  const moduleRows = Object.entries(data.modules).map(([, m]) => {
    const rate = m.total > 0 ? Math.round((m.passed / m.total) * 100) : 0;
    const icon = rate === 100 ? '✅' : rate >= 80 ? '🟡' : '🔴';
    return `
      <tr>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;font-size:14px">${icon} ${m.label}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#22c55e;font-weight:600;font-size:14px">${m.passed}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ef4444;font-weight:600;font-size:14px">${m.failed + (m.timedOut || 0)}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;font-size:14px">${rate}%</td>
      </tr>`;
  }).join('');

  // Build failed tests section (if any)
  let failedSection = '';
  if (failCount > 0 && data.tests) {
    const failedTests = data.tests.filter(t => t.status !== 'passed');
    const failedRows = failedTests.map(t => `
      <tr>
        <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:13px;color:#333">${t.title}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#ef4444">${t.moduleLabel}</td>
        <td style="padding:8px 14px;border-bottom:1px solid #f0f0f0;font-size:12px;color:#666;max-width:250px;word-break:break-word">${(t.error || 'Unknown error').substring(0, 120)}</td>
      </tr>
    `).join('');

    failedSection = `
      <div style="margin:24px 40px 0">
        <p style="font-size:14px;font-weight:600;color:#333;margin-bottom:8px">🔴 Failed Tests</p>
        <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
          <thead>
            <tr style="background:#fef2f2">
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;font-weight:600">Test Name</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;font-weight:600">Module</th>
              <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;font-weight:600">Error</th>
            </tr>
          </thead>
          <tbody>${failedRows}</tbody>
        </table>
      </div>`;
  }

  // Action buttons
  let buttons = `
    <a href="${DASHBOARD_URL}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;margin-right:12px">📊 View Full Dashboard</a>`;

  buttons += `
    <a href="${SHEETS_URL}" style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px">📋 View Test Cases</a>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:20px 0">
<tr><td align="center">
<table width="620" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.08)">

  <!-- Header -->
  <tr>
    <td style="background:linear-gradient(135deg,#8b5cf6 0%,#6d28d9 50%,#4c1d95 100%);padding:32px 40px;color:#fff">
      <p style="margin:0 0 4px;font-size:13px;opacity:.8">🔴</p>
      <h1 style="margin:0 0 6px;font-size:24px;font-weight:700">QC Automation Report</h1>
      <p style="margin:0 0 4px;font-size:14px;opacity:.9">Shunyalabs Console Automation</p>
      <p style="margin:0 0 8px;font-size:13px;opacity:.7">Latest Run: ${dateStr}, ${timeStr}</p>
      <span style="display:inline-block;padding:4px 12px;background:rgba(255,255,255,.2);border-radius:12px;font-size:12px;font-weight:600">Today's Runs: ${data.todayRuns || 1}</span>
    </td>
  </tr>

  <!-- Stat Cards -->
  <tr>
    <td style="padding:28px 40px 0">
      <table width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td width="25%" style="padding:0 6px 0 0">
            <div style="border:2px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
              <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Total Tests</p>
              <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#333">${s.total}</p>
            </div>
          </td>
          <td width="25%" style="padding:0 6px">
            <div style="border:2px solid #bbf7d0;border-radius:10px;padding:16px;text-align:center">
              <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Passed</p>
              <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#22c55e">${s.passed}</p>
            </div>
          </td>
          <td width="25%" style="padding:0 6px">
            <div style="border:2px solid #fecaca;border-radius:10px;padding:16px;text-align:center">
              <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Failed</p>
              <p style="margin:6px 0 0;font-size:28px;font-weight:700;color:#ef4444">${failCount}</p>
            </div>
          </td>
          <td width="25%" style="padding:0 0 0 6px">
            <div style="border:2px solid #e5e7eb;border-radius:10px;padding:16px;text-align:center">
              <p style="margin:0;font-size:11px;color:#666;text-transform:uppercase;font-weight:600;letter-spacing:.5px">Pass Rate</p>
              <p style="margin:2px 0 0;font-size:20px">${passRateIcon}</p>
              <p style="margin:2px 0 0;font-size:22px;font-weight:700;color:#333">${data.passRate}%</p>
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Module Results Table -->
  <tr>
    <td style="padding:24px 40px 0">
      <p style="font-size:14px;font-weight:600;color:#333;margin:0 0 10px">📋 Results by Module</p>
      <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb">
        <thead>
          <tr style="background:#f9fafb">
            <th style="padding:10px 14px;text-align:left;font-size:12px;color:#666;font-weight:600">Module</th>
            <th style="padding:10px 14px;text-align:center;font-size:12px;color:#22c55e;font-weight:600">Pass</th>
            <th style="padding:10px 14px;text-align:center;font-size:12px;color:#ef4444;font-weight:600">Fail</th>
            <th style="padding:10px 14px;text-align:center;font-size:12px;color:#666;font-weight:600">Rate</th>
          </tr>
        </thead>
        <tbody>${moduleRows}</tbody>
      </table>
    </td>
  </tr>

  ${failedSection}

  <!-- Action Buttons -->
  <tr>
    <td style="padding:28px 40px;text-align:center">
      ${buttons}
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:20px 40px;border-top:1px solid #e5e7eb;text-align:center">
      <p style="margin:0 0 4px;font-size:13px;color:#666">Thanks & Regards,</p>
      <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#333">Saira Automation BOT 🤖</p>
      <p style="margin:0;font-size:11px;color:#999">This is an automated report generated from the latest test run.</p>
    </td>
  </tr>

</table>

<!-- Confidential Notice -->
<p style="max-width:620px;margin:16px auto 0;font-size:10px;color:#999;text-align:left;line-height:1.4">
  <strong style="text-decoration:underline">CONFIDENTIAL COMMUNICATION</strong><br>
  E-mails from this address normally contain privileged and confidential materials and are for the sole use of the intended recipient. Use or distribution by an unintended recipient is prohibited, and may be a violation of law. If you believe that you received this e-mail in error, please do not read this e-mail or any attached items. Please delete the e-mail and all attachments, including any copies thereof, and inform the sender that you have deleted the e-mail, all attachments, and copies thereof.
</p>
<p style="max-width:620px;margin:8px auto 0;font-size:10px;color:#999;font-style:italic">Thank you in advance for your adherence</p>

</td></tr>
</table>
</body>
</html>`;
}

async function sendEmail(to, subject, body) {
  try {
    console.log(`\n📧 Sending email report to: ${to}`);

    const response = await fetch(EMAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({ to, subject, body }),
      redirect: 'follow',
    });

    if (response.ok) {
      const result = await response.json();
      if (result.ok) {
        console.log('✅ Email report sent successfully');
      } else {
        console.error('❌ Email send failed:', result.error || 'Unknown error');
      }
    } else {
      // Handle redirect manually (Apps Script 302)
      if (response.status >= 300 && response.status < 400) {
        const redirectUrl = response.headers.get('location');
        if (redirectUrl) {
          const getResp = await fetch(redirectUrl);
          if (getResp.ok) {
            console.log('✅ Email report sent successfully');
            return;
          }
        }
      }
      console.error(`❌ Email send failed: HTTP ${response.status}`);
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
  }
}

main();
