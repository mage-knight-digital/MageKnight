# Ancient Ruins Site Implementation Plan

## Overview

Ancient Ruins is a unique adventure site that uses **yellow tokens** - a completely separate token pool from enemy tokens. When a player enters ancient ruins, the yellow token determines whether they encounter:

1. **An Altar** - Pay 3 mana of the depicted color to gain 7 Fame
2. **Enemies** - Fight the depicted enemies to claim the depicted reward

This is more complex than other adventure sites because:
- Yellow tokens are NOT enemy tokens - they're a separate token type
- The site has two distinct interaction modes (altar tribute vs combat)
- Rewards vary per token rather than being fixed for the site type
- Token visibility rules differ (face-up during day, face-down at night)

---

## Current State Analysis

### What Exists

- `SiteType.AncientRuins` is defined in `core/src/types/map.ts`
- Site properties configured in `core/src/data/siteProperties.ts`
- `enterSiteCommand.ts` has placeholder logic for ruins (draws brown enemy at night only)
- `FameReward` type exists in `shared/src/siteRewards.ts` (created for this feature)
- Ancient Ruins appear on multiple tiles (Countryside 8, 10, 11; Core 2, 3, 4, City 5)

### What's Missing

1. **Yellow token data structure and definitions**
2. **Yellow token pool management** (draw/shuffle/discard)
3. **HexState.ruinsToken** field to track which yellow token is at a ruins site
4. **Altar tribute action** (pay mana → gain fame)
5. **Modified enterSiteCommand** to handle altar vs enemy logic
6. **Token-specific enemies and rewards**
7. **Visibility rules** (face-up/down based on time of day)
8. **Events for yellow token lifecycle**
9. **Valid actions for altar tribute**
10. **Validators for new actions**

---

## Yellow Token Data

### Base Game Tokens (8 total)

**Altar Tokens (4):**
| Token ID | Mana Color | Reward |
|----------|------------|--------|
| altar_red | Red | 7 Fame |
| altar_blue | Blue | 7 Fame |
| altar_green | Green | 7 Fame |
| altar_white | White | 7 Fame |

**Enemy Tokens (4):**
| Token ID | Enemies | Reward |
|----------|---------|--------|
| ruins_gargoyles | 1 Gargoyle (brown) | Artifact |
| ruins_medusa | 1 Medusa (brown) | Spell |
| ruins_werewolf | 1 Werewolf (brown) | 4 Crystals (1 each color) |
| ruins_golems | 2 Golems (brown) | Advanced Action |

*Note: Lost Legion expansion adds more tokens - can be added later.*

---

## Implementation Tasks

### Phase 1: Yellow Token Data Types (shared package)

**File: `packages/shared/src/ruinsTokens.ts`** (new)

```typescript
// Token type discriminator
export const RUINS_TOKEN_TYPE_ALTAR = "altar" as const;
export const RUINS_TOKEN_TYPE_ENEMY = "enemy" as const;

export type RuinsTokenType =
  | typeof RUINS_TOKEN_TYPE_ALTAR
  | typeof RUINS_TOKEN_TYPE_ENEMY;

// Mana color for altars
export type AltarManaColor = "red" | "blue" | "green" | "white";

// Altar token definition
export interface AltarToken {
  readonly type: typeof RUINS_TOKEN_TYPE_ALTAR;
  readonly id: RuinsTokenId;
  readonly manaColor: AltarManaColor;
  readonly tributeCost: 3; // Always 3 mana
  readonly fameReward: 7; // Always 7 fame
}

// Enemy token definition
export interface EnemyRuinsToken {
  readonly type: typeof RUINS_TOKEN_TYPE_ENEMY;
  readonly id: RuinsTokenId;
  readonly enemies: readonly EnemyId[]; // Which enemies to draw
  readonly reward: SiteReward; // Token-specific reward
}

export type RuinsToken = AltarToken | EnemyRuinsToken;

// Branded type for token IDs
export type RuinsTokenId = string & { readonly __brand: "RuinsTokenId" };

// Token definitions
export const RUINS_TOKENS: Record<RuinsTokenId, RuinsToken>;
```

