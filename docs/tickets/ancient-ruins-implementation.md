# Ancient Ruins Site Implementation

## Summary

Implement the full Ancient Ruins site mechanics using yellow tokens. Currently the site has placeholder logic that draws a brown enemy at night only. The real rules use a separate yellow token pool that determines whether the ruins contain an altar (pay mana for fame) or enemies (fight for token-specific rewards).

## Background

Ancient Ruins is unique among adventure sites:
- Uses **yellow tokens** - a completely separate token pool from enemy tokens
- Two distinct interaction modes: altar tribute vs combat
- Rewards vary per token rather than being fixed for the site type
- Token visibility differs based on time of day (face-up during day, face-down at night)

### Rules Reference (from `docs/reference/sites.md`)

> **When Revealed:** Place a yellow token here face up if it is Day, face down if it is Night. A face down token is revealed at the start of the next Day Round, or if someone enters the space.
>
> **While Unconquered:** You can enter the ancient ruins as your action for the turn. There will either be an altar there, or enemies to fight.
>
> **Altar:** You can pay 3 mana of the color shown on the yellow token as tribute to the altar. If you do, mark the space with a Shield token and gain 7 Fame as your reward.
>
> **Enemies:** Draw the enemies depicted on the yellow token and fight them. Any undefeated enemies remain on the space and can be fought later. If you defeat the last enemy here, mark the space with a Shield token and get the reward depicted on the yellow token.

---

## Current State

### What Exists

- `SiteType.AncientRuins` defined in `core/src/types/map.ts:112`
- Site properties in `core/src/data/siteProperties.ts:60-65`
- Placeholder in `enterSiteCommand.ts` (draws brown enemy at night only)
- `FameReward` type in `shared/src/siteRewards.ts:76-79`
- Ancient Ruins on tiles: Countryside 8, 10, 11; Core 2, 3, 4; City 5

### What's Missing

1. Yellow token data structure and definitions
2. Yellow token pool management (draw/shuffle/discard)
3. `HexState.ruinsToken` field
4. Altar tribute action (pay mana → gain fame)
5. Modified `enterSiteCommand` for altar vs enemy logic
6. Token-specific enemies and rewards
7. Visibility rules (face-up/down based on time of day)
8. Events for yellow token lifecycle
9. Valid actions for altar tribute
10. Validators for new actions

---

## Yellow Token Data

### Base Game Tokens (8 total)

**Altar Tokens (4):**

| Token ID | Mana Color | Reward |
|----------|------------|--------|
| `altar_red` | Red | 7 Fame |
| `altar_blue` | Blue | 7 Fame |
| `altar_green` | Green | 7 Fame |
| `altar_white` | White | 7 Fame |

**Enemy Tokens (4):**

| Token ID | Enemies | Reward |
|----------|---------|--------|
| `ruins_gargoyles` | 1 Gargoyle (brown) | Artifact |
| `ruins_medusa` | 1 Medusa (brown) | Spell |
| `ruins_werewolf` | 1 Werewolf (brown) | 4 Crystals (1 each color) |
| `ruins_golems` | 2 Golems (brown) | Advanced Action |

*Lost Legion expansion adds more tokens - defer for now, design for extensibility.*

---

## Implementation Plan

### Phase 1: Yellow Token Data Types (shared)

**New file: `packages/shared/src/ruinsTokens.ts`**

```typescript
// Token type discriminator
export const RUINS_TOKEN_TYPE_ALTAR = "altar" as const;
export const RUINS_TOKEN_TYPE_ENEMY = "enemy" as const;

export type RuinsTokenType =
  | typeof RUINS_TOKEN_TYPE_ALTAR
  | typeof RUINS_TOKEN_TYPE_ENEMY;

// Mana color for altars (basic colors only)
export type AltarManaColor = "red" | "blue" | "green" | "white";

// Branded type for token IDs
export type RuinsTokenId = string & { readonly __brand: "RuinsTokenId" };

// Altar token definition
export interface AltarToken {
  readonly type: typeof RUINS_TOKEN_TYPE_ALTAR;
  readonly id: RuinsTokenId;
  readonly manaColor: AltarManaColor;
  readonly tributeCost: 3;
  readonly fameReward: 7;
}

// Enemy token definition
export interface EnemyRuinsToken {
  readonly type: typeof RUINS_TOKEN_TYPE_ENEMY;
  readonly id: RuinsTokenId;
  readonly enemies: readonly EnemyId[];
  readonly reward: SiteReward;
}

export type RuinsToken = AltarToken | EnemyRuinsToken;

export const RUINS_TOKENS: Record<RuinsTokenId, RuinsToken>;
```

