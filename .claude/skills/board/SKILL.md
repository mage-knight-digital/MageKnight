---
name: board
description: "View GitHub project board status. Shows issues by status (In Progress, Up Next, Backlog) with priority labels. Use when user asks 'what's the status', 'show me the board', or 'what's in progress'."
user-invocable: true
---

# View Project Board Status

Display the current state of the MageKnight Development project board.

## Workflow

### 1. Fetch Project Data

```bash
# List all items in the project
gh project item-list 1 --owner eshaffer321 --format json
```

### 2. Fetch Open Issues with Labels

```bash
# Get all open issues with their labels
gh issue list --state open --limit 100 --json number,title,labels
```

### 3. Categorize by Priority

Group issues by priority label:
- **P0-critical**: Must fix immediately
- **P1-high**: Important for core experience
- **P2-medium**: Should do
- **P3-low**: Nice to have / backlog

### 4. Display Format

Present the board status in a clear format:

```
## In Progress
- #42 Issue title (P1-high, area:combat)

## Up Next (Top 5 by Priority)
- #33 Resting as State (P1-high, complexity:high)
- #32 Mandatory Card Play (P1-high, complexity:low)
- #58 Unit Combat Integration (P1-high, area:combat)

## Backlog Summary
- P0-critical: 0 issues
- P1-high: 3 issues
- P2-medium: 18 issues
- P3-low: 5 issues
- Total open: 26 issues

## By Area
- area:combat: 12 issues
- area:cards: 8 issues
- area:ui: 7 issues
- area:turn: 4 issues
...
```

### 5. Show Epic Progress

List any issues with the `epic` label separately, showing sub-issue progress:

```bash
# Get epics
gh issue list --label "epic" --state open --json number,title
```

Display as:
```
## Epics
- #91 Epic: All Spell Cards (8/36 sub-issues)
- #XX Epic: All Advanced Actions (0/24 sub-issues)
```

### 6. Highlight Key Info

Call out:
- Any P0-critical issues (these need immediate attention)
- Issues that have been in progress for a long time
- Quick wins (P1/P2 + complexity:low)

## Filtering Options

If user asks for specific views:
- "show me combat issues" → filter by `area:combat`
- "what are the high priority items" → filter by `P1-high`
- "show bugs only" → filter by `bug` label

## Example Output

```
## MageKnight Development Board

### In Progress
(none currently)

### High Priority (P1)
- #33 Resting as State with Card Play Allowed (complexity:high, area:turn, area:rest)
- #32 Mandatory Card Play/Discard Per Turn (complexity:low, area:turn, area:cards)
- #58 Unit Combat Integration (area:combat, area:units)

### Quick Wins (P1/P2 + Low Complexity)
- #32 Mandatory Card Play/Discard Per Turn
- #35 Auto-Advance Combat Phases
- #39 Auto-Select Meaningless Choices

### Stats
- Total open: 30 issues
- High priority: 3
- Edge cases: 8
- Features: 18
```
