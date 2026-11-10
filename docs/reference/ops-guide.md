# Ops guide — self-hosting, security, troubleshooting

## Self-hosting

CyberAgent can run entirely on your infrastructure: a **server** (API + web + database) plus **daemons** on machines you control. `multica setup self-host` points a CLI at it.

- Quick start: [`SELF_HOSTING.md`](../../SELF_HOSTING.md)
- Advanced (TLS, DNS, upgrades, backups): [`SELF_HOSTING_ADVANCED.md`](../../SELF_HOSTING_ADVANCED.md)
- AI/provider configuration: [`SELF_HOSTING_AI.md`](../../SELF_HOSTING_AI.md)

Shape of a deployment:

1. **Server** — stateless app container(s) + Postgres + object storage for attachments; serves the web UI and the API the CLIs/daemons poll.
2. **Daemons** — on build servers or workstations (`multica daemon start`), pointed at the server; they bring the **runtimes** (coding CLIs) and provider credentials.
3. **Integrations** — GitHub App / VCS connection registered against your server's public URL; chat-platform bots likewise.

Agents, skills, projects and autopilots are workspace data — self-hosted workspaces work identically to cloud, and the same `multica` CLI drives both (`multica setup cloud` ↔ `multica setup self-host`).

## Security model

**Trust boundaries.**

- **Tokens.** Humans and agents authenticate with tokens (stored in the CLI profile; server-issued per integration). `multica auth logout` revokes locally; admins revoke server-side.
- **Agent env vars** are the secrets plane: scoped to one agent, audited on every set/get (`multica agent env`), injected only into that agent's task sessions.
- **Webhook autopilots** carry per-trigger credentials; `multica autopilot get` redacts them by default.
- **Runtimes execute code.** A runtime runs a real coding CLI on a real machine with repo access — treat daemon hosts as trusted build infrastructure. Task isolation is per-workspace directory; the daemon's GC keeps checkouts short-lived (`MULTICA_GC_REPO_TTL`).

**Data flow.** Task prompts, replies and diffs flow device → server → client apps. Provider calls are made **by the runtime**, with the agent's configured provider, not by the server — your code and prompts do not need to transit third parties you haven't configured.

**Audit surfaces.** `multica agent env get/set` (audited), `multica autopilot runs` (execution history), `multica agent tasks` (per-agent work log), runtime `usage`/`activity` (who consumed what, when).

**Hardening checklist.**

1. TLS in front of the server; tokens rotated; `multica auth logout` on offboarded machines.
2. Daemon hosts: dedicated users, minimal repo scope, concurrency caps, log rotation on.
3. Provider keys per agent (never shared); MCP servers reviewed before `agent mcp add`.
4. Autopilot webhooks: secret-bearing URLs treated as credentials; rotation via `trigger-update`.

## Auth tokens

Server-side, every integration (CLI users, daemons, bots, webhooks) holds a token minted in web settings. CLI-side, `multica login` stores one in your profile (`multica config show`). Env override: `MULTICA_TOKEN`. For CI, create a dedicated token with the narrowest workspace role and pass it explicitly.

## Troubleshooting

| Symptom | Check |
|---|---|
| `multica` can't reach the server | `multica auth status`; `MULTICA_SERVER_URL`; self-host TLS chain |
| Daemon shows offline | `multica daemon status`; `~/.multica/daemon.log`; heartbeat interval; system sleep |
| Task stuck "running" | `multica daemon logs`; `MULTICA_AGENT_TIMEOUT`; runtime CLI alive? (`multica runtime list`) |
| Agent never picks up work | Assignment actually saved? (`multica issue get <id>`); daemon polling; workspace match |
| Codex runtime slow to start | `MULTICA_CODEX_HANDSHAKE_TIMEOUT` / `_SEMANTIC_INACTIVITY_TIMEOUT` |
| Disk filling up | `multica daemon disk-usage`; tighten `MULTICA_GC_REPO_TTL`, set `MULTICA_GC_ARTIFACT_PATTERNS` |
| Too many parallel tasks | `MULTICA_DAEMON_MAX_CONCURRENT_TASKS` |
| Agent env "not found" at runtime | Set on the right agent (`multica agent env get <id>`); daemon restarted or auto-reload on |

**Diagnostics bundle:** `multica daemon status && multica daemon logs && multica runtime list && multica agent tasks <agent-id>` covers the vast majority of reports.

## Compatibility note (Multica → CyberAgent)

The product is rebranded CyberAgent. For compatibility, the CLI binary remains `multica`, environment variables keep the `MULTICA_` prefix, and Homebrew installs via `multica-ai/tap`. Scripts written against Multica keep working unchanged against CyberAgent.
