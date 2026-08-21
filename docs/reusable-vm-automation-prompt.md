# Full-project prompt — replicate Console automation for another website

Use this when you want a **new repo** with the **same end-to-end system** as **Shunyalabs Console automation** (Playwright → Sheets → GitHub Pages dashboard → failure email → VM cron), but **your own app URL and your own tests**.

Reference implementation: this repo (`Shunyalabsai/console-automation`).

---

## End-to-end pipeline (what you are copying)

```
┌─────────────────────────────────────────────────────────────────────────┐
│  SCHEDULE: VM cron every 2h (or GitHub Actions before migration)        │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  1. AUTH          tests/auth.setup.ts → playwright/.auth/user.json     │
│  2. TESTS         Playwright specs + pages/* (your scenarios)           │
│  3. REPORTERS     list + json + html + utils/google-sheets-reporter.ts │
│  4. DASHBOARD     scripts/generate-dashboard.js → docs/data|history|csv │
│  5. GIT PUSH      commit docs/** to main                                │
│  6. GITHUB PAGES  workflow deploys docs/ (index.html reads JSON)        │
│  7. EMAIL         scripts/send-email-report.js → Apps Script (failures) │
└─────────────────────────────────────────────────────────────────────────┘
```

**Keep on Google (do not delete):** Apps Script **web apps** for Sheets POST + email POST.  
**Remove:** Apps Script **time triggers** that only fired GitHub Actions.

---

## PROMPT — copy everything below into a new Cursor chat

````
Build a complete Playwright E2E automation project for OUR NEW WEBSITE, using the SAME architecture, folder structure, and operational model as the reference repo "Shunyalabs Console automation" (`Shunyalabsai/console-automation` on GitHub). I will supply my own test scenarios; you wire the full platform around them.

═══════════════════════════════════════════════════════════════
A. NEW PROJECT INPUTS (I will fill these in)
═══════════════════════════════════════════════════════════════

| Item | My value |
|------|----------|
| Product name | PRODUCT_NAME |
| App under test (BASE_URL) | https://YOUR-APP.example.com |
| Sign-in URL | https://YOUR-APP.example.com/auth/sign-in |
| GitHub org/repo | GITHUB_ORG/GITHUB_REPO |
| GitHub Pages URL (after deploy) | https://GITHUB_USER.github.io/GITHUB_REPO/ |
| Google Sheet (optional) | SHEETS_URL or "none" |
| Email report recipients | email1@...,email2@... |
| VM SSH | VM_USER@VM_IP |
| VM clone folder | $HOME/PROJECT_FOLDER_NAME |
| Cron schedule | 0 */2 * * * (stagger minute if VM shared) |
| Test modules (spec files) | List my modules, e.g. dashboard, billing, settings — I provide specs |

═══════════════════════════════════════════════════════════════
B. REPO STRUCTURE (match reference layout)
═══════════════════════════════════════════════════════════════

Create/maintain this structure (same levels as Console):

```
PROJECT_ROOT/
├── .github/workflows/
│   ├── run-tests.yml          # optional legacy; disable schedule after VM live
│   ├── send-email.yml         # optional manual email workflow
│   └── pages.yml              # deploy docs/ to GitHub Pages
├── .env.example               # template only; .env gitignored
├── .gitignore                 # node_modules, reports/, playwright/.auth/, .env, etc.
├── playwright.config.ts       # dotenv, reporters, setup project + chromium
├── package.json               # scripts below
├── tsconfig.json
├── tests/
│   ├── auth.setup.ts          # login once, save storageState
│   ├── *.spec.ts              # MY tests (I provide or you scaffold from my list)
│   └── z-logout.spec.ts       # last — session cleanup
├── pages/
│   ├── BasePage.ts
│   ├── LoginPage.ts
│   └── *Page.ts               # one per module
├── utils/
│   ├── testData.ts            # BASE_URL, credentials from env
│   ├── helpers.ts
│   └── google-sheets-reporter.ts
├── scripts/
│   ├── generate-dashboard.js  # json report → docs/data, history, csv, artifacts
│   ├── send-email-report.js   # reads docs/data/latest.json, Apps Script email
│   ├── push-dashboard.js      # optional local push helper
│   ├── run-automation-machine.sh  # VM pipeline (mirror run-tests.yml)
│   ├── google-apps-script-email.js      # REFERENCE only (copy to Apps Script UI)
│   └── google-apps-script-scheduler.js  # REFERENCE only — do NOT use scheduler on VM
├── docs/
│   ├── index.html             # static dashboard UI (Chart.js, reads latest.json + runs.json)
│   ├── data/latest.json       # generated
│   ├── history/runs.json      # generated, 30-day retention
│   ├── exports/*.csv          # generated
│   └── artifacts/             # failure screenshots/videos/traces copied here
├── fixtures/                  # if needed (e.g. audio)
├── reports/                   # gitignored playwright-report.json
└── docs/
    ├── automation-server.md
    └── vm-automation-migration-guide.md
```

