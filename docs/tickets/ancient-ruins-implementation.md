# Ticket: Ancient Ruins Site Implementation

**Created:** January 2025
**Updated:** January 2026
**Priority:** Medium
**Complexity:** Medium-High
**Status:** In Progress (Phase 1 Complete)
**Affects:** Core engine, shared types, map state, client rendering, rules fidelity
**Authoritative:** Yes

---

## Summary

Implement Ancient Ruins using yellow tokens per `docs/reference/sites.md`, replacing the current night-only brown enemy placeholder.

## Problem Statement

Ancient Ruins currently behave like a simplified night-only monster den. This is incorrect per the rulebook, which uses yellow tokens that can represent altars or specific enemy/reward packages with day/night visibility rules.

## Current Behavior (Before Implementation)

- Site defenders at reveal: 1 brown enemy at night, none during day.
- Entering ruins: draws/fights a brown enemy at night; day entry with no enemies auto-conquers.
- No yellow token pool, no altar tribute action, no token-specific rewards.

## Expected Behavior

- Ancient Ruins use yellow tokens to determine altar vs enemy encounters.
- Tokens are face up during day, face down during night; night tokens reveal on entry or next day.
- Altar: pay 3 mana of the token color to gain 7 Fame and conquer the site.
- Enemies: fight enemies listed on the token; on victory, gain the token-specific reward and conquer the site.

---

## Implementation Progress

### Phase 1: Token Display & Reveal ✅ COMPLETE

**Commit:** `4b9cd8b` feat: Add Ancient Ruins yellow token system with intro animation

#### Completed:
- [x] **Token definitions** (`packages/shared/src/ruinsTokens.ts`)
  - 5 altar tokens (blue, green, red, white, gold) - pay 3 mana for 7 fame + crystal
  - 10 enemy encounter tokens with specific enemies and rewards
  - Branded `RuinsTokenId` type for type safety

- [x] **Token pile management** (`packages/core/src/engine/helpers/ruinsTokenHelpers.ts`)
  - `RuinsTokenPiles` with draw/discard piles
  - `drawRuinsToken()` - draws and applies day/night visibility
  - `discardRuinsToken()` - returns token to discard pile
  - `shouldRuinsTokenBeRevealed()` - visibility based on time of day
  - `revealRuinsToken()` - reveals a face-down token

- [x] **Hex state** (`packages/core/src/types/map.ts`)
  - Added `RuinsToken` interface with `tokenId` and `isRevealed`
  - Added `ruinsToken: RuinsToken | null` to `HexState`

- [x] **Game state** (`packages/core/src/state/GameState.ts`)
  - Added `ruinsTokens: RuinsTokenPiles` to GameState

- [x] **Token placement** (`packages/core/src/engine/commands/exploreCommand.ts`)
  - Draws ruins token when tile with Ancient Ruins is revealed
  - Removed Ancient Ruins from `getSiteDefenders` (no longer uses brown enemies)

- [x] **Dawn transition** (`packages/core/src/engine/commands/endRoundCommand.ts`)
  - Reveals any face-down ruins tokens when night turns to day

- [x] **Client state filtering** (`packages/server/src/index.ts`)
  - `ClientRuinsToken` hides `tokenId` when unrevealed (prevents cheating)
  - Only revealed tokens send their identity to client

- [x] **Client rendering** (`packages/client/src/components/GameBoard/pixi/rendering/ruinsTokens.ts`)
  - Renders yellow tokens on Ancient Ruins hexes
  - Face-up shows token content, face-down shows yellow back
  - Intro drop animation matching enemy token style
  - Flip animation support for reveals

- [x] **Asset paths** (`packages/client/src/assets/assetPaths.ts`)
  - `getRuinsTokenFaceUrl(tokenId)` - individual token faces
  - `getRuinsTokenBackUrl()` - yellow back for unrevealed

