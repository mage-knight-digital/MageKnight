---
name: next
description: "Recommend what issue to work on next based on priority, complexity, and dependencies. Use when user asks 'what should I work on', 'what's next', or 'pick something for me'."
user-invocable: true
argument-hint: "[optional: 'quick' for low complexity, 'important' for P1 only]"
---

# Recommend Next Issue

Analyze the backlog and recommend the best issue to work on next.

## Workflow

### 1. Fetch Open Issues and Board Status

```bash
# Get open issues
gh issue list --state open --limit 100 --json number,title,labels,body

# Get project board status to exclude "In Progress" items
gh project item-list 1 --owner eshaffer321 --format json --limit 100 | jq '[.items[] | select(.status == "In Progress") | .content.number]'
```

**Important:** Exclude issues that are already "In Progress" on the project board - another agent may be working on them.

### 2. Apply Recommendation Logic

**Priority Order:**
1. P0-critical (always first)
2. P1-high
3. P2-medium
4. P3-low

**Within Same Priority, Consider:**
- Complexity (prefer low complexity for quick wins)
- Dependencies (issues that unblock other work)
- Area clustering (if user recently worked on combat, suggest related combat issues)

### 3. Quick Win Filter

If user says `/next quick` or asks for "something quick":
- Filter to `complexity:low` only
- Prioritize P1 > P2 within that set

### 4. Important Filter

If user says `/next important`:
- Filter to `P0-critical` and `P1-high` only
- Include even high-complexity items

### 5. Present Recommendations

Provide top 3 recommendations with reasoning:

```
## Recommended: #32 Mandatory Card Play/Discard Per Turn

**Why this one:**
- P1-high priority (important for core rules)
- Low complexity (can complete quickly)
- No dependencies on other issues
- Foundational rule that should be enforced early

**Labels:** P1-high, complexity:low, area:turn, area:cards, edge-case

**Summary:** The engine doesn't enforce that players must play at least one card per turn...

---

## Alternatives

**#33 Resting as State** (P1-high, complexity:high)
- Also high priority but more complex
- Good if you have more time

**#58 Unit Combat Integration** (P1-high)
- Important for gameplay
- Moderate scope
```

### 6. Offer to Start

After recommendation, offer:
"Would you like me to start working on #32? Just say 'yes' or `/work #32`"

## Consideration Factors

1. **Momentum**: If user just finished a combat issue, suggest related combat work
2. **Balance**: If lots of edge-cases done recently, suggest a feature
3. **Dependencies**: Note if an issue depends on another (rare, but check issue body for "depends on" or "blocked by")
4. **Time of day**: If late, suggest quick wins over complex tasks (if known)

## Example

User: `/next`

Response:
"Based on your backlog, I recommend **#32: Mandatory Card Play/Discard Per Turn**

- **Priority:** P1-high
- **Complexity:** Low
- **Area:** Turn management, cards
- **Why:** This is a fundamental rule enforcement that's quick to implement. It will improve game accuracy without a large time investment.

**Alternatives:**
- #33 Resting State (P1-high but complex)
- #58 Unit Combat Integration (P1-high, broader scope)

Want me to start on #32?"