═══════════════════════════════════════════════════════════════
C. PLAYWRIGHT (same behaviour as Console)
═══════════════════════════════════════════════════════════════

playwright.config.ts:
- testDir: ./tests
- fullyParallel: false, workers: 1, retries: 1
- reporters: html (playwright-report), json → reports/playwright-report.json, list, ./utils/google-sheets-reporter.ts
- use: baseURL from env, headless, trace on-first-retry, screenshot/video on failure
- projects: [setup: auth.setup.ts], [chromium: depends on setup, storageState playwright/.auth/user.json]
- dotenv.config()

auth.setup.ts:
- LoginPage.login with TEST_EMAIL / TEST_PASSWORD from env
- assertLoggedIn, save storageState

Page object pattern:
- BasePage with goto, waitForPageLoad
- One page class per module; tests use TC_* naming: TC_MODULE_01 - description

═══════════════════════════════════════════════════════════════
D. GOOGLE SHEETS REPORTER (same pattern)
═══════════════════════════════════════════════════════════════

utils/google-sheets-reporter.ts:
- POST test results to GOOGLE_APPS_SCRIPT_URL from .env
- Skip gracefully if URL missing
- Same payload shape as Console if possible (adapt column labels to PRODUCT_NAME)

Provide Apps Script deployment instructions in a comment block (deploy as web app, execute as me, POST).

═══════════════════════════════════════════════════════════════
E. DASHBOARD + GITHUB PAGES (same “pages concept” as Console)
═══════════════════════════════════════════════════════════════

scripts/generate-dashboard.js:
- Read reports/playwright-report.json
- Write docs/data/latest.json (summary, passRate, per-test rows, modules)
- Append docs/history/runs.json (cap retention 30 days / max entries)
- Write docs/exports/current-run.csv and all-runs-summary.csv
- Copy failure artifacts into docs/artifacts/
- MODULE_MAP keyed by spec file basename → human labels (use my module list)

docs/index.html:
- Same UX level as Console: dark theme, sticky header, pass/fail stats, Chart.js trends, module breakdown, run history dropdown, links to artifacts
- Load docs/data/latest.json and docs/history/runs.json via fetch (works on GitHub Pages)
- Title/branding: PRODUCT_NAME Automation Dashboard

