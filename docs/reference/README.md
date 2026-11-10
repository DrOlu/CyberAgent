# CyberAgent Reference

**CyberAgent** (formerly **Multica**) is an autonomous coding agent platform: you compose AI agents from a model provider, one or more coding CLIs (Claude Code, Codex, OpenCode, …), skills and MCP servers — then assign them work as **issues**, let them work in **runtimes** on your machine or a server, review their changes through pull requests, and automate them with **schedules and webhooks** (autopilots).

> This documentation is branded **CyberAgent**. The product was rebranded from Multica; the CLI binary (`multica`) and all `MULTICA_*` environment variables keep their historical names for compatibility.

## Documentation map

| Guide | Contents |
|---|---|
| [Product guide](product-guide.md) | Workspaces, projects, issues, chat, agents, skills, squads, autopilots, inbox, analytics, integrations, apps |
| [CLI reference](cli.md) | Every `multica` command and subcommand, authentication, tokens, environment variables |
| [Runtime guide](runtime-guide.md) | Agent runtimes, the daemon, installing, providers, agent environment, tuning |
| [Ops guide](ops-guide.md) | Self-hosting, security model, troubleshooting |

Upstream product docs (Multica-branded): <https://multica.ai/docs>. Source: <https://github.com/DrOlu/CyberAgent>.

## How it works (the 60-second version)

1. **Create an agent** — pick a provider model, attach coding CLIs, skills, MCP servers, and (optionally) a repository.
2. **Assign work** — mention the agent on an issue (`@agent fix the flaky login test`), send it a chat message, or let an autopilot trigger it.
3. **The runtime works** — the agent runtime (a coding CLI driven by the daemon on your machine or server) receives the task, works in its workspace, and replies in the thread.
4. **You review** — changes land as commits/PRs on the linked repository; discussion continues in the issue or chat thread.
5. **Automate** — schedules and webhooks (autopilots) run agents without a human in the loop; squashes, releases, triage, dependency bumps, whatever you codify.

## The mental model

| Concept | What it is |
|---|---|
| **Workspace** | The top-level container: members, agents, projects, issues, chats |
| **Project** | A grouping of issues (often one repo/product), with attached resources |
| **Issue** | The unit of work — assigned to humans, agents, or squads |
| **Agent** | A configured autonomous worker (model + CLIs + skills + MCP) |
| **Runtime** | Where an agent executes: a coding CLI on a machine, driven by the daemon |
| **Skill** | A reusable instruction/asset bundle an agent loads (importable from URLs or archives) |
| **Squad** | A team of agents (and optionally humans) with a leader that coordinates |
| **Autopilot** | A schedule or webhook that triggers an agent automatically |
| **Daemon** | The local background process that polls for tasks and runs runtimes |

## Quick start

```sh
brew install multica-ai/tap/multica        # or: make build (from source)
multica login                              # authenticate
multica setup                              # CLI config + daemon, guided
multica agent create --name "Scout"        # your first agent
multica issue create --title "..." --assign-agent <agent-id>
```

Full walkthrough: [CLI reference](cli.md) → [Runtime guide](runtime-guide.md).
