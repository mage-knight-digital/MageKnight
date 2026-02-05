---
name: link
description: "Link GitHub issues as sub-issues or blockers. Use when organizing epics or marking dependencies between issues."
user-invocable: true
argument-hint: "<child> to <parent> | <issue> blocked by <blocker>"
---

# Link GitHub Issues

Create relationships between issues: sub-issues (parent/child) and blockers (dependencies).

## Usage

```
/link #45 to #103        # Make #45 a sub-issue of epic #103
/link #45 blocked by #108  # Mark #45 as blocked by #108
```

## Sub-Issues (Parent/Child)

Sub-issues organize work under an epic. The child issue appears in the epic's task list.

### Add Sub-Issue

```bash
gh api graphql -f query='
mutation {
  addSubIssue(input: {
    issueId: "<PARENT_NODE_ID>"
    subIssueId: "<CHILD_NODE_ID>"
  }) {
    issue { number }
    subIssue { number }
  }
}'
```

**To get node IDs:**
```bash
# Get parent epic's node ID
gh api repos/eshaffer321/MageKnight/issues/<parent_number> --jq '.node_id'

# Get child issue's node ID
gh api repos/eshaffer321/MageKnight/issues/<child_number> --jq '.node_id'
```

### Common Epics

| Epic | Description |
|------|-------------|
| #103 | All Basic Action Cards |
| #90  | All Advanced Action Cards |
| #91  | All Spell Cards |
| #92  | All Artifact Cards |

## Blockers (Dependencies)

Blockers indicate that one issue cannot be completed until another is resolved.

### Mark as Blocked

```bash
# Get the blocking issue's node ID (the blocker)
BLOCKING_ID=$(gh api repos/eshaffer321/MageKnight/issues/<blocker_number> --jq '.node_id')

# Add blocked-by relationship
gh api graphql -f query="
mutation {
  addIssueToIssuesDependency(input: {
    blockedIssueId: \"<BLOCKED_ISSUE_NODE_ID>\"
    blockingIssueId: \"$BLOCKING_ID\"
  }) {
    blockedIssue { number }
    blockingIssue { number }
  }
}"
```

### Common Blockers

| Issue | Description |
|-------|-------------|
| #108  | Discard-as-Cost System |
| #109  | Movement trigger system |

## Complete Example

**Scenario:** Link new issue #150 as a sub-issue of epic #103, and mark it blocked by #108.

```bash
# 1. Get all node IDs
EPIC_ID=$(gh api repos/eshaffer321/MageKnight/issues/103 --jq '.node_id')
NEW_ID=$(gh api repos/eshaffer321/MageKnight/issues/150 --jq '.node_id')
BLOCKER_ID=$(gh api repos/eshaffer321/MageKnight/issues/108 --jq '.node_id')

# 2. Add as sub-issue to epic
gh api graphql -f query="
mutation {
  addSubIssue(input: {
    issueId: \"$EPIC_ID\"
    subIssueId: \"$NEW_ID\"
  }) {
    issue { number }
    subIssue { number }
  }
}"

# 3. Mark as blocked
gh api graphql -f query="
mutation {
  addIssueToIssuesDependency(input: {
    blockedIssueId: \"$NEW_ID\"
    blockingIssueId: \"$BLOCKER_ID\"
  }) {
    blockedIssue { number }
    blockingIssue { number }
  }
}"
```

## Rate Limits

All linking operations require GraphQL (no REST equivalent). If you get rate-limited, tell the user and suggest they try again in a few minutes, or link manually in the GitHub UI.

## Workflow

1. **Parse input** - Extract issue numbers and relationship type
2. **Get node IDs** - Fetch GraphQL node IDs for each issue (REST: `gh api repos/...`)
3. **Create relationship** - Use appropriate GraphQL mutation
4. **Report back** - Confirm the link was created

## Report Back

```
Linked #150 → #103 (sub-issue)
Linked #150 ← blocked by #108
```
