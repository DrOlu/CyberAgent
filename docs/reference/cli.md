# CLI reference — `multica`

The CyberAgent CLI (binary name `multica`, a Go/Cobra program) drives the whole product from scripts, CI and terminals. Install with `brew install multica-ai/tap/multica`, or build from source (`make build`; binary lands in `server/bin/multica`).

```
multica [command]
```

**Global flags:** `--help`, `--version`, and the standard `--json` output mode on list/get commands. Most commands operate on your **default workspace** (`multica workspace switch`); nearly all accept an explicit workspace argument where it matters.

## Command map

| Command | Purpose |
|---|---|
| `login` / `auth` / `setup` | Authentication & first-run configuration |
| `workspace` | Workspaces, members, invitations, MCP |
| `project` | Projects and their resources |
| `issue` / `label` / `property` | The work-tracking surface |
| `agent` | Agents: create, configure, skills, env, MCP |
| `skill` | Skill library: search, import, refresh, files |
| `squad` | Squads and their members |
| `autopilot` | Scheduled/webhook automations |
| `chat` / `attachment` | Conversations and files |
| `daemon` / `runtime` | The execution machinery |
| `repo` | Workspace repository registry |
| `user` | Your profile |
| `config` / `update` / `version` | CLI housekeeping |

---

## Authentication & setup

```sh
multica login                 # browser-based auth; stores a token locally
multica auth status           # show who you are + current server
multica auth logout           # remove the stored token
multica setup                 # guided: CLI config + auth + daemon start
multica setup cloud           # point the CLI at CyberAgent Cloud (multica.ai)
multica setup self-host       # point the CLI at your own server
```

