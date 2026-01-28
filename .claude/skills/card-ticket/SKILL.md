---
name: card-ticket
description: "Create a ticket for a card issue (wrong effect, missing boost, not implemented). Use when reporting problems with specific cards."
user-invocable: true
argument-hint: "<CardName> - <issue description>"
---

# Create Card Issue Ticket

Quickly create a GitHub issue for card-related problems. Optimized for rapid-fire card issue reporting.

## Input Format

```
/card-ticket <CardName> - <issue description>
```

**Examples:**
- `/card-ticket Crystallize - boost should give 3 blue not 2`
- `/card-ticket Ice Storm - not implemented`
- `/card-ticket March - sideways value should be 2 move not 1`
- `/card-ticket Fireball - fire damage not applying to ice enemies`

## Workflow

### 1. Parse Input

Extract card name and issue from arguments:
- Card name: everything before the first `-`
- Issue: everything after the first `-`

### 2. Find Card Definition

Search for the card in order (stop when found):

| Card Type | Location |
|-----------|----------|
| Basic Actions | `packages/core/src/data/basicActions/{blue,red,green,white,special}.ts` |
| Advanced Actions | `packages/core/src/data/advancedActions/{blue,red,green,white,dual,bolts}.ts` |
| Spells | `packages/core/src/data/spells.ts` |
| Artifacts | `packages/core/src/data/artifacts.ts` |
| Skills | `packages/core/src/data/skills/index.ts` |

**Search approach:**
```bash
# Search for card constant (e.g., CARD_CRYSTALLIZE or CARD_MARCH)
grep -r "CARD_$(echo $CARD_NAME | tr '[:lower:]' '[:upper:]' | tr ' ' '_')" packages/core/src/data/
```

If not found by constant, search by display name in the card objects.

### 3. Determine Issue Type

Based on the issue description, categorize:

| Keywords | Type | Label |
|----------|------|-------|
| "not implemented", "missing", "doesn't exist" | Not implemented | `feature` |
| "wrong", "should be", "incorrect", "broken" | Bug | `bug` |
| "boost", "powered effect" | Boost issue | `bug` or `feature` |
| "sideways", "basic effect" | Basic effect issue | `bug` |
| "rulebook says", "according to rules" | Edge case | `edge-case` |

### 4. Auto-Apply Labels

Always apply:
- `area:cards`
- Priority: `P2-medium` (default, adjust if critical)

Conditional:
- `complexity:low` - single effect fix
- `complexity:medium` - new effect type needed
- `complexity:high` - requires new system/architecture

### 5. Create Issue

```bash
gh issue create \
  --title "Card: <CardName> - <brief issue>" \
  --body "$(cat <<'EOF'
## Card
**Name:** <CardName>
**Type:** <Basic Action | Advanced Action | Spell | Artifact | Skill>
**File:** `<path to definition file>`

## Issue
<User's issue description>

## Current Implementation
```typescript
<relevant code snippet from card definition>
```

## Expected Behavior
<What the card should do based on issue description>

## Acceptance Criteria
- [ ] Card effect matches expected behavior
- [ ] Tests updated/added for correct behavior
EOF
)" \
  --label "area:cards" \
  --label "<type>" \
  --label "P2-medium" \
  --project "MageKnight Development"
```

### 6. Report Back

Return concise confirmation:
```
Created #XX: Card: <CardName> - <issue>
File: <path>
Labels: area:cards, bug, P2-medium
```

## Batch Mode

For multiple cards, user can invoke multiple times quickly:
```
/card-ticket Fireball - boost damage wrong
/card-ticket Snowstorm - ice element not applied
/card-ticket Tremor - not implemented
```

Each creates a separate focused ticket.

## Card Type Detection Hints

| Indicator | Card Type |
|-----------|-----------|
| Found in `basicActions/` | Basic Action |
| Found in `advancedActions/` | Advanced Action |
| Found in `spells.ts` | Spell |
| Found in `artifacts.ts` | Artifact |
| Has `manaColor` in definition | Spell (mana required) |
| Has `boostCost` | Has powered effect |

## Common Issue Patterns

1. **Boost not implemented**: Card has basic effect but `boostEffect` is missing or wrong
2. **Wrong amount**: Effect gives wrong number (move 2 instead of 3)
3. **Missing element**: Attack should be Fire/Ice but isn't tagged
4. **Wrong combat type**: Should be Siege but is Ranged
5. **Missing condition**: Should only work at night, in combat, etc.
6. **Sideways wrong**: `sidewaysEffect` gives wrong value

## Example Output

User: `/card-ticket Crystallize - boost should give 3 blue mana not 2`

Response:
```
Created #100: Card: Crystallize - boost gives wrong mana amount
File: packages/core/src/data/spells.ts
Labels: area:cards, bug, P2-medium, complexity:low
```