#### Files Created:
- `packages/shared/src/ruinsTokens.ts`
- `packages/core/src/engine/helpers/ruinsTokenHelpers.ts`
- `packages/client/src/components/GameBoard/pixi/rendering/ruinsTokens.ts`

#### Files Modified:
- `packages/shared/src/types/clientState.ts` - Added `ClientRuinsToken`
- `packages/shared/src/index.ts` - Export ruins token types
- `packages/core/src/types/map.ts` - Added `RuinsToken` to hex state
- `packages/core/src/state/GameState.ts` - Added ruins token piles
- `packages/core/src/engine/commands/exploreCommand.ts` - Draw token on reveal
- `packages/core/src/engine/commands/endRoundCommand.ts` - Dawn reveal logic
- `packages/core/src/engine/helpers/enemyHelpers.ts` - Removed ruins from defenders
- `packages/server/src/index.ts` - Filter ruins token for client
- `packages/client/src/components/GameBoard/hooks/useGameBoardRenderer.ts` - Render tokens
- Various index.ts exports

---

### Phase 2: Site Interaction 🔲 NOT STARTED

#### TODO:
- [ ] **Reveal on entry** - If token is face-down at night, reveal it when player enters
- [ ] **Branch on token type** - Altar vs enemy encounter logic in `enterSiteCommand.ts`
- [ ] **Altar tribute action**
  - Player can pay 3 mana of token's color
  - Grants 7 fame + 1 crystal of that color
  - Conquers the site
- [ ] **Enemy encounter**
  - Spawn the specific enemies listed on the token (not drawn from enemy piles)
  - Standard combat resolution
  - On victory: grant token-specific reward + conquer site
- [ ] **Valid actions** - Update `validActions` to show altar tribute option
- [ ] **Client UI** - Display altar tribute option when applicable

#### Files to Modify:
- `packages/core/src/engine/commands/enterSiteCommand.ts`
- `packages/core/src/engine/validators/siteValidators.ts`
- `packages/core/src/engine/validActions/` - Add altar tribute action
- `packages/shared/src/playerActions.ts` - Add `ALTAR_TRIBUTE` action type (if separate)

---

### Phase 3: Rewards & Polish 🔲 NOT STARTED

#### TODO:
- [ ] **Token-specific rewards** - Map each enemy token to its reward (artifact, spell, AA, crystals)
- [ ] **Flip animation on entry** - Animate token reveal when entering at night
- [ ] **Tests** - Unit tests for token draw/visibility and integration tests for site interaction

---

## Scope

### In Scope
- Yellow token definitions and pool management.
- Hex state for ruins tokens (visibility + token id).
- Enter-site logic for altar vs enemy tokens.
- Rewards for token-specific outcomes.
- Token reveal rules for day/night.

### Out of Scope
- Lost Legion yellow tokens (design should be extensible).
- UI polish beyond exposing the token state.

## Open Questions

- [x] How should UI display face-down ruins tokens to players at night?
  - **Resolved:** Show yellow back image, hide tokenId from client state
- [ ] Should altar tribute be a separate player action type or handled inside enter-site?
  - Leaning toward handling inside enter-site with a choice prompt

## Acceptance Criteria

- [x] Ruins use yellow tokens, not brown enemy tokens, for both day and night.
- [x] Day/night reveal rules match `docs/reference/sites.md`.
- [ ] Altar tribute spends 3 mana of the token color and grants 7 Fame + crystal.
- [ ] Enemy tokens spawn the correct enemies and rewards.

## Test Plan

### Manual
1. [x] Reveal Ancient Ruins during day; confirm token is face up and visible.
2. [x] Reveal Ancient Ruins during night; confirm token is face down until entry or day.
3. [ ] Enter altar ruins; pay mana and gain 7 Fame + crystal; site is conquered.
4. [ ] Enter enemy ruins; resolve combat; reward matches token; conquest on victory.

### Automated
- [ ] Add unit tests for token draw/reshuffle and visibility rules.
- [ ] Update `enemiesOnMap`/`enterSite` tests to cover ruins token cases.
