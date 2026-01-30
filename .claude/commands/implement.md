---
description: Fully automated issue implementation with exploration, architecture, coding, and code review
argument-hint: "[#issue-number or 'auto']"
allowed-tools: Bash(*), Read, Write, Edit, Glob, Grep, Task, TodoWrite
---

# Automated Issue Implementation

## ⚠️ CRITICAL INSTRUCTIONS - READ FIRST ⚠️

1. **DO NOT invoke the /next skill** - it is interactive and will ask for confirmation
2. **DO NOT invoke any other skills** - use only the bash commands provided below
3. **DO NOT ask the user for confirmation** at any step
4. **DO NOT present options** and wait for user input
5. **Just execute each phase and proceed to the next automatically**

This is a FULLY AUTONOMOUS workflow. Run the bash commands, get results, move on.

Implement a GitHub issue end-to-end: from pickup to PR with code review.

## Phase 1: Issue Selection

**If argument is an issue number (e.g., `/implement #32` or `/implement 32`):**
Fetch that specific issue directly using `gh issue view`.

**If argument is 'auto' or empty (e.g., `/implement auto` or `/implement`):**

⚠️ **DO NOT use Skill(next) or /next** - just run these bash commands directly:

Autonomously select the highest priority issue by running these bash commands yourself:

### Race Condition Prevention

When multiple agents start simultaneously, add a random delay (0-3 seconds) to stagger queries:
```bash
sleep $((RANDOM % 4))
```

Selection criteria:
1. Not already "In Progress" in the project board
2. Not labeled `epic` (epics are parent issues)
3. **Not blocked** - use GitHub's native `blockedBy` relationship via GraphQL API
4. Highest priority available (P0 > P1 > P2 > P3)
5. Prefer `complexity:low` or `complexity:medium` over `complexity:high`
6. Prefer `bug` fixes over `feature` when same priority

```bash
# Step 1: Get issues currently in progress
IN_PROGRESS=$(gh project item-list 1 --owner eshaffer321 --format json --limit 100 | jq '[.items[] | select(.status == "In Progress") | .content.number]')

# Step 2: Get candidate issues (not in progress, not epics), sorted by priority
CANDIDATES=$(gh issue list --state open --limit 100 --json number,labels | jq -r --argjson skip "$IN_PROGRESS" '
  [.[] | select(
    (.number | IN($skip[]) | not) and
    (.labels | map(.name) | any(. == "epic") | not)
  )] |
  sort_by(
    (if .labels | map(.name) | any(. == "P0-critical") then 0
     elif .labels | map(.name) | any(. == "P1-high") then 1
     elif .labels | map(.name) | any(. == "P2-medium") then 2
     else 3 end),
    (if .labels | map(.name) | any(. == "complexity:low") then 0
     elif .labels | map(.name) | any(. == "complexity:medium") then 1
     else 2 end),
    (if .labels | map(.name) | any(. == "bug") then 0 else 1 end)
  ) | .[].number' | head -20)

# Step 3: For each candidate, check if blocked using GitHub's native blockedBy API
for ISSUE_NUM in $CANDIDATES; do
  OPEN_BLOCKERS=$(gh api graphql -f query="{ repository(owner: \"eshaffer321\", name: \"MageKnight\") { issue(number: $ISSUE_NUM) { blockedBy(first: 5) { nodes { state } } } } }" --jq '[.data.repository.issue.blockedBy.nodes[] | select(.state == "OPEN")] | length')

  if [ "$OPEN_BLOCKERS" = "0" ] || [ -z "$OPEN_BLOCKERS" ]; then
    # Not blocked by any open issues - use this one!
    SELECTED_ISSUE=$ISSUE_NUM
    break
  fi
done
```

Use `$SELECTED_ISSUE` as the issue number to implement.

**DO NOT ASK FOR CONFIRMATION.** Just pick the top issue and proceed.

### 1.1 IMMEDIATELY Claim the Issue (Race Condition Prevention)

⚠️ **CRITICAL**: Claim the issue IMMEDIATELY after selection, BEFORE doing anything else.
This prevents other agents from grabbing the same issue.