Tokens live in the CLI profile (`multica config show`); servers get **auth tokens** per integration from the web settings — see [Ops guide § tokens](ops-guide.md#auth-tokens).

## workspace

```sh
multica workspace list
multica workspace create --name "Platform"
multica workspace get [id|slug|prefix]
multica workspace switch platform
multica workspace update [id] --name "Platform Team"      # admin/owner
multica workspace invite ada@example.com [id]
multica workspace member list [id]
multica workspace mcp list|add|remove …                   # workspace-level MCP servers
```

## project

```sh
multica project list
multica project get <id>
multica project create --name "Web" --status active
multica project update <id> --name …
multica project delete <id>
multica project status <id> paused
multica project resource list <project-id>
multica project resource add <project-id> --type github_repo --url <url>
multica project resource update <project-id> <resource-id> --label …
multica project resource remove <project-id> <resource-id>
```

## issue

```sh
multica issue list --status open --assignee <agent-id>
multica issue get <id>
multica issue pull-requests <id>            # PRs linked to the issue
multica issue children <id>                 # sub-issues grouped by stage
multica issue create --title "…" --project <id> [--assign-agent <id>] [--labels …]
multica issue update <id> --title … --description … --priority …
multica issue assign <id> --member|--agent|--squad <id>
multica issue status <id> <status>          # e.g. backlog | in-progress | done
multica issue reorder <id> --before|--after <id>   # move within the status column
multica issue comment list <issue-id>
multica issue comment add <issue-id> --text "…"     # mentioning an agent wakes it
```

## label & property

```sh
multica label list|get <id>|create --name … --color …|update <id>|delete <id>
multica property …                          # custom typed fields on issues
```

## agent

```sh
multica agent list
multica agent get <id>
multica agent create --name "Scout" [--instructions …] [--runtime …] [--default-repo …]
multica agent update <id> --instructions "…"
multica agent archive <id> | multica agent restore <id>
multica agent tasks <id>                    # task history for this agent
multica agent avatar <id> --file …
multica agent skills list <id> | set | add --skill <skill-id>
multica agent env get <id>                  # audited agent-scoped env
multica agent env set <id> KEY=value
multica agent copy <src-id> --name "Scout 2"     # clone an agent
multica agent mcp list <id> | add --name … --command … [--args …]
```

## skill

```sh
multica skill list
multica skill get <id>                      # includes files
multica skill search <query>                # search installable skills
multica skill import <url-or-path>          # clawhub.ai, skills.sh, github.com, .skill/.zip
multica skill refresh <id>                  # re-download, preserve id + assignments
multica skill create|update|delete
multica skill files list <skill-id>
```

## squad

```sh
multica squad list
multica squad get <squad-id>
multica squad create --name "Frontend pod" [--leader <agent-id>]
multica squad update <squad-id> | delete <squad-id>       # delete archives
multica squad member list <squad-id>
multica squad member add <squad-id> --agent <id> [--role worker]
multica squad member set-role <squad-id> <member-id> <role>
multica squad member remove <squad-id> <member-id>
multica squad activity <issue-id> <outcome>   # record a leader evaluation
```

## autopilot

```sh
multica autopilot list
multica autopilot get <id>                  # webhook credentials redacted by default
multica autopilot create --name … --agent <id> --prompt …
multica autopilot update <id> | delete <id>
multica autopilot trigger <id>              # run once, now
multica autopilot runs <id>                 # execution history
multica autopilot trigger-add <autopilot-id> --cron "0 3 * * *" | --webhook
multica autopilot trigger-update <autopilot-id> <trigger-id> …
multica autopilot trigger-remove <autopilot-id> <trigger-id>
```

## chat & attachment

```sh
multica chat history                        # current channel: messages + thread list
multica chat thread [id]                    # read one thread
multica attachment download <attachment-id>
multica attachment upload <path>            # attach to your chat reply
```

## daemon

```sh
multica daemon start|stop|restart|status
multica daemon logs                         # tail ~/.multica/daemon.log
multica daemon disk-usage                   # workspace disk by task or workspace
multica daemon probe-runtimes               # detect local runtimes (Desktop helper)
```

Details, auto-update and tuning: [Runtime guide](runtime-guide.md).

## runtime

```sh
multica runtime list                        # runtimes registered in the workspace
multica runtime usage <runtime-id>          # token usage
multica runtime activity <runtime-id>       # hourly task activity
multica runtime update <runtime-id>         # trigger a CLI update on the runtime
multica runtime rename <runtime-id> <name>
multica runtime delete <runtime-id>
```

## repo

```sh
multica repo list
multica repo add https://github.com/acme/web …
multica repo remove <url> …
multica repo checkout <url>                 # clone into the working directory
```

## user, config, version

```sh
multica user get | user update --description "…"
multica config show
multica config set <key> <value>
multica update                              # self-update the CLI
multica version
```

## Environment variables

All prefixed `MULTICA_` (retained from CyberAgent for compatibility):

**Server & auth** — `MULTICA_SERVER_URL`, `MULTICA_APP_URL`, `MULTICA_TOKEN`, `MULTICA_HTTP_TIMEOUT`.

**Agent context (injected into agent sessions)** — `MULTICA_AGENT_ID`, `MULTICA_AGENT_NAME`, `MULTICA_AGENT_RUNTIME_NAME`, `MULTICA_AGENT_TIMEOUT`, `MULTICA_TASK_ID`, `MULTICA_WORKSPACE_ID`.

**Daemon** — `MULTICA_DAEMON_PORT`, `MULTICA_DAEMON_POLL_INTERVAL`, `MULTICA_DAEMON_HEARTBEAT_INTERVAL`, `MULTICA_DAEMON_MAX_CONCURRENT_TASKS`, `MULTICA_DAEMON_AUTO_RELOAD`, `MULTICA_DAEMON_AUTO_UPDATE`, `MULTICA_DAEMON_AUTO_UPDATE_INTERVAL`, `MULTICA_DAEMON_DEVICE_NAME`, `MULTICA_DAEMON_ID`, `MULTICA_DAEMON_LOG_MAX_SIZE_MB`, `MULTICA_DAEMON_LOG_MAX_BACKUPS`, `MULTICA_DAEMON_LOG_MAX_AGE_DAYS`, `MULTICA_WORKSPACES_ROOT`, `MULTICA_TASK_CONFIG_ROOT`, `MULTICA_REPO_CHECKOUT_MODE`.

**Internals/CI** — `MULTICA_DEBUG`, `MULTICA_LAUNCHED_BY`, `MULTICA_GC_ARTIFACT_PATTERNS`, `MULTICA_GC_REPO_TTL`, `MULTICA_QUICK_CREATE_TASK_ID`, `MULTICA_QUICK_CREATE_ATTACHMENT_IDS`, plus runtime handshake timeouts (`MULTICA_CODEX_HANDSHAKE_TIMEOUT`, `MULTICA_CODEX_SEMANTIC_INACTIVITY_TIMEOUT`) and test-only overrides (`MULTICA_TEST_*`, `MULTICA_DUR_OVERRIDE`, …).

Full table with defaults: [Runtime guide](runtime-guide.md#environment-variables).