### Phase 2: Yellow Token Pool Management (core package)

**File: `packages/core/src/types/ruinsTokens.ts`** (new)

```typescript
export interface RuinsTokenPools {
  readonly drawPile: readonly RuinsTokenId[];
  readonly discardPile: readonly RuinsTokenId[];
}
```

**File: `packages/core/src/engine/helpers/ruinsTokenHelpers.ts`** (new)

- `createRuinsTokenPools(rng)` - Initialize shuffled pool
- `drawRuinsToken(pools, rng)` - Draw from pool, reshuffle if needed
- `discardRuinsToken(pools, tokenId)` - Return to discard

### Phase 3: Map State Updates (core package)

**Update: `packages/core/src/types/map.ts`**

```typescript
export interface HexState {
  // ... existing fields
  readonly ruinsToken?: {
    readonly tokenId: RuinsTokenId;
    readonly isRevealed: boolean; // Face-up (day) or face-down (night)
  };
}
```

**Update: `packages/shared/src/types/clientState.ts`**

```typescript
export interface ClientHexState {
  // ... existing fields
  readonly ruinsToken?: {
    readonly isRevealed: boolean;
    // Only included if revealed:
    readonly tokenId?: RuinsTokenId;
    readonly tokenType?: RuinsTokenType;
    readonly altarColor?: AltarManaColor;
    readonly enemies?: readonly EnemyId[];
    readonly reward?: SiteReward;
  };
}
```

### Phase 4: Tile Reveal Updates

**Update: `packages/core/src/engine/commands/exploreCommand.ts`**

When revealing a tile with Ancient Ruins:
1. Draw a yellow token from the pool
2. Set visibility based on time of day (revealed if day, hidden if night)
3. Place token on hex

```typescript
// In exploreCommand, after drawing enemies for other sites:
if (hex.site?.type === SiteType.AncientRuins) {
  const { tokenId, pools: newPools, rng: newRng } = drawRuinsToken(
    state.ruinsTokenPools,
    currentRng
  );
  // Update hex with token, visibility based on timeOfDay
}
```

### Phase 5: New Events (shared package)

**File: `packages/shared/src/events/sites/ruins.ts`** (new)

```typescript
// When yellow token placed on tile reveal
export const RUINS_TOKEN_PLACED = "RUINS_TOKEN_PLACED" as const;
export interface RuinsTokenPlacedEvent {
  readonly type: typeof RUINS_TOKEN_PLACED;
  readonly hexCoord: HexCoord;
  readonly isRevealed: boolean;
  readonly tokenId?: RuinsTokenId; // Only if revealed
}

// When face-down token is revealed (day start or enter)
export const RUINS_TOKEN_REVEALED = "RUINS_TOKEN_REVEALED" as const;
export interface RuinsTokenRevealedEvent {
  readonly type: typeof RUINS_TOKEN_REVEALED;
  readonly hexCoord: HexCoord;
  readonly tokenId: RuinsTokenId;
  readonly tokenType: RuinsTokenType;
}

// When player pays altar tribute
export const ALTAR_TRIBUTE_PAID = "ALTAR_TRIBUTE_PAID" as const;
export interface AltarTributePaidEvent {
  readonly type: typeof ALTAR_TRIBUTE_PAID;
  readonly playerId: string;
  readonly hexCoord: HexCoord;
  readonly manaColor: AltarManaColor;
  readonly fameGained: number;
}
```

### Phase 6: New PlayerAction (shared package)

**Update: `packages/shared/src/actions/playerActions.ts`**

```typescript
export const PAY_ALTAR_TRIBUTE = "PAY_ALTAR_TRIBUTE" as const;
export interface PayAltarTributeAction {
  readonly type: typeof PAY_ALTAR_TRIBUTE;
  readonly manaSource: ManaCost[]; // How to pay the 3 mana
}
```

### Phase 7: Altar Tribute Command (core package)

