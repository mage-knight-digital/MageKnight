---
description: Implement a GitHub issue and create a PR
argument-hint: "#issue-number"
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep, Task, TodoWrite
---

# Implement Issue

Implement a GitHub issue end-to-end and create a PR that closes it.

**Assumptions:** Already in the correct worktree/branch. Dependencies installed. Just implement and PR.

## Phase 1: Get the Issue

```bash
gh issue view $ARGUMENTS --json number,title,body,labels
```

Read the issue body carefully. Extract:
- Issue number and title
- Acceptance criteria (checkboxes, numbered lists, or AC section)
- If it references a spec in `docs/tickets/`, read that file too

Create a todo list from the acceptance criteria.

---

## Phase 2: Codebase Exploration

Launch 2-3 **code-explorer** agents in PARALLEL to understand what needs to change:

1. **Similar Features**: "Find features similar to [feature] and trace their implementation"
2. **Architecture**: "Map the architecture and patterns for [affected area]"
3. **Impact**: "Identify all files and systems affected by [feature]"

After agents complete, READ all identified key files.

---

## Phase 3: Implementation

1. Follow existing codebase patterns
2. Implement each acceptance criterion
3. Write tests for new behavior
4. Update todos as you progress
5. Commit as you go: `feat: description (#XX)`

Run periodically:
```bash
bun run build && bun run lint && bun run test
```

---

## Phase 4: Create PR

### 4.1 Rebase on main

```bash
git fetch origin main
git rebase origin/main
```

If conflicts occur, resolve them. Re-verify after rebase:
```bash
bun run build && bun run lint && bun run test
```

### 4.2 Push and create PR

```bash
git push -u origin $(git branch --show-current)

PR_URL=$(gh pr create \
  --title "<Brief description>" \
  --body "$(cat <<'EOF'
## Summary
<What was implemented>

## Changes
- <Change 1>
- <Change 2>

Closes #ISSUE_NUM
EOF
)")

echo "PR created: $PR_URL"
```

**Critical**: `Closes #XX` must be in the PR body.

---

## Phase 5: Report

```markdown
## Implementation Complete

**Issue:** #XX - <Title>
**PR:** <PR_URL>

### Changes Made
- <Key changes>

### Acceptance Criteria
- [x] AC 1
- [x] AC 2

**PR Link:** <PR_URL>
```
