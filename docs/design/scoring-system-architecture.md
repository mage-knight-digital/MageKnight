# Scoring System Architecture

This document defines the architecture for a flexible scoring system that handles all Mage Knight scenario scoring variations. It is the deliverable for issue #443.

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Scoring Patterns Analysis](#scoring-patterns-analysis)
3. [Architecture Design](#architecture-design)
4. [Type Definitions](#type-definitions)
5. [Implementation Strategy](#implementation-strategy)
6. [Decision: Issue #440 Scope](#decision-issue-440-scope)
7. [Implementation Tickets](#implementation-tickets)

---

## Problem Statement

Different scenarios have wildly different scoring rules:
- Some use standard achievements, some don't
- Some award titles, some don't
- Solo/co-op have different base score calculations
- Many scenarios add objective-specific bonuses
- Some scenarios don't use scoring at all (victory by position/condition)

We need an architecture that lets scenarios compose scoring rules without duplicating logic.

---

## Scoring Patterns Analysis

### Pattern 1: Base Score Mode

Determines how the initial score is calculated.

| Mode | Calculation | Scenarios |
|------|-------------|-----------|
| `individual_fame` | Each player's own Fame | Competitive scenarios |
| `lowest_fame` | Minimum Fame across all players | Co-op scenarios |
| `none` | Fame is not part of final score | Alternative victory conditions |

### Pattern 2: Standard Achievements

Six categories with base calculation + optional title bonuses:

| Category | Base Calculation | Title Bonus | Tie Bonus |
|----------|------------------|-------------|-----------|
| Greatest Knowledge | +2/Spell, +1/Advanced Action | +3 | +1 |
| Greatest Loot | +2/Artifact, +1 per 2 crystals | +3 | +1 |
| Greatest Leader | +1/unit level (wounded=half) | +3 | +1 |
| Greatest Conqueror | +2/shield on keep/tower/monastery | +3 | +1 |
| Greatest Adventurer | +2/shield on adventure site | +3 | +1 |
| Greatest Beating | -2/wound in deck | -3 | -1 |

**Achievement Mode Variations:**

| Mode | Behavior | Used By |
|------|----------|---------|
| `competitive` | Award titles, compare all players | Most multiplayer scenarios |
| `solo` | Calculate base scores, no titles | Solo scenarios |
| `coop_best_only` | Score only best player per category, no titles | Co-op scenarios |

### Pattern 3: City Conquest Module

Used by conquest scenarios for city-specific scoring.

| Rule | Points | Notes |
|------|--------|-------|
| City you lead | +7 Fame | Player with most shields on city |
| City with your shield (not leader) | +4 Fame | Participating but not leading |
| Greatest City Conqueror title | +5 (+2 tied) | Multiplayer only |

### Pattern 4: Time/Efficiency Bonuses

Used primarily by solo/co-op scenarios.

| Condition | Points | Notes |
|-----------|--------|-------|
| Finished N rounds early | +30/round | Before round limit |
| Cards left in Dummy deck | +1/card | Solo scenarios |
| End of Round not announced | +5 | Round ended naturally |

### Pattern 5: Objective Completion

Generic system for scenario-specific objectives.

| Type | Example | Points |
|------|---------|--------|
| Per objective | Per city conquered | +10 each |
| All completed bonus | All cities conquered | +15 bonus |
| Participation bonus | Every player leads a city | +10 bonus |

### Pattern 6: Site-Specific Variants

Some scenarios modify standard achievement calculations.

| Scenario | Modification |
|----------|--------------|
| Mine Liberation | +4/mine on Countryside, +7/mine on Core, Greatest Liberator title |
| Dungeon Lords | Dungeons/tombs count as 4 pts (not 2), Greatest Dungeon Crawler title |

### Pattern 7: Alternative Victory (No Scoring)

Some scenarios don't use scoring at all.

| Scenario | Victory Condition |
|----------|-------------------|
| Keeps & Towers | Victory points (keeps=3, towers=2) |
| Portal Race | First to reach portal wins |

### Pattern 8: Volkare Multipliers

Unique multiplicative scoring.

| Component | Calculation |
|-----------|-------------|
| Base bonus | 30/40/50 by Combat level |
| Cards remaining | +2/card in Volkare's deck |
| Difficulty multiplier | ×1/×1.5/×2 by Race level |

---

## Architecture Design

### Core Principle: Composable Modules

The scoring system uses a **module composition pattern**. Each scenario configures:

1. **Base score mode** - How to derive starting score from Fame
2. **Achievement configuration** - Standard achievements with mode and overrides
3. **Scoring modules** - Additional scenario-specific scoring components

This allows scenarios to mix and match scoring components without code duplication.

### Scoring Flow

```
┌────────────────────────────────────────────────────────────────┐
│                     calculateFinalScores()                      │
├────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Calculate Base Scores                                       │
│     └─ Based on baseScoreMode (individual/lowest/none)          │
│                                                                  │
│  2. Calculate Standard Achievements (if enabled)                │
│     ├─ For each category: calculate base score                  │
│     ├─ Determine winners based on mode                          │
│     └─ Award title bonuses (if competitive)                     │
│                                                                  │
│  3. Calculate Module Scores (for each enabled module)           │
│     └─ Each module returns { playerId → points } + breakdown    │
│                                                                  │
│  4. Combine All Scores                                          │
│     └─ Sum base + achievements + all modules per player         │
│                                                                  │
│  5. Determine Rankings                                          │
│     └─ Sort by total, apply tiebreakers                         │
│                                                                  │
└────────────────────────────────────────────────────────────────┘
```

### Module System

Each scoring module is self-contained and implements a standard interface:

```typescript
interface ScoringModule {
  readonly type: string;
  // Module-specific configuration
}

interface ModuleScoreResult {
  readonly moduleType: string;
  readonly playerScores: ReadonlyMap<string, number>;
  readonly breakdown: readonly ScoreBreakdownItem[];
}
```

Modules are pure functions: `(state: GameState, config: ModuleConfig) → ModuleScoreResult`

---

## Type Definitions

### Scenario Scoring Configuration

```typescript
// Base score calculation mode
const BASE_SCORE_INDIVIDUAL_FAME = "individual_fame" as const;
const BASE_SCORE_LOWEST_FAME = "lowest_fame" as const;
const BASE_SCORE_NONE = "none" as const;

type BaseScoreMode =
  | typeof BASE_SCORE_INDIVIDUAL_FAME
  | typeof BASE_SCORE_LOWEST_FAME
  | typeof BASE_SCORE_NONE;

// Achievement calculation mode
const ACHIEVEMENT_MODE_COMPETITIVE = "competitive" as const;
const ACHIEVEMENT_MODE_SOLO = "solo" as const;
const ACHIEVEMENT_MODE_COOP_BEST_ONLY = "coop_best_only" as const;

type AchievementMode =
  | typeof ACHIEVEMENT_MODE_COMPETITIVE
  | typeof ACHIEVEMENT_MODE_SOLO
  | typeof ACHIEVEMENT_MODE_COOP_BEST_ONLY;

// Standard achievement categories
const ACHIEVEMENT_GREATEST_KNOWLEDGE = "greatest_knowledge" as const;
const ACHIEVEMENT_GREATEST_LOOT = "greatest_loot" as const;
const ACHIEVEMENT_GREATEST_LEADER = "greatest_leader" as const;
const ACHIEVEMENT_GREATEST_CONQUEROR = "greatest_conqueror" as const;
const ACHIEVEMENT_GREATEST_ADVENTURER = "greatest_adventurer" as const;
const ACHIEVEMENT_GREATEST_BEATING = "greatest_beating" as const;

type AchievementCategory =
  | typeof ACHIEVEMENT_GREATEST_KNOWLEDGE
  | typeof ACHIEVEMENT_GREATEST_LOOT
  | typeof ACHIEVEMENT_GREATEST_LEADER
  | typeof ACHIEVEMENT_GREATEST_CONQUEROR
  | typeof ACHIEVEMENT_GREATEST_ADVENTURER
  | typeof ACHIEVEMENT_GREATEST_BEATING;
```

### Achievement Configuration

```typescript
interface AchievementCategoryOverride {
  /** Override points per item (e.g., 4 for dungeons in Dungeon Lords) */
  readonly pointsPerItem?: number;
  /** Override title name */
  readonly titleName?: string;
  /** Override title bonus */
  readonly titleBonus?: number;
  /** Override tie bonus */
  readonly tieBonus?: number;
  /** Site types to include (for Conqueror/Adventurer) */
  readonly includeSiteTypes?: readonly SiteType[];
}

interface AchievementsConfig {
  readonly enabled: boolean;
  readonly mode: AchievementMode;
  /** Category-specific overrides */
  readonly overrides?: Partial<Record<AchievementCategory, AchievementCategoryOverride>>;
}
```

### Scoring Modules

```typescript
// City Conquest Module
interface CityConquestModule {
  readonly type: "city_conquest";
  readonly leaderPoints: number;          // Default: 7
  readonly participantPoints: number;     // Default: 4
  readonly titleEnabled: boolean;
  readonly titleName: string;             // "Greatest City Conqueror"
  readonly titleBonus: number;            // Default: 5
  readonly tieBonus: number;              // Default: 2
}

// Time Efficiency Module (Solo/Co-op)
interface TimeEfficiencyModule {
  readonly type: "time_efficiency";
  readonly pointsPerEarlyRound: number;   // Default: 30
  readonly pointsPerDummyCard: number;    // Default: 1
  readonly bonusIfRoundNotAnnounced: number; // Default: 5
}

// Objective Completion Module
interface ObjectiveCompletionModule {
  readonly type: "objective_completion";
  readonly objectives: readonly {
    readonly id: string;
    readonly description: string;
    readonly pointsEach: number;
    readonly allCompletedBonus?: number;
    readonly everyPlayerParticipatedBonus?: number;
  }[];
}

// Mine Liberation Module
interface MineLiberationModule {
  readonly type: "mine_liberation";
  readonly pointsPerCountrysideMine: number;  // Default: 4
  readonly pointsPerCoreMine: number;         // Default: 7
  readonly titleEnabled: boolean;
  readonly titleName: string;                 // "Greatest Liberator"
  readonly titleBonus: number;                // Default: 5
  readonly tieBonus: number;                  // Default: 2
}

// Volkare Defeat Module
interface VolkareDefeatModule {
  readonly type: "volkare_defeat";
  readonly baseBonusByCombatLevel: readonly [number, number, number]; // [30, 40, 50]
  readonly pointsPerRemainingCard: number;    // Default: 2
  readonly multiplierByRaceLevel: readonly [number, number, number]; // [1, 1.5, 2]
}

// Victory Points Module (alternative to Fame)
interface VictoryPointsModule {
  readonly type: "victory_points";
  readonly sites: readonly {
    readonly siteType: SiteType;
    readonly points: number;
  }[];
}

type ScoringModuleConfig =
  | CityConquestModule
  | TimeEfficiencyModule
  | ObjectiveCompletionModule
  | MineLiberationModule
  | VolkareDefeatModule
  | VictoryPointsModule;
```

### Complete Scoring Configuration

```typescript
interface ScenarioScoringConfig {
  /** How to calculate base score from Fame */
  readonly baseScoreMode: BaseScoreMode;

  /** Standard achievements configuration */
  readonly achievements: AchievementsConfig;

  /** Additional scoring modules enabled for this scenario */
  readonly modules: readonly ScoringModuleConfig[];

  /** Tiebreaker rules (in order of precedence) */
  readonly tiebreakers?: readonly TiebreakerRule[];
}

type TiebreakerRule =
  | "highest_level"
  | "most_cards"
  | "fewest_wounds"
  | "most_crystals"
  | "first_to_finish";
```

### Score Results

```typescript
interface AchievementScoreResult {
  readonly category: AchievementCategory;
  readonly playerScores: ReadonlyMap<string, {
    readonly baseScore: number;
    readonly titleBonus: number;
    readonly total: number;
  }>;
  readonly winners: readonly string[];
  readonly isTied: boolean;
}

interface ModuleScoreResult {
  readonly moduleType: string;
  readonly playerScores: ReadonlyMap<string, number>;
  readonly breakdown: readonly {
    readonly playerId: string;
    readonly description: string;
    readonly points: number;
  }[];
}

interface FinalScoreResult {
  readonly playerRankings: readonly {
    readonly playerId: string;
    readonly rank: number;
    readonly baseScore: number;
    readonly achievementScore: number;
    readonly moduleScores: ReadonlyMap<string, number>;
    readonly totalScore: number;
  }[];
  readonly achievementResults: readonly AchievementScoreResult[];
  readonly moduleResults: readonly ModuleScoreResult[];
  readonly winner: string | null; // null for ties
  readonly isTied: boolean;
}
```

---

## Implementation Strategy

### File Structure

```
packages/
├── shared/src/
│   └── scoring/
│       ├── index.ts              # Re-exports
│       ├── types.ts              # All scoring type definitions
│       └── constants.ts          # Scoring constants (categories, modes)
│
├── core/src/
│   └── engine/
│       └── scoring/
│           ├── index.ts          # Main calculateFinalScores()
│           ├── baseScore.ts      # Base score calculation
│           ├── achievements/
│           │   ├── index.ts      # Achievement orchestration
│           │   ├── categories.ts # Category calculation functions
│           │   └── titles.ts     # Title determination logic
│           └── modules/
│               ├── index.ts      # Module dispatcher
│               ├── cityConquest.ts
│               ├── timeEfficiency.ts
│               ├── objectives.ts
│               ├── mineLiberation.ts
│               └── volkare.ts
│
└── client/src/
    └── components/
        └── scoring/
            ├── ScoreScreen.tsx        # End game score display
            ├── AchievementCard.tsx    # Achievement category display
            └── ScoreBreakdown.tsx     # Detailed score breakdown
```

### Integration Points

1. **ScenarioConfig Extension**: Add `scoringConfig: ScenarioScoringConfig` to `ScenarioConfig`
2. **Game End Trigger**: Call `calculateFinalScores()` when `gameEnded` becomes true
3. **GameEndedEvent**: Update event to include full `FinalScoreResult`
4. **Client State**: Add scoring results to client state for UI display

### Data Access Requirements

The scoring system needs read access to:

| Data | Location | Used For |
|------|----------|----------|
| Player Fame | `player.fame` | Base score |
| Player Cards | `player.hand + deck + discard` | Achievement calculations |
| Player Units | `player.units` | Greatest Leader |
| Player Crystals | `player.crystals` | Greatest Loot |
| Site Ownership | `hex.site.owner`, `hex.shieldTokens` | Conqueror/Adventurer |
| Card Types | `getCardDefinition(id).cardType` | Knowledge/Loot/Beating |
| Round Info | `state.round`, `state.totalRounds` | Time efficiency |
| City State | `state.cities[color].leaderId` | City conquest |

---

## Decision: Issue #440 Scope

**Decision: Issue #440 should implement Standard Achievements only.**

Rationale:
1. Standard achievements are the most commonly used scoring component
2. Other modules have scenario-specific variations that should be separate tickets
3. Keeps #440 at a reasonable scope (complexity:medium is accurate)
4. Architecture defined here enables future modules to be added incrementally

**Required updates to #440:**
- Update acceptance criteria to reference this architecture
- Add dependency on creating the shared scoring types (new ticket)
- Clarify that #440 implements the `achievements/` subfolder only

---

## Implementation Tickets

### Ticket 1: Scoring Type Definitions (shared/src/scoring)

**Title:** Add scoring system type definitions to shared package

**Description:**
Create the core type definitions for the scoring system as defined in this design document. This provides the foundation for all scoring implementations.

**Files to create:**
- `packages/shared/src/scoring/index.ts`
- `packages/shared/src/scoring/types.ts`
- `packages/shared/src/scoring/constants.ts`

**Acceptance Criteria:**
- [ ] All type definitions from "Type Definitions" section are implemented
- [ ] Types are exported from shared package
- [ ] No runtime code, types only
- [ ] Build passes

**Labels:** `feature`, `P1-high`, `complexity:low`

---

### Ticket 2: Standard Achievements Scoring (#440 - Update)

**Title:** Standard Achievements Scoring System

**Description:**
Implement the standard achievements scoring system. This is an update to existing ticket #440 to align with the architecture defined in this design document.

**Blocked by:** Ticket 1 (scoring types)

**Changes from original #440:**
- Use `AchievementsConfig` from shared types
- Implement `achievements/` subfolder structure
- Support all three achievement modes (competitive, solo, coop_best_only)
- Return `AchievementScoreResult[]` conforming to defined interface

**Labels:** `feature`, `P2-medium`, `complexity:medium`

---

### Ticket 3: Base Score Calculation

**Title:** Implement base score calculation from Fame

**Description:**
Implement the base score calculation that handles all three modes: individual_fame, lowest_fame, and none.

**Files to create:**
- `packages/core/src/engine/scoring/baseScore.ts`

**Acceptance Criteria:**
- [ ] `individual_fame` returns each player's Fame
- [ ] `lowest_fame` returns minimum Fame for all players
- [ ] `none` returns 0 for all players
- [ ] Unit tests for all modes

**Labels:** `feature`, `P2-medium`, `complexity:low`

---

### Ticket 4: Scoring System Orchestration

**Title:** Implement main scoring orchestration and module dispatcher

**Description:**
Create the main `calculateFinalScores()` function that orchestrates base score, achievements, and modules.

**Blocked by:** Tickets 1, 2, 3

**Files to create:**
- `packages/core/src/engine/scoring/index.ts`
- `packages/core/src/engine/scoring/modules/index.ts`

**Acceptance Criteria:**
- [ ] `calculateFinalScores()` combines all scoring components
- [ ] Module dispatcher routes to correct module calculator
- [ ] Returns complete `FinalScoreResult`
- [ ] Handles scenarios with no achievements/modules
- [ ] Integration test with First Reconnaissance

**Labels:** `feature`, `P1-high`, `complexity:medium`

---

### Ticket 5: City Conquest Scoring Module

**Title:** Implement city conquest scoring module

**Description:**
Implement the city conquest scoring module for scenarios like Full Conquest and Blitz Conquest.

**Blocked by:** Ticket 4 (orchestration)

**Files to create:**
- `packages/core/src/engine/scoring/modules/cityConquest.ts`

**Acceptance Criteria:**
- [ ] +7 points for city leadership
- [ ] +4 points for city participation (shield but not leader)
- [ ] Greatest City Conqueror title calculation
- [ ] Title bonuses (+5 winner, +2 tied)
- [ ] Unit tests

**Labels:** `feature`, `P2-medium`, `complexity:low`

---

### Ticket 6: Time Efficiency Scoring Module

**Title:** Implement time efficiency scoring module

**Description:**
Implement the time efficiency scoring module for solo/co-op scenarios.

**Blocked by:** Ticket 4 (orchestration)

**Files to create:**
- `packages/core/src/engine/scoring/modules/timeEfficiency.ts`

**Acceptance Criteria:**
- [ ] Points per round finished early
- [ ] Points per card in dummy deck
- [ ] Bonus if round ended naturally
- [ ] Unit tests

**Labels:** `feature`, `P2-medium`, `complexity:low`

---

### Ticket 7: Objective Completion Scoring Module

**Title:** Implement objective completion scoring module

**Description:**
Implement the generic objective completion scoring module.

**Blocked by:** Ticket 4 (orchestration)

**Files to create:**
- `packages/core/src/engine/scoring/modules/objectives.ts`

**Acceptance Criteria:**
- [ ] Points per completed objective
- [ ] All-completed bonus calculation
- [ ] Every-player-participated bonus
- [ ] Unit tests

**Labels:** `feature`, `P2-medium`, `complexity:low`

---

### Ticket 8: Scoring UI Components

**Title:** Create end-game scoring screen UI

**Description:**
Create React components to display final scores, achievements, and detailed breakdowns.

**Blocked by:** Ticket 4 (orchestration returns data to display)

**Files to create:**
- `packages/client/src/components/scoring/ScoreScreen.tsx`
- `packages/client/src/components/scoring/AchievementCard.tsx`
- `packages/client/src/components/scoring/ScoreBreakdown.tsx`

**Acceptance Criteria:**
- [ ] Display player rankings with total scores
- [ ] Show achievement categories with winners highlighted
- [ ] Expandable breakdown showing points by category
- [ ] Responsive design
- [ ] Handles tied scores gracefully

**Labels:** `feature`, `P2-medium`, `complexity:medium`, `area:ui`

---

### Ticket 9: ScenarioConfig Scoring Integration

**Title:** Add scoringConfig to ScenarioConfig and wire up game end

**Description:**
Extend ScenarioConfig with the new scoringConfig field and trigger scoring calculation on game end.

**Blocked by:** Ticket 4 (orchestration)

**Files to modify:**
- `packages/shared/src/scenarios.ts` - Add scoringConfig to interface
- `packages/core/src/data/scenarios/*.ts` - Add configs to existing scenarios
- `packages/core/src/engine/commands/endRoundCommand.ts` - Call scoring on game end
- `packages/shared/src/events/lifecycle/game.ts` - Update GameEndedEvent

**Acceptance Criteria:**
- [ ] ScenarioConfig has optional scoringConfig field
- [ ] First Reconnaissance has proper scoring config
- [ ] Full Conquest stub has scoring config
- [ ] Game end triggers scoring calculation
- [ ] GameEndedEvent includes full scoring results
- [ ] Existing tests still pass

**Labels:** `feature`, `P1-high`, `complexity:medium`

---

## Summary

This architecture provides:

1. **Flexibility**: Scenarios compose scoring rules from reusable modules
2. **Extensibility**: New modules can be added without changing existing code
3. **Type Safety**: Strong typing throughout with branded types
4. **Testability**: Pure functions make unit testing straightforward
5. **Separation of Concerns**: Calculation logic separate from display

The implementation is broken into 9 tickets that can be worked on incrementally, with clear dependencies between them.

---

## Related Issues

- #440 - Standard Achievements Scoring (to be updated)
- #89 - Scenarios Epic
- #442 - First Reconnaissance (will use this scoring system)
- #53 - Scenario End Game Flow (dependency for scoring trigger)