**File: `packages/core/src/engine/commands/payAltarTributeCommand.ts`** (new)

```typescript
export function createPayAltarTributeCommand(params: {
  playerId: string;
  manaPayment: ManaCost[];
}): Command {
  return {
    type: PAY_ALTAR_TRIBUTE_COMMAND,
    playerId: params.playerId,
    isReversible: false, // Fame gained, token removed

    execute(state: GameState): CommandResult {
      // 1. Validate player is at ruins with altar token
      // 2. Validate mana payment (3 of correct color)
      // 3. Deduct mana from player
      // 4. Grant 7 fame
      // 5. Mark site conquered
      // 6. Discard ruins token
      // 7. Emit events
    }
  };
}
```

### Phase 8: Update enterSiteCommand

**Update: `packages/core/src/engine/commands/enterSiteCommand.ts`**

For Ancient Ruins specifically:
1. Reveal token if face-down
2. If altar token → don't start combat (player can choose to pay tribute or leave)
3. If enemy token → draw the specific enemies shown on token, start combat

```typescript
if (site.type === SiteType.AncientRuins) {
  const ruinsToken = hex.ruinsToken;

  // Reveal if hidden
  if (!ruinsToken.isRevealed) {
    // Update to revealed, emit RUINS_TOKEN_REVEALED
  }

  const tokenDef = RUINS_TOKENS[ruinsToken.tokenId];

  if (tokenDef.type === RUINS_TOKEN_TYPE_ALTAR) {
    // No combat - player can pay tribute as separate action
    // Mark hasTakenActionThisTurn = true
    return { state, events };
  }

  // Enemy token - draw specific enemies and start combat
  const enemies = tokenDef.enemies.map(id => /* draw from pool */);
  // ... start combat with token-specific enemies
}
```

### Phase 9: Validators

**File: `packages/core/src/engine/validators/ruinsValidators.ts`** (new)

```typescript
// Validate PAY_ALTAR_TRIBUTE action
export function validatePayAltarTribute(
  state: GameState,
  playerId: string,
  action: PayAltarTributeAction
): ValidationResult {
  // Player at ruins?
  // Ruins has altar token?
  // Token revealed?
  // Player has required mana?
  // Site not already conquered?
}
```

**Update: `packages/core/src/engine/validators/siteValidators.ts`**

- Update `canEnterSite` to handle ruins properly
- Don't require combat capability if ruins has altar (can just pay tribute)

### Phase 10: Valid Actions

**Update: `packages/core/src/engine/validActions/sites.ts`**

Add `PayAltarTribute` to valid actions when:
- Player is at Ancient Ruins
- Site has altar token (revealed)
- Player has 3 mana of the required color
- Site not conquered
- Player hasn't taken action this turn

### Phase 11: Conquest Rewards

**Update: `packages/core/src/engine/commands/conquerSiteCommand.ts`**

For Ancient Ruins:
- If altar → reward is FameReward (already granted via tribute)
- If enemies → reward from the specific token (artifact/spell/crystals/AA)

### Phase 12: Round Start Token Reveal

**Update round start logic**

At the start of each Day round, reveal any face-down yellow tokens:
```typescript
// In round start command
if (state.timeOfDay === TIME_OF_DAY_DAY) {
  for (const hex of Object.values(state.map.hexes)) {
    if (hex.site?.type === SiteType.AncientRuins &&
        hex.ruinsToken &&
        !hex.ruinsToken.isRevealed) {
      // Reveal token, emit event
    }
  }
}
```

### Phase 13: Client State Filtering

**Update: `packages/server/src/index.ts`**

In `toClientState()`:
- Always show that ruins has a token
- Only include token details (id, type, color, enemies, reward) if revealed
- Hide token ID for face-down tokens

### Phase 14: GameState Updates

**Update: `packages/core/src/state/GameState.ts`**

```typescript
export interface GameState {
  // ... existing fields
  readonly ruinsTokenPools: RuinsTokenPools;
}
```

---

## File Change Summary

