# VM automation migration — full setup guide

This document describes how **Shunyalabs Console automation** was moved from **GitHub Actions + Google Apps Script schedulers** to a **dedicated Linux VM** with **cron**, while keeping **Google Sheets** and **failure email** via existing Apps Script web apps.

Use this as a checklist for this repo and as a template for other similar Playwright + dashboard + Sheets projects.

---

## What runs where (before vs after)

| Step | Before (GitHub Actions) | After (VM + cron) |
|------|-------------------------|-------------------|
| Run Playwright tests | Actions runner | VM: `npm run automation:run` |
| Update Google Sheet | Playwright reporter → Apps Script URL | Same (reads `.env` on VM) |
| Generate dashboard JSON/CSV | `generate-dashboard.js` | Same |
| Commit/push `docs/**` to `main` | Actions bot | VM `git push` (deploy key) |
| Deploy GitHub Pages | After test workflow | On **`push` to `main`** under `docs/**` |
| Failure email | `send-email-report.js` → Apps Script | Same |
| Schedule | Apps Script → `repository_dispatch` | **cron** every 2 hours |

**Keep on Google:** deployed **web app URLs** (Sheets + email).  
**Remove/disable:** **time-based** Apps Script triggers that only start GitHub Actions (e.g. `triggerRunTests`).

---

## Prerequisites

- SSH access to the VM (work only in your home directory; do not stop others’ services).
- GitHub repo with automation code on `main`.
- Same secrets you used in GitHub Actions (or copy from your local `.env`).
- Permission to add a **Deploy key** (write) on the repo, or account SSH key.

**This repo already includes:**

- `scripts/run-automation-machine.sh` — full pipeline (mirrors `.github/workflows/run-tests.yml`)
- `npm run automation:run`
- `.env.example`
- `.github/workflows/pages.yml` — deploys Pages on `push` to `main` when `docs/**` changes

---

## Part A — One-time VM setup

### A1. SSH into the server

```bash
ssh YOUR_USER@YOUR_SERVER_IP
```

Example used: `ssh saira@136.119.127.72` → host `shunya-cpu-01`.

### A2. Clone the repository (under your home)

```bash
cd ~
git clone https://github.com/ORG/REPO.git PROJECT_FOLDER_NAME
cd PROJECT_FOLDER_NAME
git checkout main
git pull origin main
```

For this project:

```bash
git clone https://github.com/Shunyalabsai/console-automation.git Shunyalabs-console-automation
```

### A3. Install Node.js 20 (nvm — no sudo)

Ubuntu’s default `node` may be v12; this project needs **v20**.

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
nvm alias default 20
node -v   # expect v20.x.x
```

### A4. Install npm dependencies and Playwright Chromium

```bash
cd ~/Shunyalabs-console-automation   # or your folder name
npm ci
```

**Without sudo** (recommended on locked-down VMs):

```bash
npx playwright install chromium
```

If the browser fails with missing libraries, ask an admin once:

```bash
sudo npx playwright install-deps chromium
```

Or set `PLAYWRIGHT_WITH_DEPS=true` when running the automation script (requires sudo for `--with-deps`).

### A5. Create `.env` on the server (not in Git)

```bash
cp .env.example .env
nano .env
```

Fill (same as GitHub Actions secrets):

| Variable | Purpose |
|----------|---------|
| `BASE_URL` | App under test |
| `LOGIN_URL` | Sign-in URL |
| `TEST_EMAIL` | Test account |
| `TEST_PASSWORD` | Test password |
| `GOOGLE_APPS_SCRIPT_URL` | Sheets reporter POST |
| `EMAIL_WEB_APP_URL` | Failure email web app |
| `REPORT_RECIPIENTS` | Comma-separated emails |

Save: `Ctrl+O`, Enter, `Ctrl+X`.

**Important:** `.env` is gitignored. Cron loads it from disk when the job `cd`s into the repo — you do not need an open terminal.

### A6. Git identity (required for commits)

```bash
git config --global user.name "Your Name"
git config --global user.email "your-github-email@example.com"
```

### A7. SSH deploy key on the VM (do not copy laptop private key)

Generate **only on the VM** (matches lead guidance: do not share private keys):

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github -N "" -C "vm-automation"
chmod 600 ~/.ssh/id_ed25519_github
cat ~/.ssh/id_ed25519_github.pub
```

**GitHub:** Repo → **Settings** → **Deploy keys** → **Add deploy key**

- Paste the **single line** from `.pub` (starts with `ssh-ed25519`)
- Enable **Allow write access**
- Title e.g. `vm-hostname`

