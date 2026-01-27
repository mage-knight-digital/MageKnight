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

Update the project board status to prevent other agents from grabbing the same issue:

```bash
# Get the item ID for this issue (use --limit 100 to get all items)
ITEM_ID=$(gh project item-list 1 --owner eshaffer321 --format json --limit 100 | jq -r '.items[] | select(.content.number == ISSUE_NUM) | .id')

# Move to "In Progress" status
# Project ID: PVT_kwHOAYaRMc4BNjzC
# Status field ID: PVTSSF_lAHOAYaRMc4BNjzCzg8hL6U
# "In Progress" option ID: 47fc9ee4
gh project item-edit --project-id "PVT_kwHOAYaRMc4BNjzC" --id "$ITEM_ID" --field-id "PVTSSF_lAHOAYaRMc4BNjzCzg8hL6U" --single-select-option-id "47fc9ee4"
```

Replace `ISSUE_NUM` with the actual issue number.

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

## Summary Output

After gathering context and creating the implementation plan, provide a **Validation Steps** section that tells the user exactly how to verify the work once complete:

```markdown
## Validation Steps

To verify this feature works correctly:
1. [Step-by-step user journey to test the feature]
2. [Expected behavior at each step]
3. [Edge cases to check]
```

For example, if the issue is about mandatory card play:
- "Start a new game and begin your turn"
- "Attempt to end turn without playing a card - should see error"
- "Play one card, then end turn - should succeed"
- "Test with sideways play as well"

This helps the user know exactly what to test when implementation is complete.
