# Running automation on the dedicated server

This matches the behaviour of [.github/workflows/run-tests.yml](../.github/workflows/run-tests.yml): install deps, run Playwright, regenerate dashboard files, push `docs/data`, `docs/history`, `docs/exports`, `docs/artifacts` to `main`, then run the failure email script.

## 1. One-time server setup (your home directory only)

SSH in, then:

```bash
# Example: clone into your home (HTTPS or SSH — match how you authenticate to GitHub)
cd ~
git clone https://github.com/saira-uwc/Shunyalabs_console.git Shunyalabs-console-automation
cd Shunyalabs-console-automation
```

Install **Node.js 20** (use your team’s preferred method: `nvm`, package manager, etc.).

Copy secrets into `.env`:

```bash
cp .env.example .env
# Edit .env — same variables as GitHub Actions secrets + BASE_URL / LOGIN_URL
```

Configure **git identity** for this clone (required for commits):

```bash
git config user.name "Your Name"
git config user.email "your-email@example.com"
```

Configure **push access** to GitHub from this machine (SSH deploy key or personal access token with `contents` write on the repo). Test with:

```bash
git fetch origin && git push origin main
```

Use a **dedicated clone** only for scheduled runs. The pipeline runs `git fetch` / `git reset --mixed origin/main` before staging dashboard paths so it stays aligned with remote `main`; do not mix manual feature work in that clone.

## 2. Manual run

```bash
cd ~/Shunyalabs-console-automation
bash scripts/run-automation-machine.sh
```

Or from the repo root:

```bash
npm run automation:run
```

Dry run without pushing:

```bash
AUTOMATION_SKIP_GIT_PUSH=true bash scripts/run-automation-machine.sh
```

## 3. Schedule with cron

Example: every day at 6:30 IST (server must use correct timezone or adjust crontab):

```cron
30 6 * * * cd /home/YOUR_USER/Shunyalabs-console-automation && /usr/bin/env bash scripts/run-automation-machine.sh >> /home/YOUR_USER/automation-cron.log 2>&1
```

Use `crontab -e` under your user. Replace paths and times as your lead requests.

## 4. Optional: systemd user timer

If you use systemd user sessions, you can add a service that runs the same command and enable a timer. Point `WorkingDirectory` at your clone and `ExecStart` at `/usr/bin/bash` with `scripts/run-automation-machine.sh` (use absolute paths).

## 5. Turning off GitHub Actions (team decision)

When the server is trusted to run exclusively:

- Disable or remove the scheduled / external triggers for `Run Tests & Update Dashboard` in GitHub, or leave **workflow_dispatch** only for emergencies.
- Stop any Google Apps Script triggers that call `repository_dispatch` for `run-tests`, if you replace them with cron on the server.

Apps Script **web app URLs** for Sheets and email can stay as-is; only the runner location changes.
