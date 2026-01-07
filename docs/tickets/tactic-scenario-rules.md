# Scenario-Specific Tactic Rules

## Summary

Tactic card handling varies significantly between game modes (solo, co-op, competitive). The current implementation handles basic tactic selection and turn order but doesn't account for scenario-specific rules around tactic removal and dummy player behavior.

## Current State

- Basic tactic selection works (lowest Fame picks first)
- Turn order is determined by tactic number
- No scenario-specific tactic handling
- No dummy player tactic logic

## Required ScenarioConfig Additions

Add these fields to `ScenarioConfig` in `packages/shared/src/scenarios.ts`:

```typescript
// Tactic handling
readonly tacticRemovalMode: TacticRemovalMode;
readonly dummyPlayerTacticOrder: DummyTacticOrder;
```

### TacticRemovalMode

Defines what happens to tactics at end of each day/night:

| Mode | Description | Used In |
|------|-------------|---------|
| `none` | Tactics collected and re-displayed each round | Competitive multiplayer |
| `all_used` | All tactics used this round removed from game | Solo Conquest |
| `vote_one` | Players agree to remove ONE used tactic (not dummy's) | Cooperative Conquest |

### DummyTacticOrder

Defines when dummy player selects their tactic:

| Mode | Description | Used In |
|------|-------------|---------|
| `none` | No dummy player | Standard multiplayer |
| `after_humans` | Human picks first, dummy gets random from remaining | Solo Conquest |
| `before_humans` | Dummy gets random first, then humans choose | Cooperative Conquest |

## Implementation Tasks

### 1. Add types to shared package

```typescript
// packages/shared/src/scenarios.ts

export const TACTIC_REMOVAL_NONE = "none" as const;
export const TACTIC_REMOVAL_ALL_USED = "all_used" as const;
export const TACTIC_REMOVAL_VOTE_ONE = "vote_one" as const;

export type TacticRemovalMode =
  | typeof TACTIC_REMOVAL_NONE
  | typeof TACTIC_REMOVAL_ALL_USED
  | typeof TACTIC_REMOVAL_VOTE_ONE;

export const DUMMY_TACTIC_NONE = "none" as const;
export const DUMMY_TACTIC_AFTER_HUMANS = "after_humans" as const;
export const DUMMY_TACTIC_BEFORE_HUMANS = "before_humans" as const;

export type DummyTacticOrder =
  | typeof DUMMY_TACTIC_NONE
  | typeof DUMMY_TACTIC_AFTER_HUMANS
  | typeof DUMMY_TACTIC_BEFORE_HUMANS;
```

### 2. Update ScenarioConfig

Add the new fields with appropriate values for each scenario.

### 3. Track removed tactics in GameState

```typescript
// In GameState
readonly removedTactics: readonly TacticId[];
```

### 4. Update end-of-round logic

In `endRoundCommand.ts`, after round ends:

- If `tacticRemovalMode === 'all_used'`: Add all selected tactics to `removedTactics`
- If `tacticRemovalMode === 'vote_one'`: Trigger a new phase for players to vote on which tactic to remove
- If `tacticRemovalMode === 'none'`: Do nothing (current behavior)

### 5. Update tactic selection phase

- Filter `availableTactics` to exclude `removedTactics`
- Handle dummy player selection based on `dummyPlayerTacticOrder`

### 6. Add vote phase for co-op mode

New round phase `ROUND_PHASE_TACTIC_REMOVAL_VOTE` where co-op players must agree on which tactic to remove.

## Acceptance Criteria

- [ ] Solo Conquest: Player picks tactic, dummy gets random, both removed at end of day/night
- [ ] Cooperative: Dummy picks random first, players pick after, players vote to remove one at end
- [ ] Competitive: All tactics available each round (current behavior preserved)
- [ ] Removed tactics don't appear in subsequent rounds
- [ ] Each tactic used exactly once across the game in solo mode

## References

- Rulebook sections on Solo Conquest and Cooperative Conquest scenarios
- `packages/shared/src/scenarios.ts` - ScenarioConfig
- `packages/core/src/engine/commands/selectTacticCommand.ts` - Current selection logic
- `packages/core/src/engine/commands/endRoundCommand.ts` - End of round handling