.github/workflows/pages.yml:
- on.push main, paths ONLY:
  docs/data/**, docs/history/**, docs/exports/**, docs/artifacts/**, docs/index.html
- jobs: checkout main → upload-pages-artifact@v4 path docs → deploy-pages@v4
- workflow_dispatch retained
- permissions: contents read, pages write, id-token write

Enable GitHub Pages on repo: source = GitHub Actions.

═══════════════════════════════════════════════════════════════
F. EMAIL ON FAILURES (same pattern)
═══════════════════════════════════════════════════════════════

scripts/send-email-report.js:
- Read docs/data/latest.json
- If pass rate 100% / 0 failures → skip (log message)
- Else POST HTML report to EMAIL_WEB_APP_URL with REPORT_RECIPIENTS
- Link to DASHBOARD_URL and SHEETS_URL in template

scripts/google-apps-script-email.js:
- Reference file for manual paste into Google Apps Script (doPost email endpoint)

.github/workflows/send-email.yml:
- workflow_dispatch only (optional), same env as Console

═══════════════════════════════════════════════════════════════
G. GITHUB ACTIONS run-tests.yml (optional / legacy)
═══════════════════════════════════════════════════════════════

Mirror Console .github/workflows/run-tests.yml:
- workflow_dispatch + repository_dispatch (for old Apps Script trigger — we will disable trigger)
- npm ci, playwright chromium, create .env from secrets, playwright test continue-on-error
- generate-dashboard.js, commit docs paths, send-email-report.js, upload artifacts

After VM is live: document “disable schedule / use VM only”.

═══════════════════════════════════════════════════════════════
H. VM AUTOMATION (same as Console — critical)
═══════════════════════════════════════════════════════════════

scripts/run-automation-machine.sh:
1. Require .env
2. checkout main
3. git fetch origin main && git reset --hard origin/main   # never run stale VM edits
4. CI=true, npm ci
5. npx playwright install chromium (not --with-deps unless PLAYWRIGHT_WITH_DEPS=true)
6. npx playwright test (set +e, failures do not abort)
7. node scripts/generate-dashboard.js
8. Unless AUTOMATION_SKIP_GIT_PUSH: fetch, reset --mixed origin/main, add docs/data docs/history docs/exports docs/artifacts, commit IST message, git push origin HEAD:main
9. node scripts/send-email-report.js

package.json: "automation:run": "bash scripts/run-automation-machine.sh"

Also generate docs/vm-automation-migration-guide.md with FULL Linux VM steps below (Part M), not a short summary.

═══════════════════════════════════════════════════════════════
M. LINUX VM SETUP (same as Console — include in migration guide + operator checklist)
═══════════════════════════════════════════════════════════════

Server rules from lead: work only in $HOME; do not stop others’ services; do not share private keys in chat.

ONE-TIME (operator runs on VM_USER@VM_IP):

1) SSH and home
   ssh VM_USER@VM_IP
   cd ~

2) Node 20 via nvm (Ubuntu apt node is often v12 — do not use it)
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
   source ~/.bashrc
   nvm install 20 && nvm use 20 && nvm alias default 20
   node -v   # must show v20.x

3) Clone repo (HTTPS or git@ after SSH key works)
   git clone https://github.com/GITHUB_ORG/GITHUB_REPO.git PROJECT_FOLDER_NAME
   cd ~/PROJECT_FOLDER_NAME

4) .env on server (never commit)
   cp .env.example .env && nano .env
   Fill: BASE_URL, LOGIN_URL, TEST_EMAIL, TEST_PASSWORD,
        GOOGLE_APPS_SCRIPT_URL, EMAIL_WEB_APP_URL, REPORT_RECIPIENTS

5) Git identity (for dashboard commits)
   git config --global user.name "..."
   git config --global user.email "..."

6) SSH deploy key — generate ON VM ONLY (do not copy laptop private key)
   ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github_PROJECT -N "" -C "vm-PRODUCT_NAME"
   cat ~/.ssh/id_ed25519_github_PROJECT.pub
   → GitHub repo Settings → Deploy keys → Add → Allow write access

7) ~/.ssh/config (points to private key; key file is NOT pasted into GitHub)
   Host github.com-PROJECT
     HostName github.com
     User git
     IdentityFile ~/.ssh/id_ed25519_github_PROJECT
     IdentitiesOnly yes
   chmod 600 ~/.ssh/config ~/.ssh/id_ed25519_github_PROJECT

8) Git remote over SSH + test
   cd ~/PROJECT_FOLDER_NAME
   git remote set-url origin git@github.com-PROJECT:GITHUB_ORG/GITHUB_REPO.git
   ssh -T git@github.com-PROJECT   # type yes once for known_hosts
   # Expect: Hi ORG/REPO! You've successfully authenticated...

9) Playwright (no sudo on locked-down VMs)
   npm ci
   npx playwright install chromium
   # If browser missing .so libs: admin runs once: sudo npx playwright install-deps chromium

10) Trial then full run
    export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20
    AUTOMATION_SKIP_GIT_PUSH=true npm run automation:run
    npm run automation:run

11) Cron every 2 hours (stagger minute if multiple projects on same VM)
    crontab -e
    0 */2 * * * /bin/bash -lc 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/PROJECT_FOLDER_NAME" && npm run automation:run' >> "$HOME/automation-cron-PROJECT.log" 2>&1