**SSH config** (`~/.ssh/config` — does **not** contain the private key, only points to it):

```
Host github.com
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github
  IdentitiesOnly yes
```

```bash
chmod 600 ~/.ssh/config
```

**Use SSH remote:**

```bash
cd ~/Shunyalabs-console-automation
git remote set-url origin git@github.com:ORG/REPO.git
ssh -T git@github.com
```

First time: type **`yes`** to add `github.com` to `known_hosts`.

Expected: `Hi ORG/REPO! You've successfully authenticated...`

### A8. First full run (trial without push)

```bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm use 20
cd ~/Shunyalabs-console-automation
AUTOMATION_SKIP_GIT_PUSH=true npm run automation:run
```

Expect: tests run, Sheets updated, dashboard files written, no email if 100% pass.

### A9. Full run with push

```bash
npm run automation:run
```

Expect: `Dashboard data pushed` and `git push` to `main` without username/password prompts.

---

## Part B — Schedule (cron every 2 hours)

```bash
crontab -e
```

Choose editor **1** (nano) if prompted.

Add one line (adjust path if needed):

```cron
0 */2 * * * /bin/bash -lc 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/Shunyalabs-console-automation" && npm run automation:run' >> "$HOME/automation-cron.log" 2>&1
```

Save and verify:

```bash
crontab -l
```

**Notes:**

- Schedule uses the **server timezone** (`date` / `timedatectl`).
- Closing your laptop or SSH session does **not** stop cron; **stopping the VM** does.
- Logs: `tail -100 ~/automation-cron.log`

---

## Part I — Multiple projects on the **same** server

Use this when **several repos** (e.g. Console, Registration, …) all run on **`shunya-cpu-01`** as user `saira`.

### What you do **once** (shared for all projects)

| Item | Status on your VM |
|------|-------------------|
| SSH login | Same user (`saira@136.119.127.72`) |
| **nvm + Node 20** | Install once; all crons use `nvm use 20` |
| **`github.com` in `known_hosts`** | Done after first `ssh -T git@github.com` |
| **Git `user.name` / `user.email`** | Set once globally (or per repo) |
| Playwright browser cache | Shared under `~/.cache/ms-playwright` |

You do **not** repeat nvm install for each project.

### What you do **per project** (repeat every time)

| # | Step | Notes |
|---|------|--------|
| 1 | **Clone** into its own folder under `$HOME` | Never reuse one folder for two repos |
| 2 | **`.env`** in that folder only | Different secrets per app (URLs, test users, Apps Script URLs) |
| 3 | **`npm ci`** + **`npx playwright install chromium`** | Run inside that project directory |
| 4 | **Deploy key** on **that GitHub repo** | One **new** keypair per repo (recommended), or ask lead if one account key may access all repos |
| 5 | **`git remote`** → `git@github.com:ORG/REPO.git` | Each clone points to its own repo |
| 6 | **Repo has** `scripts/run-automation-machine.sh` + `npm run automation:run` | Add via migration prompt if missing |
| 7 | **`pages.yml`** `push` on `docs/**` | Per repo, if it uses GitHub Pages |
| 8 | **Trial run** then **full run** | `AUTOMATION_SKIP_GIT_PUSH=true` first, then `npm run automation:run` |
| 9 | **Cron line** | Separate line per project (see below) |
| 10 | **Disable** that project’s Apps Script schedule + Actions test trigger | Avoid double runs |

### Folder layout (example)

```text
/home/saira/
├── Shunyalabs-console-automation/     # done
├── Shunyalabs-registration-automation/  # next project
├── other-project-automation/
├── automation-cron-console.log
├── automation-cron-registration.log
└── .ssh/
    ├── id_ed25519_github_console      # optional: separate keys per repo
    ├── id_ed25519_github_registration
    └── config
```

Use clear folder names: `PROJECT-automation` or match the repo name.

### SSH keys: two options

**Option A — One deploy key per repo (recommended, matches lead rules)**

```bash
# For each new repo on the VM:
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_github_REPO_SLUG -N "" -C "vm-REPO_SLUG"
cat ~/.ssh/id_ed25519_github_REPO_SLUG.pub
```

Add that `.pub` as **Deploy key (write)** on **that repo only**.

In `~/.ssh/config`, use **Host aliases** so each clone uses the right key:

```
Host github.com-console
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github_console
  IdentitiesOnly yes

Host github.com-registration
  HostName github.com
  User git
  IdentityFile ~/.ssh/id_ed25519_github_registration
  IdentitiesOnly yes
```

