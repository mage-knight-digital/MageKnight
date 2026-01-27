# GitHub Project Integration Plan

## Overview

This plan sets up a GitHub Issues + Projects workflow with tight Claude Code integration. The goal is to give you high-level visibility into priorities and progress while enabling Claude to participate in the PM workflow.

---

## Part 1: GitHub Setup

### 1.1 Labels

Create labels for filtering and categorization:

**Priority** (color: red → green gradient)
| Label | Color | Description |
|-------|-------|-------------|
| `P0-critical` | `#b60205` | Blocks gameplay, must fix immediately |
| `P1-high` | `#d93f0b` | Important for core experience |
| `P2-medium` | `#fbca04` | Should do, but not urgent |
| `P3-low` | `#0e8a16` | Nice to have, backlog |

**Type** (color: blues/purples)
| Label | Color | Description |
|-------|-------|-------------|
| `bug` | `#d73a4a` | Something is broken |
| `feature` | `#0075ca` | New functionality |
| `edge-case` | `#7057ff` | Rulebook edge case not handled |
| `tech-debt` | `#5319e7` | Code quality, refactoring |
| `docs` | `#0052cc` | Documentation only |

**Area** (color: greens/teals)
| Label | Color | Description |
|-------|-------|-------------|
| `area:combat` | `#1d76db` | Combat system |
| `area:cards` | `#1d76db` | Card effects, deck |
| `area:mana` | `#1d76db` | Mana system |
| `area:turn` | `#1d76db` | Turn structure, phases |
| `area:rest` | `#1d76db` | Resting mechanics |
| `area:movement` | `#1d76db` | Movement, terrain |
| `area:units` | `#1d76db` | Units, recruitment |
| `area:sites` | `#1d76db` | Sites, conquest |
| `area:ui` | `#1d76db` | Client/UI |

**Complexity**
| Label | Color | Description |
|-------|-------|-------------|
| `complexity:low` | `#c5def5` | Small change, < 1 hour |
| `complexity:high` | `#0e8a16` | Significant work, multiple files |

### 1.2 Project Board

Create a GitHub Project with these columns:

| Column | Purpose |
|--------|---------|
| **Backlog** | All issues not yet prioritized for work |
| **Up Next** | Prioritized, ready to work on |
| **In Progress** | Currently being worked on |
| **In Review** | PR open, awaiting review/merge |
| **Done** | Completed and merged |

### 1.3 Migrate Existing Tickets

For each markdown ticket in `docs/tickets/`:
1. Create GitHub issue with title from ticket
2. Copy markdown content as issue body
3. Apply appropriate labels based on ticket metadata
4. Add to project board (Backlog column)
5. Add link back to original markdown file
6. Update markdown file with issue link at top

---

## Part 2: Claude Code Skills

### 2.1 `/ticket` - Create New Ticket

Creates a GitHub issue from investigation, adds to project.

```
.claude/skills/ticket/SKILL.md
```

**Purpose**: When you say "investigate X and create a ticket", Claude investigates, writes up the issue, creates it in GitHub, and adds to project.

**What it does**:
1. Research the issue/feature in codebase
2. Write up the ticket in GitHub issue format
3. Create issue with appropriate labels
4. Add to project board (Backlog)
5. Optionally create markdown spec in `docs/tickets/` for complex issues

### 2.2 `/work` - Start Working on Issue

Picks up an issue, sets status, begins implementation.

```
.claude/skills/work/SKILL.md
```

**Purpose**: Invoke with `/work #123` or `/work` (picks from Up Next).

**What it does**:
1. Fetch issue details from GitHub
2. Move issue to "In Progress" on project board
3. Read any linked markdown spec
4. Begin implementation following the ticket
5. Update issue with progress comments as needed

### 2.3 `/done` - Complete Work on Issue

Finishes current work, updates GitHub.

```
.claude/skills/done/SKILL.md
```

**Purpose**: When implementation is complete, wrap up cleanly.

**What it does**:
1. Create PR linked to issue (if not already)
2. Move issue to "In Review"
3. Add completion comment to issue
4. Update any markdown spec with implementation notes

### 2.4 `/board` - View Project Status

Shows current project board state.

```
.claude/skills/board/SKILL.md
```

**Purpose**: Quick glance at what's in progress, up next, etc.

**What it does**:
1. Fetch project board state
2. Show issues by column
3. Highlight priorities

### 2.5 `/next` - What Should I Work On?

Recommends next issue based on priority.

```
.claude/skills/next/SKILL.md
```

**Purpose**: When you ask "what should I work on?", gives recommendation.

**What it does**:
1. Look at "Up Next" column
2. Consider priority labels
3. Consider dependencies between issues
4. Recommend top 1-3 issues to tackle

---

## Part 3: Workflow

### Creating New Tickets

**You**: "Investigate why XYZ doesn't work and create a ticket"
**Claude**: Investigates, runs `/ticket` to create issue with labels

**You**: `/ticket Add support for Lost Legion expansion`
**Claude**: Creates issue directly with your description

### Working on Issues

**You**: `/work #42`
**Claude**:
- Moves #42 to "In Progress"
- Reads issue + any markdown spec
- Implements the feature/fix
- Comments on issue with progress

**You**: `/work` (no number)
**Claude**: Picks highest priority from "Up Next" and starts

### Completing Work

**You**: "That looks good, wrap it up"
**Claude**: Runs `/done`
- Creates PR with "Closes #42"
- Moves issue to "In Review"
- Adds summary comment

### Checking Status

**You**: `/board`
**Claude**: Shows:
```
## In Progress
- #42 Combat damage calculation bug (P1-high, complexity:low)

## Up Next
- #38 Resting state implementation (P1-high, complexity:high)
- #41 Mandatory card play per turn (P1-high, complexity:low)

## Backlog (top 5 by priority)
- ...
```

**You**: `/next`
**Claude**: "Based on priority and complexity, I'd recommend #41 (Mandatory card play per turn) - it's P1-high but low complexity, good quick win."

---

## Part 4: Integration Behavior

### Automatic Behaviors (via skill instructions)

When working on any issue:
- Reference issue number in commit messages (`fix: resolve combat bug (#42)`)
- Link PRs to issues
- Update issue status when starting/completing work
- Add comments for significant progress

### Markdown Specs

For complex issues (complexity:high), we keep markdown specs in `docs/tickets/`:
- More searchable for Claude
- Version controlled
- Can include code examples, diagrams
- Issue links to markdown file

Simple issues just use the GitHub issue body.

---

## Part 5: Commands Summary

| Command | Purpose |
|---------|---------|
| `/ticket [description]` | Create new issue |
| `/work [#number]` | Start working on issue |
| `/done` | Complete current issue, create PR |
| `/board` | View project board status |
| `/next` | Get recommendation for next issue |

---

## Implementation Steps

1. **Create labels** via `gh label create`
2. **Create project** via `gh project create`
3. **Migrate tickets** - Create issues from markdown files
4. **Create skills** in `.claude/skills/`
5. **Test workflow** with a simple issue

---

## Questions for You

1. **Project scope**: Just this repo, or do you want a single project across multiple repos?

2. **Markdown specs**: Keep for all issues, or only complex ones?

3. **Auto-assignment**: Should issues be auto-assigned to you when created?

4. **Milestones**: Want to group issues by milestone (e.g., "v1.0 Core Rules Complete")?

5. **Additional labels**: Any other categorizations you'd find useful?
