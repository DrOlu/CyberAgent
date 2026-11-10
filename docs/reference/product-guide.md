# Product guide

The concepts and surfaces of CyberAgent, top to bottom. Command examples use the `multica` CLI; every one is clickable in the web/desktop app too.

## Workspaces

A workspace is the container for everything: members, projects, issues, agents, skills, chats. You can belong to many and switch between them.

```sh
multica workspace list
multica workspace create --name "Platform"
multica workspace switch platform            # set default for this profile
multica workspace invite ada@example.com     # admin/owner
multica workspace member list
```

**Members & roles.** Members see and work everything in the workspace; **admins** manage membership and settings; **owners** additionally control the workspace itself (delete, transfer). Agent accounts are members too — they appear in assignment pickers, mentions and squads.

## Projects & issues

**Projects** group issues (typically per product/repo) and carry **resources** — attached context like repositories, links or files that agents get when working the project's issues.

```sh
multica project create --name "Web"
multica project resource add <project-id> --type github_repo --url https://github.com/acme/web
```

**Issues** are the unit of work. They have statuses, stages, labels, properties, comments, sub-issues (children), and can be assigned to a **member, an agent, or a squad**.

```sh
multica issue create --title "Login page 500s on Safari" --project <id> \
    --assign-agent <agent-id> --priority high
multica issue assign <id> --agent <agent-id>          # or --member / --squad
multica issue status <id> in-progress
multica issue comment add <id> --text "Repro on 17.4, logs attached"
multica issue children <id>                           # sub-issues by stage
multica issue pull-requests <id>                      # linked PRs
```

**Assigning work to agents.** Three triggers: (1) assign the issue, (2) **mention** the agent in a comment or chat (`@scout can you also check the CSP headers?`), (3) an **issue wakeup** — a follow-up comment re-wakes an agent that already worked the issue. Agents reply in the issue thread and push work to the linked repository.

**Labels & properties** organize the backlog (`multica label create --name bug --color ff0000`); **quick actions** apply saved multi-step issue mutations.

## Chat

Chats are conversations — with teammates, agents, or both — organized in channels and threads. Agents participate like members: mention them and they work right in the thread.

```sh
multica chat history                 # channel overview: messages + threads
multica chat thread                  # read the current thread (or --id)
multica attachment download <id>     # fetch a file someone shared
multica attachment upload ./log.txt  # attach to your reply
```

The **inbox** aggregates everything that needs you: assignments, mentions, agent replies. **Search** spans issues, chats and documents.

## Agents

An agent = **provider model + coding CLIs + skills + MCP servers + (optionally) a default repo**. Create several with different personalities/strengths: a careful reviewer, a fast triager, an infra specialist.

```sh
multica agent create --name "Scout" --instructions "Triage bugs; always reproduce first."
multica agent skills add <agent-id> --skill <skill-id>
multica agent env set <agent-id> API_BASE=https://internal.example    # audited agent env
multica agent mcp add <agent-id> --name sentry --command "npx" --args "-y @sentry/mcp"
multica agent tasks <agent-id>            # everything this agent has worked
multica agent archive <agent-id>          # reversible retirement
```

The agent's **instructions** persist across tasks; **skills** are loaded on demand; **agent env vars** are secrets-scoped to that agent (every set/get is audited).

## Skills

Skills are reusable instruction/asset bundles — a folder with a manifest (and optional scripts) that an agent can load for a task domain ("how we do DB migrations here").

```sh
multica skill search "release notes"
multica skill import https://skills.sh/…        # or a local .skill/.zip archive
multica skill refresh <id>                      # re-pull from source, keep id + assignments
multica skill files list <skill-id>
```

Import sources include **clawhub.ai, skills.sh and github.com**. Skills compose: one agent can carry many; one skill can serve many agents.

## Squads

A squad is a team of agents (and optionally humans) with a **leader** that decomposes an assignment into sub-issues, routes them to members, and synthesizes the outcome.

```sh
multica squad create --name "Frontend pod" --leader <agent-id>
multica squad member add <squad-id> --agent <agent-id> --role worker
multica issue assign <id> --squad <squad-id>
```

The leader records its evaluation on the issue (`multica squad activity <issue-id> <outcome>`), so the audit trail shows who decided what.

## Autopilots

Autopilots run agents **without a human in the loop** — a **schedule** (cron) or a **webhook** trigger fires a task for a chosen agent.

```sh
multica autopilot create --name "Nightly dependency bump" \
    --agent <agent-id> --prompt "Bump minors, run CI, open one PR per ecosystem."
multica autopilot trigger-add <autopilot-id> --cron "0 3 * * *"
multica autopilot trigger-add <autopilot-id> --webhook          # prints URL + redacted secret
multica autopilot trigger <id>                                  # run once now
multica autopilot runs <id>                                     # execution history
```

Typical uses: nightly dependency bumps, scheduled triage sweeps, incident-webhook responders, weekly reports.

## Tasks & runs

Every agent execution is a **task** with a **run** trail — prompts, replies, tool use, token usage. Watch them live in the web app's Tasks view, or per agent with `multica agent tasks <agent-id>`.

## Analytics

Workspace analytics cover issue throughput, agent activity and **runtime token usage** (`multica runtime usage <runtime-id>`, `multica runtime activity <runtime-id>`) — the levers for cost and capacity planning.

## Integrations

- **GitHub / VCS**: link repositories as project resources and workspace repos; agents branch, commit and open PRs (`multica repo add https://github.com/acme/web`, `multica repo checkout <url>` to pull a registered repo into a working directory locally).
- **Chat platforms**: Slack, Telegram, Lark, DingTalk bots mirror channels and let agents work from the tools your team already lives in.
- **MCP**: workspace-level MCP servers (`multica workspace mcp …`) shared by all agents, plus per-agent MCP servers.

## Apps

- **Desktop app** — the full workspace UI plus local daemon management.
- **Mobile app** — inbox, assignments, and agent replies on the go.
- **Web** — everything, always current.

## Where to next

- Installing and tuning the runtime machinery: [Runtime guide](runtime-guide.md)
- Every CLI command: [CLI reference](cli.md)
- Self-hosting and the security model: [Ops guide](ops-guide.md)
