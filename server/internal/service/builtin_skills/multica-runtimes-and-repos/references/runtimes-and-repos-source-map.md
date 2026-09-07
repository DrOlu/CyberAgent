# Runtimes and Repos — Behavioral Reference

## Runtime commands

`multica runtime list` returns each runtime's `id`, `name`, `runtime_mode`, `provider`, `status`, and `last_seen_at`.

`multica runtime update` initiates a runtime update via `POST /api/runtimes/{runtime-id}/update`.
With `--wait`, it polls for completion. Only the runtime owner or a workspace owner/admin can initiate an update;
a user who initiated the poll keeps access to the status endpoint even if their admin role changes mid-flight.

`multica runtime delete` removes a runtime via `DELETE /api/runtimes/{runtime-id}`.
With `--cascade`, it first reads the list of active agents bound to that runtime and
posts them to an unbind-and-delete endpoint before deleting the runtime.
The teardown sequence: user agents are unbound (their `runtime_id` is cleared),
task history is detached so the deletion cannot cascade away past work,
active tasks are cancelled for user-confirmed deletion, and only system agents are hard-deleted.
Older installed clients that call the legacy archive-and-delete endpoint are routed to the same handler.

## Repo checkout

`multica repo checkout <url> [--ref]` checks out a repository inside the current task.
It requires `MULTICA_DAEMON_PORT` and the task-scoped `MULTICA_TOKEN`.
The checkout is authenticated against the running task: the daemon verifies the workspace, task, and
workdir all belong to the active task, and derives the agent name from its own registry
rather than from the request payload.

Checkout ref resolution order:
1. `--ref` flag from the request
2. The project's pinned default ref (from a `github_repo` project resource)
3. Repository default branch

### Isolated checkout mode

Linux and Windows Codex tasks use an isolated checkout mode (`MULTICA_REPO_CHECKOUT_MODE=isolated`).
Isolated mode creates a local clone with task-local Git metadata, using the real repository as `origin`.
On Windows this clone uses `--no-hardlinks` so each task's checkout objects are independent.
Other runtimes use a linked-worktree layout instead.

If the bare cache is a partial clone, the isolated checkout restores `remote.origin.promisor` /
`partialclonefilter` before the first checkout, otherwise `git clone --local` would succeed
with an empty working tree.

## Daemon environment

`MULTICA_TASK_CONFIG_ROOT` is exported by the daemon and pins the task's private config directory.
The CLI resolves profiles under this root when the variable is present, leaving `HOME`-based resolution
unchanged for non-task use.

Each task gets a private `multica-config` directory (mode `0700`). The daemon does not copy the
owner's profile into it — every task starts with a clean config slate.

Task commands enforce the task boundary: API calls require task authentication; `MULTICA_DAEMON_PORT`
alone is not sufficient to reject human/local commands because some host environments leave it in
the startup environment.

## Daemon APIs

The daemon registers workspace repos and task claim under `/api/daemon`.
It validates the task-scoped credential, launches provider CLIs, and reports completion.
`MULTICA_TASK_CONFIG_ROOT` is kept ahead of custom environment assembly so agents cannot override it.

Daemon diagnostics (`daemonStatusHealthPort`, disk usage) use the injected `MULTICA_DAEMON_PORT`
under strong task identity rather than the profile-derived port.