Then per clone:

```bash
git remote set-url origin git@github.com-console:Shunyalabsai/console-automation.git
# or
git remote set-url origin git@github.com-registration:ORG/Other_Repo.git
```

Test: `ssh -T git@github.com-console`

**Option B — Reuse one VM key on multiple repos**

GitHub allows the **same public key** as a deploy key on **only one** repository. So you **cannot** reuse `id_ed25519_github` from Console on Registration — generate a **new** keypair per repo (Option A).

### Cron: one line per project (stagger times)

Avoid starting **all** projects at `:00` — they compete for CPU/RAM. Example: every 2 hours, **offset by 15 minutes**:

```cron
# Console — :00 every 2h
0 */2 * * * /bin/bash -lc 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/Shunyalabs-console-automation" && npm run automation:run' >> "$HOME/automation-cron-console.log" 2>&1

# Registration — :15 every 2h (example; add when that project is ready)
15 */2 * * * /bin/bash -lc 'export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null && cd "$HOME/Shunyalabs-registration-automation" && npm run automation:run' >> "$HOME/automation-cron-registration.log" 2>&1
```

Edit with `crontab -e`. List all jobs: `crontab -l`.

### Per-project tracking table (fill in as you go)

| Project | Clone path | Repo | Deploy key added | `.env` done | First push OK | Cron line | Apps Script trigger off |
|---------|------------|------|------------------|-------------|---------------|-----------|-------------------------|
| Console | `~/Shunyalabs-console-automation` | `Shunyalabsai/console-automation` | Yes | Yes | Yes | `0 */2` | Yes |
| Project 2 | `~/...` | `ORG/REPO` | | | | `15 */2` | |
| Project 3 | `~/...` | `ORG/REPO` | | | | `30 */2` | |

### Checklist for “next project” on same server

1. SSH in (nvm already there).
2. `git clone` → new folder.
3. Ensure repo has `run-automation-machine.sh` + `automation:run` (use Part H prompt in Cursor if not).
4. `cp .env.example .env` → fill **that project’s** secrets.
5. `npm ci` && `npx playwright install chromium` in that folder.
6. New `ssh-keygen` → new deploy key on **that** repo → update `~/.ssh/config` Host alias → `git remote set-url`.
7. `AUTOMATION_SKIP_GIT_PUSH=true npm run automation:run` then `npm run automation:run`.
8. Add **one** cron line + **separate** log file.
9. Disable that project’s old Apps Script / Actions schedules.

Console is **done**; repeat steps 2–9 for each additional repo.

---

## Part C — Turn off duplicate schedulers

### C1. Google Apps Script

**Delete/disable** time-based triggers that call GitHub (e.g. `triggerRunTests`).

**Keep** deployed web apps used by:

- `GOOGLE_APPS_SCRIPT_URL` (Sheets)
- `EMAIL_WEB_APP_URL` (email)

### C2. GitHub Actions

With your lead: disable schedules / `repository_dispatch` for **Run Tests & Update Dashboard**, or leave **workflow_dispatch** only for emergencies.

**Keep** **Deploy Dashboard to GitHub Pages** — it deploys when `docs/**` is pushed to `main`.

---

## Part D — What each cron run does (end-to-end)

1. `npm ci`
2. `npx playwright install chromium` (no sudo by default)
3. `npx playwright test` (failures do not abort the script)
4. Google Sheets reporter (from `.env`)
5. `node scripts/generate-dashboard.js`
6. `git fetch` / `git reset --mixed origin/main` / commit `docs/data`, `docs/history`, `docs/exports`, `docs/artifacts` / `git push`
7. `node scripts/send-email-report.js` (only sends when there are failures)

GitHub Actions **Deploy Dashboard to GitHub Pages** runs after the push if `docs/**` changed.

---

## Part E — Verification checklist

| Check | How |
|-------|-----|
| Cron installed | `crontab -l` |
| Last cron run | `ls -la ~/automation-cron.log` and `tail -100 ~/automation-cron.log` |
| Last push | `git log -3 --oneline` on VM or GitHub **Commits** |
| Sheets | Open the Google Sheet |
| Pages | GitHub **Actions** → Deploy Dashboard; open Pages URL |
| SSH key used | Deploy key shows “Last used” on GitHub |
| No double runs | Apps Script test trigger removed |

---

## Part F — Troubleshooting

