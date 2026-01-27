---
name: ticket
description: "Create a new GitHub issue from investigation or description. Use when user says 'create a ticket', 'investigate and file an issue', or describes a bug/feature to track."
user-invocable: true
argument-hint: "[description or topic to investigate]"
---

# Create GitHub Issue

Create a new GitHub issue for the MageKnight project based on the user's description or investigation.

## Workflow

1. **If given a topic to investigate**: Research the codebase first to understand the current state, affected files, and scope. Then write up a comprehensive issue.

2. **If given a direct description**: Create the issue directly from the description.

## Issue Creation

Use `gh issue create` with these parameters:

```bash
gh issue create \
  --title "Clear, concise title" \
  --body "Issue body with problem statement, current behavior, expected behavior" \
  --label "LABELS" \
  --project "MageKnight Development"
```

## Labels to Apply

**Priority** (required - choose one):
- `P0-critical` - Blocks gameplay
- `P1-high` - Important for core experience
- `P2-medium` - Should do (default)
- `P3-low` - Nice to have

**Type** (required - choose one):
- `bug` - Something broken
- `feature` - New functionality
- `edge-case` - Rulebook edge case not handled
- `tech-debt` - Refactoring, code quality
- `docs` - Documentation only

**Area** (choose all that apply):
- `area:combat`, `area:cards`, `area:mana`, `area:turn`, `area:rest`
- `area:movement`, `area:units`, `area:sites`, `area:ui`

**Complexity** (if known):
- `complexity:low` - Quick fix
- `complexity:high` - Significant work

## Issue Body Template

```markdown
## Summary
Brief description of the issue.

## Problem Statement
What's wrong or what's needed.

## Current Behavior
How it works now (if applicable).

## Expected Behavior
How it should work.

## Affected Files
- List key files involved

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

## After Creation

1. Report the issue URL to the user
2. If this is a complex issue, ask if they want a detailed markdown spec created in `docs/tickets/`

## Example

User: "Create a ticket for the bug where wounds don't get shuffled into the deck properly"

Response:
1. Investigate wound handling in the codebase
2. Create issue with findings
3. Apply labels: `bug`, `P1-high`, `area:cards`
4. Return: "Created issue #XX: Wounds not shuffled into deck properly"
