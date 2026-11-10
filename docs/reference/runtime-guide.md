# Runtime guide — daemon, runtimes, providers

The runtime machinery is what turns a configured agent into working code: the **daemon** on your machine (or server) polls the workspace for tasks, and **runtimes** (coding CLIs) execute them in isolated workspaces.

## The daemon

One background process per machine. It registers the machine as an agent runtime, polls for assigned tasks, spawns the right coding CLI per task, streams progress back, and reports heartbeats.

```sh
multica daemon start          # also run by `multica setup` and the Desktop app
multica daemon status
multica daemon logs           # or: tail -f ~/.multica/daemon.log
multica daemon restart
multica daemon stop
multica daemon disk-usage     # workspace disk by task / workspace
multica daemon probe-runtimes # detect locally installed CLIs (Desktop helper)
```

Install:

```sh
brew install multica-ai/tap/multica     # CLI + daemon management
# from source:
git clone https://github.com/DrOlu/CyberAgent && cd CyberAgent
make build                              # binary at server/bin/multica
server/bin/multica daemon start
```

Behaviour highlights:

- **Auto-update** keeps the daemon current (`MULTICA_DAEMON_AUTO_UPDATE`, interval via `MULTICA_DAEMON_AUTO_UPDATE_INTERVAL`).
- **Auto-reload** picks up runtime configuration changes without restarts (`MULTICA_DAEMON_AUTO_RELOAD`).
- **Concurrency** is capped (`MULTICA_DAEMON_MAX_CONCURRENT_TASKS`) so one machine can serve several agents without thrashing.
- **Log rotation** via `MULTICA_DAEMON_LOG_MAX_SIZE_MB` / `_MAX_BACKUPS` / `_MAX_AGE_DAYS`.

## Runtimes

A **runtime** is a coding CLI the daemon can drive — Claude Code, Codex, OpenCode, and others — registered in the workspace when the daemon connects. Tasks name a runtime (or use the agent's default); the daemon routes accordingly.

```sh
multica runtime list                      # what's registered
multica runtime usage <runtime-id>        # token usage for cost/forecast
multica runtime activity <runtime-id>     # hourly task activity
multica runtime update <runtime-id>       # ask the runtime's CLI to update itself
multica runtime rename <runtime-id> "Build box"
multica runtime delete <runtime-id>       # unregister
```

**Workspace layout.** Each task gets its own working directory under the daemon's workspaces root (`MULTICA_WORKSPACES_ROOT`); repos are checked out according to `MULTICA_REPO_CHECKOUT_MODE`. Garbage collection is policy-driven: `MULTICA_GC_REPO_TTL` (age out old checkouts) and `MULTICA_GC_ARTIFACT_PATTERNS` (clean build artifacts). `multica daemon disk-usage` shows what's consuming space.

## Providers

Agents are **provider-agnostic**: pick a model provider (e.g. Anthropic, OpenAI, Google, or any OpenAI-compatible endpoint) when configuring the agent; the runtime drives the chosen coding CLI with that provider's credentials. Provider keys are managed per agent/server in settings, never in the repo. Changing an agent's provider model is a settings edit — no reinstallation.

**Agent environment.** Give an agent its own env vars (API endpoints, feature flags) — scoped to that agent, audited on every read/write:

```sh
multica agent env set <agent-id> DEPLOY_ENV=staging
multica agent env get <agent-id>
```

During a task the session also receives the **context vars** (`MULTICA_AGENT_ID`, `MULTICA_AGENT_NAME`, `MULTICA_AGENT_RUNTIME_NAME`, `MULTICA_TASK_ID`, `MULTICA_WORKSPACE_ID`, `MULTICA_AGENT_TIMEOUT`) so tools and scripts can self-identify and respect the task budget.

## Environment variables

Defaults are sane; most installs never touch these.

| Variable | Purpose |
|---|---|
| `MULTICA_SERVER_URL` | Server the CLI/daemon talks to |
| `MULTICA_APP_URL` | Web app base URL (deep links) |
| `MULTICA_TOKEN` | Auth token override |
| `MULTICA_HTTP_TIMEOUT` | HTTP client timeout |
| `MULTICA_DAEMON_PORT` | Local daemon port |
| `MULTICA_DAEMON_POLL_INTERVAL` | Task poll frequency |
| `MULTICA_DAEMON_HEARTBEAT_INTERVAL` | Liveness heartbeat |
| `MULTICA_DAEMON_MAX_CONCURRENT_TASKS` | Parallel task cap |
| `MULTICA_DAEMON_AUTO_RELOAD` | Reload runtime config without restart |
| `MULTICA_DAEMON_AUTO_UPDATE` / `_INTERVAL` | Daemon self-update |
| `MULTICA_DAEMON_DEVICE_NAME` / `_ID` | Machine identity |
| `MULTICA_DAEMON_LOG_MAX_SIZE_MB` / `_MAX_BACKUPS` / `_MAX_AGE_DAYS` | Log rotation |
| `MULTICA_WORKSPACES_ROOT` | Where task workspaces live |
| `MULTICA_TASK_CONFIG_ROOT` | Per-task config storage |
| `MULTICA_REPO_CHECKOUT_MODE` | How repos are checked out |
| `MULTICA_GC_REPO_TTL` / `MULTICA_GC_ARTIFACT_PATTERNS` | Disk GC policy |
| `MULTICA_AGENT_*` / `MULTICA_TASK_ID` / `MULTICA_WORKSPACE_ID` | Injected task context |
| `MULTICA_CODEX_HANDSHAKE_TIMEOUT` / `_SEMANTIC_INACTIVITY_TIMEOUT` | Codex runtime tuning |
| `MULTICA_DEBUG` | Verbose diagnostics |

## Recipes

**Headless build box (Linux server):**

```sh
server/bin/multica setup self-host && server/bin/multica daemon start
systemd unit → ExecStart=/opt/cyberagent/multica daemon start
```

**Laptop (sleep-safe):** the daemon polls and heartbeats; on wake it resumes. Cap concurrency at 1–2 for thermal sanity:

```sh
MULTICA_DAEMON_MAX_CONCURRENT_TASKS=2 multica daemon start
```

**Verify a runtime end-to-end:**

```sh
multica daemon status && multica runtime list
multica issue create --title "Smoke test" --assign-agent <agent-id> \
  && multica agent tasks <agent-id>
```