### Phase 2: Yellow Token Pool Management (core)

**New file: `packages/core/src/types/ruinsTokens.ts`**

```typescript
export interface RuinsTokenPools {
  readonly drawPile: readonly RuinsTokenId[];
  readonly discardPile: readonly RuinsTokenId[];
}
```

**New file: `packages/core/src/engine/helpers/ruinsTokenHelpers.ts`**

- `createRuinsTokenPools(rng)` - Initialize shuffled pool
- `drawRuinsToken(pools, rng)` - Draw from pool, reshuffle if needed
- `discardRuinsToken(pools, tokenId)` - Return to discard

### Phase 3: Map State Updates

**Update: `packages/core/src/types/map.ts`**

Add to `HexState`:
```typescript
readonly ruinsToken?: {
  readonly tokenId: RuinsTokenId;
  readonly isRevealed: boolean;
};
```

**Update: `packages/shared/src/types/clientState.ts`**

Add to `ClientHexState`:
```typescript
readonly ruinsToken?: {
  readonly isRevealed: boolean;
  readonly tokenId?: RuinsTokenId;
  readonly tokenType?: RuinsTokenType;
  readonly altarColor?: AltarManaColor;
  readonly enemies?: readonly EnemyId[];
  readonly reward?: SiteReward;
};
```

### Phase 4: Tile Reveal Updates

**Update: `packages/core/src/engine/commands/exploreCommand.ts`**

When revealing a tile with Ancient Ruins:
1. Draw yellow token from pool
2. Set visibility based on time of day
3. Place token on hex

### Phase 5: New Events (shared)

**New file: `packages/shared/src/events/sites/ruins.ts`**

```typescript
export const RUINS_TOKEN_PLACED = "RUINS_TOKEN_PLACED" as const;
export const RUINS_TOKEN_REVEALED = "RUINS_TOKEN_REVEALED" as const;
export const ALTAR_TRIBUTE_PAID = "ALTAR_TRIBUTE_PAID" as const;
```

### Phase 6: New PlayerAction

**Update: `packages/shared/src/actions/playerActions.ts`**

```typescript
export const PAY_ALTAR_TRIBUTE = "PAY_ALTAR_TRIBUTE" as const;
export interface PayAltarTributeAction {
  readonly type: typeof PAY_ALTAR_TRIBUTE;
  readonly manaSource: ManaCost[];
}
```

### Phase 7: Altar Tribute Command

**New file: `packages/core/src/engine/commands/payAltarTributeCommand.ts`**

- Validate player at ruins with altar token
- Validate mana payment (3 of correct color)
- Deduct mana, grant 7 fame
- Mark site conquered, discard token
- Irreversible (fame gained)

### Phase 8: Update enterSiteCommand

**Update: `packages/core/src/engine/commands/enterSiteCommand.ts`**

For Ancient Ruins:
1. Reveal token if face-down
2. If altar → no combat (player can pay tribute separately)
3. If enemy → draw specific enemies from token, start combat

### Phase 9: Validators

**New file: `packages/core/src/engine/validators/ruinsValidators.ts`**

- `validatePayAltarTribute()` - player at ruins, has altar token, has mana

**Update: `packages/core/src/engine/validators/siteValidators.ts`**

- Update `canEnterSite` for ruins

### Phase 10: Valid Actions

**Update: `packages/core/src/engine/validActions/sites.ts`**

Add `PayAltarTribute` when:
- At Ancient Ruins with revealed altar token
- Has 3 mana of required color
- Site not conquered, hasn't taken action

### Phase 11: Conquest Rewards

**Update: `packages/core/src/engine/commands/conquerSiteCommand.ts`**

For Ancient Ruins:
- Altar → fame already granted via tribute
- Enemies → token-specific reward

### Phase 12: Round Start Token Reveal

**Update round start logic**

At Day round start, reveal face-down yellow tokens.

### Phase 13: Client State Filtering

