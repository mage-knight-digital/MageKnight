---
name: done
description: "Complete work on current issue, create PR, and update project board. Use when implementation is complete and ready for review."
user-invocable: true
argument-hint: "[optional: #issue-number if not obvious from context]"
---

# Complete Work on Issue

Wrap up implementation, create a pull request, and update tracking.

## Workflow

### 1. Verify Implementation Complete

Before proceeding, ensure:
- All acceptance criteria from the issue are met
- Tests pass: `pnpm test`
- Build succeeds: `pnpm build`
- Lint passes: `pnpm lint`

If any checks fail, fix them first before completing.

### 2. Identify the Issue

Determine which issue we're completing:
- Use provided argument if given
- Check recent commit messages for issue references
- Check current branch name for issue number
- Ask user if unclear

### 3. Create Pull Request

```bash
gh pr create \
  --title "Brief description of changes" \
  --body "$(cat <<'EOF'
## Summary
Brief description of what was implemented.

## Changes
- Change 1
- Change 2

## Test Plan
- How to test this change

Closes #ISSUE_NUMBER
EOF
)"
```

**Important**: Include `Closes #XX` in the PR body to auto-close the issue when merged.

### 4. Add Completion Comment

```bash
gh issue comment ISSUE_NUM --body "Implementation complete. PR: #PR_NUMBER"
```

### 5. Project Board Status

The issue stays "In Progress" until the PR is merged. When merged, GitHub auto-closes the issue via `Closes #XX`, and the project board should move it to "Done" automatically.

If you need to manually move to Done:
```bash
ITEM_ID=$(gh project item-list 1 --owner eshaffer321 --format json --limit 100 | jq -r '.items[] | select(.content.number == ISSUE_NUM) | .id')
gh project item-edit --project-id "PVT_kwHOAYaRMc4BNjzC" --id "$ITEM_ID" --field-id "PVTSSF_lAHOAYaRMc4BNjzCzg8hL6U" --single-select-option-id "98236657"
```

### 6. Report to User

Provide:
- PR URL
- Summary of changes made
- Any notes for review

## Commit Message Format

Use conventional commits:
- `feat: description` - New feature
- `fix: description` - Bug fix
- `refactor: description` - Code change that neither fixes bug nor adds feature
- `docs: description` - Documentation only
- `test: description` - Adding tests

Include issue reference: `feat: implement mandatory card play (#32)`

## Example

User: "looks good, wrap it up"

Response:
1. Run `pnpm build && pnpm lint && pnpm test`
2. If passing, create commit with proper message
3. Push branch
4. Create PR with "Closes #32"
5. Comment on issue with PR link
6. "Created PR #XX for issue #32. Ready for review."