### New Files
| File | Package | Description |
|------|---------|-------------|
| `ruinsTokens.ts` | shared | Yellow token types and definitions |
| `events/sites/ruins.ts` | shared | Ruins-specific events |
| `ruinsTokens.ts` | core/types | Token pool types |
| `ruinsTokenHelpers.ts` | core/helpers | Pool management functions |
| `payAltarTributeCommand.ts` | core/commands | Altar tribute command |
| `ruinsValidators.ts` | core/validators | Ruins-specific validation |

### Modified Files
| File | Changes |
|------|---------|
| `shared/src/actions/playerActions.ts` | Add `PAY_ALTAR_TRIBUTE` action |
| `shared/src/types/clientState.ts` | Add `ruinsToken` to `ClientHexState` |
| `core/src/types/map.ts` | Add `ruinsToken` to `HexState` |
| `core/src/state/GameState.ts` | Add `ruinsTokenPools` |
| `core/src/engine/commands/exploreCommand.ts` | Draw yellow token on reveal |
| `core/src/engine/commands/enterSiteCommand.ts` | Handle altar vs enemy logic |
| `core/src/engine/commands/conquerSiteCommand.ts` | Token-specific rewards |
| `core/src/engine/validators/siteValidators.ts` | Update ruins validation |
| `core/src/engine/validActions/sites.ts` | Add altar tribute valid action |
| `server/src/index.ts` | Filter ruins token in client state |

---

## Testing Strategy

### Unit Tests

1. **Token pool tests** (`ruinsTokenHelpers.test.ts`)
   - Pool initialization with correct tokens
   - Draw from pool
   - Reshuffle discard when draw empty

2. **Altar tribute tests** (`payAltarTributeCommand.test.ts`)
   - Valid tribute payment
   - Insufficient mana rejection
   - Wrong color rejection
   - Fame granted correctly
   - Site conquered after tribute

3. **Enter ruins tests** (`enterSiteCommand.test.ts`)
   - Altar token → no combat started
   - Enemy token → correct enemies drawn
   - Face-down token revealed on entry
   - Token-specific rewards on conquest

4. **Validation tests** (`ruinsValidators.test.ts`)
   - All validation cases for altar tribute

### Integration Tests

1. Full ruins flow: reveal tile → enter ruins → pay tribute → conquest
2. Full ruins flow: reveal tile → enter ruins → fight enemies → conquest
3. Night reveal → day start reveals token
4. Multiple ruins on map with token pool management

---

## Open Questions

1. **Lost Legion tokens**: Should we include Lost Legion expansion tokens now or defer?
   - Recommendation: Start with base game 8 tokens, design for extensibility

2. **Enemy drawing**: When enemy ruins token shows specific enemies (e.g., "Gargoyles"), do we:
   - Draw that specific enemy type from the brown pile?
   - Or draw random brown and ignore token specificity?
   - Recommendation: Draw specific enemy type per token (more faithful to rules)

3. **Multiple players at ruins**: Can multiple players attempt altar tribute before site is conquered?
   - Recommendation: First successful tribute conquers the site

---

## Dependencies

This implementation depends on:
- Existing site conquest system (working)
- Existing mana payment system (working)
- Existing combat system (working)
- Fame tracking (working)

No external dependencies required.

---

## Estimated Complexity

| Phase | Complexity | Notes |
|-------|------------|-------|
| 1-2: Token types & pool | Low | Similar to enemy token system |
| 3-4: Map state updates | Low | Adding fields to existing types |
| 5-6: Events & actions | Low | Following existing patterns |
| 7: Tribute command | Medium | New command with mana deduction |
| 8: Update enterSite | Medium | Branching logic for altar vs enemy |
| 9-10: Validators & valid actions | Low | Following existing patterns |
| 11: Conquest rewards | Low | Connecting to existing reward system |
| 12: Round start reveal | Low | Small addition to existing logic |
| 13-14: Client state & GameState | Low | Adding fields |

**Total**: Medium complexity - mostly following existing patterns with one moderately complex branching point (enterSiteCommand).