**Update: `packages/server/src/index.ts`**

In `toClientState()`:
- Always show token exists
- Only include details if revealed

### Phase 14: GameState Updates

**Update: `packages/core/src/state/GameState.ts`**

Add `ruinsTokenPools: RuinsTokenPools`

---

## File Summary

### New Files

| File | Package | Description |
|------|---------|-------------|
| `ruinsTokens.ts` | shared | Token types and definitions |
| `events/sites/ruins.ts` | shared | Ruins-specific events |
| `types/ruinsTokens.ts` | core | Token pool types |
| `helpers/ruinsTokenHelpers.ts` | core | Pool management |
| `commands/payAltarTributeCommand.ts` | core | Tribute command |
| `validators/ruinsValidators.ts` | core | Ruins validation |

### Modified Files

| File | Changes |
|------|---------|
| `shared/src/actions/playerActions.ts` | Add `PAY_ALTAR_TRIBUTE` |
| `shared/src/types/clientState.ts` | Add `ruinsToken` to hex |
| `core/src/types/map.ts` | Add `ruinsToken` to `HexState` |
| `core/src/state/GameState.ts` | Add `ruinsTokenPools` |
| `core/src/engine/commands/exploreCommand.ts` | Draw token on reveal |
| `core/src/engine/commands/enterSiteCommand.ts` | Altar vs enemy logic |
| `core/src/engine/commands/conquerSiteCommand.ts` | Token rewards |
| `core/src/engine/validators/siteValidators.ts` | Ruins validation |
| `core/src/engine/validActions/sites.ts` | Tribute valid action |
| `server/src/index.ts` | Filter ruins token |

---

## Testing

### Unit Tests

1. **`ruinsTokenHelpers.test.ts`**
   - Pool initialization
   - Draw from pool
   - Reshuffle on empty

2. **`payAltarTributeCommand.test.ts`**
   - Valid payment
   - Insufficient/wrong mana rejection
   - Fame granted, site conquered

3. **`enterSiteCommand.test.ts`** (extend)
   - Altar → no combat
   - Enemy → correct enemies drawn
   - Face-down revealed on entry

4. **`ruinsValidators.test.ts`**
   - All validation cases

### Integration Tests

1. Reveal tile → enter ruins → pay tribute → conquest
2. Reveal tile → enter ruins → fight enemies → conquest
3. Night reveal → day start reveals token
4. Multiple ruins with pool management

---

## Open Questions

1. **Lost Legion tokens**: Defer for now, design for extensibility
2. **Enemy drawing**: Draw specific enemy type per token (faithful to rules)
3. **Multiple players**: First successful tribute conquers

---

## IMPORTANT: Enemies Are NOT Rampaging

When enemies are drawn for Ancient Ruins (from yellow enemy tokens like `ruins_gargoyles`, `ruins_golems`, etc.), they are **NOT considered rampaging enemies** even if the creature type would normally be rampaging.

**Implementation requirement:**
- Place enemies in `hex.enemies[]` only
- Do NOT populate `hex.rampagingEnemies[]`
- Player must use `ENTER_SITE_ACTION` to fight them
- Player CANNOT challenge them from an adjacent hex

**Why this matters:**
The "Challenge Rampaging Enemies" feature (see `challenge-rampaging-enemies.md`) allows players to fight rampaging enemies from an adjacent hex. The validation checks `hex.rampagingEnemies.length > 0`, NOT the enemy creature type.

Ancient Ruins enemies like Golems (which are normally a rampaging type) should NOT be challengeable from adjacent because they were drawn for the site, not placed as rampaging enemies on the map.

**Test coverage:** See `combatPositionValidation.test.ts` for tests documenting this edge case.

---

## Acceptance Criteria

- [ ] Yellow token pool initializes with 8 base game tokens
- [ ] Tile reveal places yellow token (face-up day, face-down night)
- [ ] Face-down tokens reveal at day start
- [ ] Entering ruins with altar allows paying tribute
- [ ] Paying 3 mana of correct color grants 7 fame and conquers site
- [ ] Entering ruins with enemies starts combat with token-specified enemies
- [ ] Defeating enemies grants token-specified reward
- [ ] Client state correctly filters unrevealed token info
- [ ] All existing tests pass
- [ ] New unit tests for all new functionality
