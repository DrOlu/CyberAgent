# Working on Issues — Behavioral Reference

This reference documents user-observable behaviors for issue and PR workflows.

## `multica issue pull-requests` — read PR links

`multica issue pull-requests <issue-id>` (alias `prs`) calls `GET /api/issues/<id>/pull-requests`
and prints each linked PR's `NUMBER STATE TITLE URL`. With `--output json` it prints
the raw `{"pull_requests": [...]}` array.

Each PR object contains:
- `provider`, `number`, `html_url`, `title`
- `state` — folded lifecycle string: `open`, `draft`, `merged`, or `closed`
  - "Is it merged?" → `state == "merged"` (or `merged_at != null`)
  - "Is it a draft?" → `state == "draft"`
- `merged_at`, `closed_at`
- `mergeable_state` — mirrors GitHub; UI surfaces `clean`/`dirty`; other values round-trip as unknown
- `mergeable` / `merge_state_status` — conflict-only verdict vs the complete merge gate; "ready" requires `merge_state_status == "clean"`
- `snapshot_available` — true only when the App snapshot feature is enabled and the snapshot head matches the current PR head
- `checks_rollup`, `checks_total`, `checks_passed`, `checks_failed`, `checks_running`, `failed_check_names`
- `checks_conclusion` — coarse `"passed"`/`"failed"`/`"pending"` or `null`

There is no standalone `draft` or `merged` boolean. Combine `state` with `checks_conclusion` for CI status.

## PR auto-link — two distinct paths

### Path 1 — link (title OR body OR branch)

Any `PREFIX-NUMBER` pattern (e.g. `MUL-123`) found in a PR's **title, body, or branch name** resolves
to an issue in the workspace and creates a link row. This is what `multica issue pull-requests` reads back.

A link created only by a bare body mention (not title, branch, or a closing keyword) is stored as
`reference_only`. Reference-only links are hidden from the CLI PR list and excluded from the
auto-advance gate — an invisible body mention must not silently block an issue from reaching `done`.

### Path 2 — close intent (title OR body only, keyword-adjacent)

A `PREFIX-NUMBER` immediately after a closing keyword (`Closes`/`Fixes`/`Resolves`, optional `:` then
whitespace) sets the `close_intent` flag on the link row. This is the gate that auto-advances the issue
to `done` on PR merge.

- `Fix MUL-1` → close intent ✓
- `Fix login MUL-1` → no close intent (not adjacent)
- Branch name `mul-1/fix-login` → link only, never close intent (branch names are intentionally excluded)

Net: a bare title prefix (`MUL-2759: …`) or a branch ref links only (shown in the PR list);
`Closes MUL-2759` links **and** records close intent; a bare body mention with no title/branch ref
and no closing keyword links as `reference_only` and is hidden from the PR list.

## Status side effects and enqueue contracts

- An agent-assigned issue created with a non-backlog status triggers the agent immediately.
- `--status backlog` parks the issue with the assignee set but no trigger.
- Promoting `backlog → todo` (or any non-backlog status) later fires the agent at that point.
- Moving an issue to `cancelled` does **not** cancel in-flight tasks — only issue deletion does.
- Task failure may roll `in_progress → todo` when no active task remains on the issue.
- Custom statuses inherit their category's enqueue/park behavior in full.
- The runtime brief lists the workspace's active custom statuses grouped by category.
- Literal-key exceptions: failed-task rollback always writes the `todo` key; a merged close-intent PR always writes the `done` key.

### Agent status writes (runtime brief contract)

The agent writes issue status whenever the work changes it, mid-turn included:
- Starting the issue's own ask → `in_progress` immediately
- Delivering → `in_review`
- Continuing → `in_progress`
- Blocked → `blocked`
- A turn producing none of the issue's own deliverable → no write at any point
- Activity kind (research/design/planning/review) counts as work when it is the ask
- Squad leader dispatch is not delivery and does not trigger a status write

## `--no-start` — ownership without dispatch

`multica issue assign --no-start`, `multica issue update --no-start`, and
`multica issue status --no-start` set the assignee without triggering a run.

The self-assignment guard suppresses dispatch only when the exact `(issue, agent)` pair
already has a non-terminal task. It does not treat "this agent is busy on another issue"
as a reason to suppress a fresh cross-issue handoff.

## `multica issue runs` — active and sibling runs

- `--active` returns only in-flight runs for this issue.
- `--siblings` returns in-flight runs on the parent issue plus all of its children (the "family").
  The family result is capped; if truncated the CLI prints a warning on stderr.
- Both paths skip usage hydration (which spans the full task history).

## Sub-issue stages (barrier wake)

Issues carry an optional `stage` number (>= 1). The barrier logic:

1. When a child issue reaches a terminal status, the server checks whether all children in the
   same stage are now terminal.
2. If yes (barrier closed), the server wakes the parent's assignee with a comment summarizing
   the closed stage and listing the next stage's issues.
3. Advancement is agent-driven: promoting next-stage `backlog` issues to `todo` is the woken
   agent's decision, not a server side effect.
4. When the woken assignee decides the parent is complete, the comment asks for
   `multica issue status <parent-id> in_review`.

`multica issue children <id>` lists sub-issues grouped by stage.
`multica issue create --stage N` / `multica issue update --stage N` set the stage.

## Metadata

`multica issue metadata set <issue-id> --key K --value V [--type string|number|bool]`
sets a metadata entry. `--value` is JSON-parsed by default (bool/number sniff); `--type` forces
the type.

`multica issue metadata delete <issue-id> --key K` removes the entry.

## Custom properties

`multica property list/get/create/update/archive/unarchive` manages property definitions.
`multica issue property list/set/unset` manages per-issue property values (supports name→id resolution).

`multica issue list --property "Name=Value"` filters by property:
- Multiple `--property` flags combine with AND across definitions and OR within a definition.
- Use `__none__` as the sentinel for "property is unset".

`multica issue list --sort property:<name-or-id>` sorts by a property (archived and orderless types are rejected).
Select-type properties sort by option order; ordinal scales sort by meaning.

Only workspace admins can create/update/archive property definitions. Agents cannot modify definitions.

Actor-type properties (`actor`, `multi_actor`) accept workspace member references only,
with a cap of 20 values per multi-actor property.