```bash
ISSUE_NUM=$SELECTED_ISSUE

# Step 1: Ensure issue is in project (add if not)
gh project item-add 1 --owner eshaffer321 --url "https://github.com/eshaffer321/MageKnight/issues/${ISSUE_NUM}" 2>/dev/null || true

# Step 2: Get item ID (may need to query with higher limit)
ITEM_ID=$(gh project item-list 1 --owner eshaffer321 --format json --limit 500 | jq -r ".items[] | select(.content.number == ${ISSUE_NUM}) | .id")

# Step 3: Check if already claimed by another agent
CURRENT_STATUS=$(gh project item-list 1 --owner eshaffer321 --format json --limit 500 | jq -r ".items[] | select(.content.number == ${ISSUE_NUM}) | .status")

if [ "$CURRENT_STATUS" = "In Progress" ]; then
  echo "ERROR: Issue #${ISSUE_NUM} was just claimed by another agent. Restarting selection..."
  # Go back and pick a different issue (remove this one from candidates)
  exit 1
fi

# Step 4: CLAIM IT NOW - Mark as In Progress immediately
gh project item-edit --project-id "PVT_kwHOAYaRMc4BNjzC" --id "$ITEM_ID" --field-id "PVTSSF_lAHOAYaRMc4BNjzCzg8hL6U" --single-select-option-id "47fc9ee4"

echo "✅ Successfully claimed issue #${ISSUE_NUM}"
```

If the claim fails (issue was taken), restart Phase 1 to select a different issue.

### 1.2 Get Issue Details

```bash
gh issue view $ISSUE_NUM --json number,title,body,labels,state
```

Extract and store:
- Issue number
- Title
- Full body text
- Labels
- **Acceptance criteria** (look for checkboxes, numbered lists, or "Acceptance Criteria" section)

---

## Phase 2: Setup (/work logic)

### 2.1 Verify Issue Details

The issue should already be marked "In Progress" from Phase 1.1. Now verify:

```bash
# Double-check we still own this issue
CURRENT_STATUS=$(gh project item-list 1 --owner eshaffer321 --format json --limit 500 | jq -r ".items[] | select(.content.number == ${ISSUE_NUM}) | .status")
if [ "$CURRENT_STATUS" != "In Progress" ]; then
  echo "ERROR: Lost claim on issue #${ISSUE_NUM}. Aborting."
  exit 1
fi
```

### 2.2 Check for Epic Label

If issue has `epic` label, STOP - epics are parent issues, not implementable directly.
(Move issue back to Backlog before stopping)

### 2.4 Create Branch and Worktree

```bash
# Generate branch name from issue
BRANCH_NAME="issue-${ISSUE_NUM}-$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g' | cut -c1-30)"

# Create worktree in dedicated directory
WORKTREE_DIR="$HOME/.claude-worktrees/mage-knight"
mkdir -p "$WORKTREE_DIR"
WORKTREE_PATH="${WORKTREE_DIR}/${BRANCH_NAME}"
git worktree add "$WORKTREE_PATH" -b "$BRANCH_NAME"

# Report worktree location
echo "Created worktree at: $WORKTREE_PATH"
```

### 2.5 Install Dependencies

Fresh worktrees don't have `node_modules`. Always install first:

```bash
cd "$WORKTREE_PATH"
pnpm install
```

Verify the setup works:
```bash
pnpm build
```

### 2.5 Add Comment

```bash
gh issue comment $ISSUE_NUM --body "Starting automated implementation."
```

---

## Phase 3: Scope Assessment

Launch the **scope-assessor** agent (Haiku) with:
- Issue title
- Issue body
- Acceptance criteria
- Labels

**If result is NEEDS_REFINEMENT:**

1. Launch 2 parallel **code-explorer** agents to deeply understand the scope
2. Launch **code-architect** agent to propose how to split
3. Present proposed sub-issues to user for approval
4. If approved:
   - Create sub-issues using /ticket skill logic
   - Link them to parent using /link skill logic
   - Add `epic` label to parent issue
   - Update parent issue body to reflect it's now a parent
   - Move parent back to Backlog
   - EXIT with report: "Issue refined into X sub-issues for future implementation"
5. If user declines split, proceed anyway with caution

**If result is PROCEED or PROCEED_WITH_CAUTION:**
Continue to Phase 4.

---

## Phase 4: Codebase Exploration

Launch 2-3 **code-explorer** agents in PARALLEL with different focuses:

1. **Similar Features Explorer**: "Find features similar to [feature] and trace their implementation"
2. **Architecture Explorer**: "Map the architecture and patterns for [affected area]"
3. **Impact Explorer**: "Identify all files and systems that will be affected by [feature]"

Each agent returns a list of 5-10 essential files.

After agents complete, READ all identified files to build deep understanding.

Create implementation todo list based on AC.

---

## Phase 5: Architecture Design

Launch **code-architect** agent with:
- Issue details and AC
- Findings from exploration phase
- List of affected files

Agent returns:
- Chosen architecture approach
- Files to create/modify
- Implementation sequence

Review the blueprint, then proceed to implementation.

---

## Phase 6: Implementation

Working in the worktree, implement the feature:

1. Follow the architecture blueprint
2. Write code that addresses each AC
3. Write unit tests for each AC
4. Update todos as you progress
5. Run `pnpm build && pnpm lint && pnpm test` periodically