ONGOING (automatic — no manual pull after first sync):
- Each npm run automation:run does: git fetch && git reset --hard origin/main (then tests)
- Push code from laptop → VM picks up on next cron
- Logs: tail -100 ~/automation-cron-PROJECT.log
- Closing laptop does NOT stop cron; stopping the VM does

IF tests show OLD names or git status shows modified files on VM:
   cd ~/PROJECT_FOLDER_NAME && git fetch origin main && git reset --hard origin/main

MULTI-PROJECT SAME VM:
- Separate ~/PROJECT_FOLDER per repo
- Separate deploy key + Host alias per repo (GitHub: one deploy key per repo)
- Cron: 0, 15, 30, 45 */2 offsets
- Separate log file per project

DISABLE duplicate runners:
- Apps Script: delete time trigger (e.g. triggerRunTests) that starts GitHub Actions
- GitHub Actions: disable schedule on run-tests.yml; keep workflow_dispatch optional
- Keep Apps Script web app URLs for Sheets + email

═══════════════════════════════════════════════════════════════
I. package.json scripts (same set as Console)
═══════════════════════════════════════════════════════════════

- test, test:headed, test:debug, test:ui, test:report
- test:<module> per spec file
- dashboard:generate, dashboard:run, dashboard:preview
- automation:run

═══════════════════════════════════════════════════════════════
J. SECRETS & .env.example
═══════════════════════════════════════════════════════════════

.env.example (never commit .env):
BASE_URL, LOGIN_URL, TEST_EMAIL, TEST_PASSWORD,
GOOGLE_APPS_SCRIPT_URL, EMAIL_WEB_APP_URL, REPORT_RECIPIENTS
Optional: GOOGLE_SHEETS_URL

GitHub Actions secrets: same names as Console.

═══════════════════════════════════════════════════════════════
K. WHAT I PROVIDE vs WHAT YOU BUILD
═══════════════════════════════════════════════════════════════

I provide:
- Module list and test cases (or existing spec files to drop in)
- URLs, credentials, Apps Script URLs, GitHub repo name, VM access details
- Google Sheet + email recipients

You build:
- Entire repo scaffolding matching sections B–J
- Wire MY tests into pages/ and tests/
- All scripts, dashboard HTML, workflows, VM docs
- MODULE_MAP entries for my spec file names

═══════════════════════════════════════════════════════════════
L. RULES
═══════════════════════════════════════════════════════════════

- Same quality and depth as Shunyalabs Console automation — not a minimal stub.
- TypeScript + Playwright best practices; match Console naming (TC_*, page objects).
- Do not commit secrets; do not commit playwright/.auth or reports/.
- When done, deliver:
  1) File tree created
  2) GitHub setup checklist (Pages, secrets, deploy keys)
  3) Apps Script checklist (deploy web apps, delete old schedule triggers)
  4) Full Linux VM setup doc (Part M) + exact cron line
  5) How to run locally: npm ci && npx playwright install chromium && cp .env.example .env && npm run automation:run
  6) Troubleshooting: dirty VM tree, sudo/playwright, Pages vs VM failures, git push auth

Ask me only for values you cannot infer from this prompt and the reference repo.
````

---

## Does this prompt include Linux VM setup?

**Yes.** Section **H** (runner script) + **M** (full Linux steps: SSH, nvm, clone, `.env`, deploy key, SSH config, Playwright, cron, logs, multi-project, disable duplicate triggers). The AI must also write **`docs/vm-automation-migration-guide.md`** with those steps spelled out for operators.

For Console-specific steps already done on `shunya-cpu-01`, see [vm-automation-migration-guide.md](./vm-automation-migration-guide.md).

---

## Reference files in Console repo

| Purpose | Path |
|---------|------|
| VM runner | `scripts/run-automation-machine.sh` |
| Dashboard generator | `scripts/generate-dashboard.js` |
| Public dashboard UI | `docs/index.html` |
| Pages deploy | `.github/workflows/pages.yml` |
| Sheets reporter | `utils/google-sheets-reporter.ts` |
| Email | `scripts/send-email-report.js` |
| Full VM guide | `docs/vm-automation-migration-guide.md` |
