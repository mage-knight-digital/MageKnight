---
name: work
description: "Start working on a GitHub issue. Use when user says 'work on #123', 'start issue 42', or 'pick up the next task'."
user-invocable: true
argument-hint: "[#issue-number or 'next']"
---

# Start Working on Issue

Begin working on a GitHub issue, tracking progress in the project board.

## Workflow

### 1. Identify the Issue

**If issue number provided** (e.g., `/work #42` or `/work 42`):
```bash
gh issue view $ARGUMENTS --json number,title,body,labels,state
```

**If no number provided** (`/work` or `/work next`):
```bash
# Get highest priority issue from project
gh issue list --label "P0-critical" --state open --limit 1
# If none, try P1-high
gh issue list --label "P1-high" --state open --limit 1
```

### 2. Move to In Progress

Update the project board status:
```bash
# Get project item ID and move to In Progress
gh project item-list 1 --owner eshaffer321 --format json | jq '.items[] | select(.content.number == ISSUE_NUM)'
```

### 3. Add Comment

```bash
gh issue comment ISSUE_NUM --body "Starting work on this issue."
```

### 4. Gather Context

- Read the issue body thoroughly
- If issue references a markdown spec in `docs/tickets/`, read that file
- Identify affected files from the issue description
- Read relevant source files to understand current implementation

### 5. Create Implementation Plan

Use the TodoWrite tool to create a task list based on the issue's acceptance criteria.

### 6. Begin Implementation

Start working through the task list, implementing the changes.

## Status Tracking

Throughout implementation:
- Update todos as you complete tasks
- If you discover blockers, comment on the issue
- Keep the user informed of progress

## Example

User: `/work #32`

Response:
1. Fetch issue #32 details
2. "Starting work on #32: Mandatory Card Play/Discard Per Turn"
3. Read linked spec if exists
4. Create todo list from acceptance criteria
5. Begin implementation

User: `/work`

Response:
1. "Looking for highest priority issue..."
2. "Found #33 (P1-high): Resting as State with Card Play Allowed"
3. "Starting work on #33..."