| Problem | Fix |
|---------|-----|
| `node -v` is 12 | Use nvm: `nvm install 20 && nvm use 20` |
| Playwright sudo fails | Use `npx playwright install chromium` only |
| `Author identity unknown` | `git config user.name` / `user.email` |
| `Username for https://github.com` | `git remote set-url origin git@github.com:ORG/REPO.git` + deploy key |
| `Key is already in use` on GitHub | Key exists elsewhere; use new VM keypair + new deploy key |
| Cron silent / no push | Read `~/automation-cron.log`; ensure nvm in cron line |
| Pages not updating | Confirm `pages.yml` has `push` on `docs/**`; check Actions tab |
| Double runs every 2h | Remove Apps Script schedule + disable Actions test schedule |

---

## Part G — Repo files reference (this project)

| File | Role |
|------|------|
| `scripts/run-automation-machine.sh` | VM pipeline |
| `package.json` → `automation:run` | Entry command |
| `.env.example` | Template (no secrets) |
| `.env` | Secrets on VM only |
| `.github/workflows/run-tests.yml` | Old CI (can disable) |
| `.github/workflows/pages.yml` | Pages on `docs/**` push |
| `playwright.config.ts` | Loads `.env` via dotenv |
| `utils/google-sheets-reporter.ts` | Sheets POST |
| `scripts/send-email-report.js` | Failure email |

---

## Part H — Reusable prompt for other projects

Copy the block below into a new chat when migrating **another** repo the same way. Replace placeholders in `ALL_CAPS`.

---

### PROMPT START (copy from here)

```
Migrate our Playwright (or E2E) automation from GitHub Actions + Google Apps Script schedulers to a dedicated Linux VM with cron. Match existing CI behaviour; do not change unrelated app/test code unless required for the runner script.

**Context**
- Same VM as existing projects: YES — user USER@SERVER_IP, nvm Node 20 already installed; add a NEW clone folder and NEW deploy key per repo
- Repo: GITHUB_ORG/GITHUB_REPO
- SSH: USER@SERVER_IP (work only under $HOME; no sudo unless admin approves)
- Clone path on VM: $HOME/PROJECT_FOLDER (must not conflict with other clones)
- Branch: main
- Schedule needed: every 2 hours (cron)
- Current CI workflow file: .github/workflows/WORKFLOW_NAME.yml
- Secrets today: GitHub Actions secrets (TEST_EMAIL, TEST_PASSWORD, GOOGLE_APPS_SCRIPT_URL, EMAIL_WEB_APP_URL, REPORT_RECIPIENTS, etc.)
- Google Apps Script: KEEP web app URLs for Sheets/email; REMOVE time-based triggers that dispatch GitHub Actions only
- GitHub Pages: dashboard lives under docs/** — deploy Pages when main is pushed with docs/** changes, not only when the old test workflow completes

**Deliverables**
1. Add scripts/run-automation-machine.sh that mirrors the test workflow: npm ci, playwright install (chromium, no --with-deps by default), playwright test (continue on failure), generate-dashboard (or equivalent), git commit/push dashboard paths, failure email script if present
2. Add .env.example and npm script automation:run
3. Update pages.yml (or equivalent) with on.push to main paths docs/**
4. Add docs/vm-automation-migration-guide.md with full step-by-step server setup: nvm node 20, .env on server, VM-only ed25519 deploy key + ~/.ssh/config, git remote git@github.com, crontab line with nvm, disable duplicate Apps Script/GitHub schedules, verification and troubleshooting
5. Do not commit .env or private keys

**Server steps to document for the operator**
- ssh, clone, nvm 20, npm ci, playwright install chromium
- cp .env.example .env and fill secrets
- git config user.name/email
- ssh-keygen on VM only → deploy key on repo (write) → ~/.ssh/config → git remote set-url origin git@github.com:ORG/REPO.git → ssh -T git@github.com (yes to known_hosts once)
- AUTOMATION_SKIP_GIT_PUSH=true npm run automation:run then npm run automation:run
- crontab every 2 hours with nvm in the command
- tail automation-cron.log for monitoring

Ask me only for values you cannot infer (repo URL, workflow filename, dashboard paths to commit).
```

### PROMPT END

---

## Quick command reference (this project)

```bash
# SSH
ssh saira@136.119.127.72

# Session setup
export NVM_DIR="$HOME/.nvm" && [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh" && nvm use 20
cd ~/Shunyalabs-console-automation

# Manual run
npm run automation:run

# Logs
tail -100 ~/automation-cron.log

# Cron list
crontab -l
```

---

See also: [automation-server.md](./automation-server.md) (short operator notes).
