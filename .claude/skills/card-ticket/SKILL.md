---
name: card-ticket
description: "Create a ticket for a card issue (wrong effect, missing boost, not implemented). Use when reporting problems with specific cards."
user-invocable: true
argument-hint: "<CardName> <paste rulebook text, FAQ entries, edge cases...>"
---

# Create Card Issue Ticket

Investigate a card's implementation and create a comprehensive ticket based on user-provided rulebook/FAQ context.

## Input Format

```
/card-ticket <CardName>
<dump of context: rulebook text, FAQ entries, edge cases, anything relevant>
```

**Example:**
```
/card-ticket Ice Shield
Basic: Ice Block 3
Powered: Ice Block 3. Reduce the Armor of one enemy blocked this way by 3. Armor cannot be reduced below 1.
FAQ: Q: Can armor reduction stack with other effects? A: Yes, but armor minimum is always 1.
FAQ: Q: Does this work against fortified sites? A: Armor reduction applies after fortification is dealt with.
Edge case: If blocking multiple enemies, you choose which one gets armor reduced.
```

## Workflow

### 1. Parse Input

- **Card name:** First line or first few words (be flexible on casing/spelling)
- **Context:** Everything else - rulebook text, FAQ, edge cases, notes

### 2. Find Card in Codebase

Search for the card (fuzzy match):

```bash
# Try exact constant match first
grep -r "CARD_ICE_SHIELD\|ice_shield\|Ice Shield" packages/core/src/data/

# If not found, try fuzzy
grep -ri "<card name words>" packages/core/src/data/
```

**Card locations:**
| Type | Path |
|------|------|
| Basic Actions | `packages/core/src/data/basicActions/*.ts` |
| Advanced Actions | `packages/core/src/data/advancedActions/*.ts` |
| Spells | `packages/core/src/data/spells.ts` |
| Artifacts | `packages/core/src/data/artifacts.ts` |

### 3. Read Current Implementation

Once found, extract:
- Card ID and name
- `basicEffect` - what the basic effect does
- `poweredEffect` / `boostEffect` - what the powered effect does
- `sidewaysValue` - the sideways play value
- Any existing TODO comments
- Any comments describing intended behavior

### 4. Compare Against User Context

Analyze the gap between:
- **Expected** (from user's rulebook/FAQ dump)
- **Implemented** (from code)

Look for:
- Missing effects entirely
- Wrong values (Move 2 instead of Move 3)
- Missing conditionals (should only work at night)
- Missing edge case handling (FAQ rulings not covered)
- Incorrect element types
- Missing armor/resistance interactions

### 5. Investigate Edge Cases

For each FAQ entry or edge case the user provided:
- Search codebase for related handling
- Check if validators cover the case
- Check if effect resolvers handle it
- Note what's missing

### 6. Create Comprehensive Ticket

```bash
gh issue create \
  --title "Card: <CardName> - <brief gap summary>" \
  --body "$(cat <<'EOF'
## Card
**Name:** <CardName>
**Type:** <Basic Action | Advanced Action | Spell | Artifact>
**File:** `<path to definition>`

## Rulebook Text
**Basic:** <from user input>
**Powered:** <from user input>

## Current Implementation
**Basic Effect:**
```typescript
<actual code>
```
**Powered Effect:**
```typescript
<actual code>
```
**Existing TODOs:** <any TODO comments found>

## Gap Analysis
| Expected | Implemented | Status |
|----------|-------------|--------|
| Ice Block 3 | `blockWithElement(3, ICE)` | ✅ |
| Armor reduction by 3 | Not implemented | ❌ |
| Minimum armor 1 | Not implemented | ❌ |

## FAQ & Edge Cases
| Ruling | Handled? | Notes |
|--------|----------|-------|
| Armor stacks but min 1 | ❌ | Need armor floor logic |
| Works on fortified | ❓ | Needs investigation |

## Acceptance Criteria
- [ ] Basic effect: <requirement>
- [ ] Powered effect: <requirement>
- [ ] Edge case: <requirement>
- [ ] Tests cover FAQ rulings
EOF
)" \
  --label "area:cards" \
  --label "<bug|feature>" \
  --label "P2-medium" \
  --project "MageKnight Development"
```

### 7. Determine Labels

**Type:**
- `bug` - Card exists but effect is wrong
- `feature` - Card effect not implemented at all
- `edge-case` - Basic effect works but FAQ rulings not handled

**Complexity:**
- `complexity:low` - Fix values or add simple effect
- `complexity:medium` - New effect type or modifier needed
- `complexity:high` - Requires new system (e.g., armor reduction system)

### 8. Report Back

```
Created #XX: Card: Ice Shield - missing armor reduction on powered effect

Gaps found:
- ❌ Armor reduction not implemented
- ❌ Minimum armor floor not enforced
- ❓ Fortification interaction needs verification

File: packages/core/src/data/advancedActions/blue.ts:61
```

## Tips for User

When dumping context, include:
- **Exact rulebook text** for basic and powered effects
- **FAQ entries** mentioning this card by name
- **Related FAQ entries** that might apply (e.g., general armor rules)
- **Edge cases** you've encountered or wondered about
- **Interactions** with other cards/abilities if known

The more context you provide, the better the gap analysis.

## Batch Mode

Run multiple times for a card jam session:
```
/card-ticket Ice Shield
<ice shield context>

/card-ticket Frost Bridge
<frost bridge context>

/card-ticket Crystal Mastery
<crystal mastery context>
```

Each creates a focused, well-researched ticket.