If implementation reveals the scope is larger than expected:
- Do NOT continue blindly
- Report to user with what's been done and what remains
- Suggest creating follow-up tickets for remaining work

---

## Phase 7: Completion (/done logic)

### 7.1 Rebase and Resolve Conflicts

Before creating the PR, ensure the branch is up-to-date with main:

```bash
# Fetch latest main
git fetch origin main

# Rebase onto main
git rebase origin/main
```

**If conflicts occur:**

1. Identify conflicting files: `git status`
2. For each conflicting file:
   - Read both versions to understand the conflict
   - Resolve keeping intent of both changes
   - Prefer main's changes for unrelated code
   - Keep our changes for the feature being implemented
3. After resolving: `git add <resolved-files> && git rebase --continue`
4. If conflicts are too complex (same logic modified), flag for user

**Conflict Resolution Strategy:**
- Simple conflicts (imports, adjacent lines): Auto-resolve
- Complex conflicts (same function modified): Attempt resolution, flag if uncertain
- Semantic conflicts (our code depends on removed code): Flag for user review

### 7.2 Final Verification

```bash
# Ensure dependencies are installed (in case rebase pulled new deps)
pnpm install

# Run full verification
pnpm build && pnpm lint && pnpm test
```

All must pass before proceeding. If tests fail after rebase, fix integration issues.

### 7.3 Update Issue - Check AC Boxes

For each acceptance criterion that was implemented, update the issue body to check the box:

```bash
# Get current issue body
BODY=$(gh issue view $ISSUE_NUM --json body -q '.body')

# Update checkboxes from [ ] to [x] for completed items
# Then update the issue
gh issue edit $ISSUE_NUM --body "$UPDATED_BODY"
```

### 7.4 Create Commit and PR

```bash
git add -A
git commit -m "feat: <description> (#$ISSUE_NUM)"
git push -u origin $BRANCH_NAME

gh pr create \
  --title "<Brief description>" \
  --body "$(cat <<'EOF'
## Summary
<What was implemented>

## Changes
<List of key changes>

## Test Plan
<How to verify>

## Acceptance Criteria
All criteria from issue #ISSUE_NUM have been addressed.

Closes #ISSUE_NUM
EOF
)"
```

### 7.5 Comment on Issue

```bash
gh issue comment $ISSUE_NUM --body "Implementation complete. PR: #<PR_NUMBER>"
```

---

## Phase 8: Code Review

Launch 4 **code-reviewer** agents in PARALLEL:

1. `REVIEW_TYPE=bugs` - Scan for obvious bugs
2. `REVIEW_TYPE=conventions` - Check CLAUDE.md compliance
3. `REVIEW_TYPE=quality` - Evaluate code quality
4. `REVIEW_TYPE=acceptance-criteria` - Verify all AC are met (with issue number and AC list)

Collect all issues from all reviewers.

---

## Phase 9: Confidence Scoring

For each issue found in Phase 8, launch a **Haiku agent** to:
- Re-evaluate the issue
- Assign confidence score 0-100
- Filter out false positives

Only keep issues with confidence >= 80.

---

## Phase 10: Fix Loop

For each high-confidence issue:

1. Launch a **Sonnet agent** to fix the specific issue
2. Run tests to verify fix
3. Commit the fix

If fixes create new issues (max 2 iterations):
- Re-run affected reviewers
- Score and fix again

If still issues after 2 iterations, flag for user review.

---

## Phase 11: Final Report

Provide comprehensive summary:

```markdown
## Implementation Complete

**Issue:** #XX - <Title>
**PR:** #YY
**Worktree:** ~/.claude-worktrees/mage-knight/<branch>

### Changes Made
- <List of key changes>

### Acceptance Criteria
- [x] AC 1 - MET (file:line)
- [x] AC 2 - MET (file:line)
- ...

### Code Review
- Issues found: X
- Issues fixed: Y
- Remaining: Z (if any)

### Follow-up Tickets Created
- #AA - <description> (if any)

### Manual Validation Steps
1. <Step to test>
2. <Expected behavior>
3. <Edge case to check>

**Status:** Ready for manual test or merge
```

---

## Error Handling

If any phase fails:
1. Do NOT leave issue stuck in "In Progress"
2. Comment on issue with what happened
3. Either move back to Backlog or leave for user decision
4. Report clearly what failed and why

---

## Notes

- Use TodoWrite throughout to track progress
- All git operations happen in the worktree, not main repo
- Worktrees are created in `~/.claude-worktrees/mage-knight/`
- Add to Claude context: `/add-dir ~/.claude-worktrees/mage-knight/`
- Clean up after PR merged: `git worktree remove ~/.claude-worktrees/mage-knight/<branch>`
- List all worktrees: `git worktree list`
