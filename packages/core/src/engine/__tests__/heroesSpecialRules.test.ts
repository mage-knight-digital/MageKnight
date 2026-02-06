/**
 * Heroes Special Rules tests
 *
 * Tests for the Heroes unit's special recruitment and combat rules:
 * - AC #1: Reputation counts double when recruiting Heroes
 * - AC #2: Cannot recruit Heroes and Thugs in same interaction
 * - AC #3: Heroes cannot use abilities in fortified site assaults without 2 Influence payment
 * - AC #4: Damage can still be assigned to Heroes during assaults (even without payment)
 * - AC #5: Special recruitment rules don't apply for artifact/spell recruitment
 */

import { describe, it, expect, beforeEach } from "vitest";
import { createEngine } from "../MageKnightEngine.js";
import {
  createTestGameState,
  createTestPlayer,
  createUnitCombatState,
} from "./testHelpers.js";
import {
  RECRUIT_UNIT_ACTION,
  UNIT_HEROES,
  UNIT_HERO_BLUE,
  UNIT_THUGS,
  UNIT_PEASANTS,
  INVALID_ACTION,
  ACTIVATE_UNIT_ACTION,
  ASSIGN_DAMAGE_ACTION,
  DAMAGE_TARGET_UNIT,
  PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
  HEROES_ASSAULT_INFLUENCE_PAID,
  hexKey,
  TERRAIN_PLAINS,
} from "@mage-knight/shared";
import type { PlayerUnit } from "../../types/unit.js";
import { createPlayerUnit } from "../../types/unit.js";
import { resetUnitInstanceCounter } from "../commands/units/index.js";
import { SiteType, TileId } from "../../types/map.js";
import {
  COMBAT_PHASE_ATTACK,
  COMBAT_PHASE_ASSIGN_DAMAGE,
} from "../../types/combat.js";
import {
  getReputationCostModifier,
  violatesHeroesThugsExclusion,
  hasRecruitedHeroThisInteraction,
} from "../rules/unitRecruitment.js";
import { validateHeroesAssaultRestriction } from "../validators/units/activationValidators.js";
import type { CombatState } from "../../types/combat.js";
import { getCombatOptions } from "../validActions/combat.js";

/**
 * Create a Heroes unit for testing damage assignment.
 * Since Heroes has no abilities defined in the base game (they vary by card),
 * we use the base createPlayerUnit for damage tests.
 */
function createHeroesUnit(instanceId: string): PlayerUnit {
  return createPlayerUnit(UNIT_HEROES, instanceId);
}

/**
 * Create a combat state for assault testing
 */
function createAssaultCombatState(
  phase: typeof COMBAT_PHASE_ATTACK | typeof COMBAT_PHASE_ASSIGN_DAMAGE,
  isAtFortifiedSite: boolean,
  assaultOrigin: { q: number; r: number } | null,
  paidHeroesAssaultInfluence: boolean = false
): CombatState {
  const base = createUnitCombatState(phase, isAtFortifiedSite, assaultOrigin);
  return {
    ...base,
    paidHeroesAssaultInfluence,
  };
}

describe("Heroes Special Rules", () => {
  let engine: ReturnType<typeof createEngine>;

  beforeEach(() => {
    engine = createEngine();
    resetUnitInstanceCounter();
  });

  describe("AC #1: Reputation counts double for Heroes recruitment", () => {
    describe("getReputationCostModifier", () => {
      it("should double positive reputation modifier for Heroes", () => {
        // At reputation +3, base modifier is -2 (saves 2 influence)
        // For Heroes, it should be -4 (saves 4 influence)
        const normalModifier = getReputationCostModifier(3);
        const heroesModifier = getReputationCostModifier(3, UNIT_HEROES);

        expect(normalModifier).toBe(-2);
        expect(heroesModifier).toBe(-4);
      });

      it("should double negative reputation modifier for Heroes", () => {
        // At reputation -3, base modifier is +2 (costs 2 more influence)
        // For Heroes, it should be +4 (costs 4 more influence)
        const normalModifier = getReputationCostModifier(-3);
        const heroesModifier = getReputationCostModifier(-3, UNIT_HEROES);

        expect(normalModifier).toBe(2);
        expect(heroesModifier).toBe(4);
      });

      it("should not double modifier for non-Heroes units", () => {
        const peasantsModifier = getReputationCostModifier(3, UNIT_PEASANTS);
        const thugsModifier = getReputationCostModifier(3, UNIT_THUGS);

        expect(peasantsModifier).toBe(-2);
        // Thugs have reversed reputation: +3 rep gives +2 modifier (more expensive)
        expect(thugsModifier).toBe(2);
      });

      it("should double maximum reputation modifier (+7) for Heroes", () => {
        // At +7, base modifier is -5
        // For Heroes, it should be -10
        const heroesModifier = getReputationCostModifier(7, UNIT_HEROES);
        expect(heroesModifier).toBe(-10);
      });

      it("should double minimum reputation modifier (-7) for Heroes", () => {
        // At -7, base modifier is +5
        // For Heroes, it should be +10
        const heroesModifier = getReputationCostModifier(-7, UNIT_HEROES);
        expect(heroesModifier).toBe(10);
      });

      it("should return 0 for reputation 0 regardless of unit", () => {
        expect(getReputationCostModifier(0)).toBe(0);
        expect(getReputationCostModifier(0, UNIT_HEROES)).toBe(0);
        expect(getReputationCostModifier(0, UNIT_PEASANTS)).toBe(0);
      });

      it("should not double modifier if Hero already recruited this interaction", () => {
        // The doubled modifier only applies to the FIRST Hero recruited
        const firstHeroModifier = getReputationCostModifier(3, UNIT_HEROES, false);
        const secondHeroModifier = getReputationCostModifier(3, UNIT_HEROES, true);

        expect(firstHeroModifier).toBe(-4); // Doubled
        expect(secondHeroModifier).toBe(-2); // Not doubled (already recruited one)
      });

      it("should double modifier for Hero Blue same as Heroes", () => {
        const heroBlueModifier = getReputationCostModifier(3, UNIT_HERO_BLUE);
        expect(heroBlueModifier).toBe(-4); // Same doubled modifier as UNIT_HEROES
      });
    });

    describe("reputation modifier integration", () => {
      it("should apply doubled modifier when recruiting Heroes with positive reputation", () => {
        // Create a state with a village and units offer that includes Heroes
        // Heroes base cost is 9, not 7
        const player = createTestPlayer({
          position: { q: 0, r: 0 },
          units: [],
          commandTokens: 2,
          reputation: 5, // Base modifier -3, doubled for Heroes = -6
          influencePoints: 10, // Heroes base cost is 9, with -6 modifier = 3
        });

        const hexWithVillage = {
          coord: { q: 0, r: 0 },
          terrain: TERRAIN_PLAINS,
          tileId: TileId.StartingTileA,
          site: {
            type: SiteType.Village,
            owner: null,
            isConquered: false,
            isBurned: false,
          },
          enemies: [],
          shieldTokens: [],
          rampagingEnemies: [],
        };

        const state = createTestGameState({
          players: [player],
          map: {
            hexes: {
              [hexKey({ q: 0, r: 0 })]: hexWithVillage,
            },
            tiles: [],
            tileDeck: { countryside: [], core: [] },
          },
          offers: {
            units: [UNIT_HEROES],
            advancedActions: [],
            spells: [],
            artifacts: [],
          },
        });

        // Try to recruit Heroes with cost accounting for doubled modifier
        // Heroes base cost 9, reputation +5 = -3 base modifier, doubled = -6
        // So effective cost = 9 - 6 = 3
        const result = engine.processAction(state, "player1", {
          type: RECRUIT_UNIT_ACTION,
          unitId: UNIT_HEROES,
          influenceSpent: 3,
        });

        // Should succeed - Heroes recruited
        const hasHeroes = result.state.players[0].units.some(
          (u) => u.unitId === UNIT_HEROES
        );
        expect(hasHeroes).toBe(true);
      });

      it("should apply doubled modifier when recruiting Heroes with negative reputation", () => {
        // Heroes base cost is 9
        const player = createTestPlayer({
          position: { q: 0, r: 0 },
          units: [],
          commandTokens: 2,
          reputation: -5, // Base modifier +3, doubled for Heroes = +6
          influencePoints: 20, // Heroes base cost is 9, with +6 modifier = 15
        });

        const hexWithVillage = {
          coord: { q: 0, r: 0 },
          terrain: TERRAIN_PLAINS,
          tileId: TileId.StartingTileA,
          site: {
            type: SiteType.Village,
            owner: null,
            isConquered: false,
            isBurned: false,
          },
          enemies: [],
          shieldTokens: [],
          rampagingEnemies: [],
        };

        const state = createTestGameState({
          players: [player],
          map: {
            hexes: {
              [hexKey({ q: 0, r: 0 })]: hexWithVillage,
            },
            tiles: [],
            tileDeck: { countryside: [], core: [] },
          },
          offers: {
            units: [UNIT_HEROES],
            advancedActions: [],
            spells: [],
            artifacts: [],
          },
        });

        // Try to recruit Heroes with cost accounting for doubled modifier
        // Heroes base cost 9, reputation -5 = +3 base modifier, doubled = +6
        // So effective cost = 9 + 6 = 15
        const result = engine.processAction(state, "player1", {
          type: RECRUIT_UNIT_ACTION,
          unitId: UNIT_HEROES,
          influenceSpent: 15,
        });

        // Should succeed - Heroes recruited
        const hasHeroes = result.state.players[0].units.some(
          (u) => u.unitId === UNIT_HEROES
        );
        expect(hasHeroes).toBe(true);
      });
    });
  });

  describe("AC #2: Cannot recruit Heroes and Thugs in same interaction", () => {
    describe("violatesHeroesThugsExclusion", () => {
      it("should block Heroes if Thugs already recruited", () => {
        const result = violatesHeroesThugsExclusion(UNIT_HEROES, [UNIT_THUGS]);
        expect(result).toBe(true);
      });

      it("should block Thugs if Heroes already recruited", () => {
        const result = violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_HEROES]);
        expect(result).toBe(true);
      });

      it("should allow Heroes if no conflicting unit recruited", () => {
        const result = violatesHeroesThugsExclusion(UNIT_HEROES, [UNIT_PEASANTS]);
        expect(result).toBe(false);
      });

      it("should allow Thugs if no conflicting unit recruited", () => {
        const result = violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_PEASANTS]);
        expect(result).toBe(false);
      });

      it("should allow non-conflicting units regardless of prior recruitment", () => {
        expect(violatesHeroesThugsExclusion(UNIT_PEASANTS, [UNIT_HEROES])).toBe(false);
        expect(violatesHeroesThugsExclusion(UNIT_PEASANTS, [UNIT_THUGS])).toBe(false);
      });

      it("should allow recruiting same type multiple times", () => {
        // Can recruit multiple Heroes if no Thugs
        expect(violatesHeroesThugsExclusion(UNIT_HEROES, [UNIT_HEROES])).toBe(false);
        // Can recruit multiple Thugs if no Heroes
        expect(violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_THUGS])).toBe(false);
      });

      it("should block Thugs if Hero Blue already recruited", () => {
        expect(violatesHeroesThugsExclusion(UNIT_THUGS, [UNIT_HERO_BLUE])).toBe(true);
      });

      it("should block Hero Blue if Thugs already recruited", () => {
        expect(violatesHeroesThugsExclusion(UNIT_HERO_BLUE, [UNIT_THUGS])).toBe(true);
      });
    });

    describe("hasRecruitedHeroThisInteraction", () => {
      it("should return true if Heroes in recruited list", () => {
        expect(hasRecruitedHeroThisInteraction([UNIT_HEROES])).toBe(true);
        expect(hasRecruitedHeroThisInteraction([UNIT_PEASANTS, UNIT_HEROES])).toBe(true);
      });

      it("should return true if Hero Blue in recruited list", () => {
        expect(hasRecruitedHeroThisInteraction([UNIT_HERO_BLUE])).toBe(true);
        expect(hasRecruitedHeroThisInteraction([UNIT_PEASANTS, UNIT_HERO_BLUE])).toBe(true);
      });

      it("should return false if no Heroes in recruited list", () => {
        expect(hasRecruitedHeroThisInteraction([])).toBe(false);
        expect(hasRecruitedHeroThisInteraction([UNIT_PEASANTS])).toBe(false);
        expect(hasRecruitedHeroThisInteraction([UNIT_THUGS])).toBe(false);
      });
    });

    describe("recruitment integration", () => {
      it("should reject Thugs recruitment after Heroes", () => {
        const player = createTestPlayer({
          position: { q: 0, r: 0 },
          units: [],
          commandTokens: 3,
          influencePoints: 20,
          unitsRecruitedThisInteraction: [UNIT_HEROES], // Already recruited Heroes
        });

        const hexWithVillage = {
          coord: { q: 0, r: 0 },
          terrain: TERRAIN_PLAINS,
          tileId: TileId.StartingTileA,
          site: {
            type: SiteType.Village,
            owner: null,
            isConquered: false,
            isBurned: false,
          },
          enemies: [],
          shieldTokens: [],
          rampagingEnemies: [],
        };

        const state = createTestGameState({
          players: [player],
          map: {
            hexes: {
              [hexKey({ q: 0, r: 0 })]: hexWithVillage,
            },
            tiles: [],
            tileDeck: { countryside: [], core: [] },
          },
          offers: {
            units: [UNIT_THUGS],
            advancedActions: [],
            spells: [],
            artifacts: [],
          },
        });

        // Thugs base cost is 5
        const result = engine.processAction(state, "player1", {
          type: RECRUIT_UNIT_ACTION,
          unitId: UNIT_THUGS,
          influenceSpent: 5,
        });

        // Should be rejected
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Heroes");
          expect(invalidEvent.reason).toContain("Thugs");
        }
      });

      it("should reject Heroes recruitment after Thugs", () => {
        const player = createTestPlayer({
          position: { q: 0, r: 0 },
          units: [],
          commandTokens: 3,
          influencePoints: 20,
          unitsRecruitedThisInteraction: [UNIT_THUGS], // Already recruited Thugs
        });

        const hexWithVillage = {
          coord: { q: 0, r: 0 },
          terrain: TERRAIN_PLAINS,
          tileId: TileId.StartingTileA,
          site: {
            type: SiteType.Village,
            owner: null,
            isConquered: false,
            isBurned: false,
          },
          enemies: [],
          shieldTokens: [],
          rampagingEnemies: [],
        };

        const state = createTestGameState({
          players: [player],
          map: {
            hexes: {
              [hexKey({ q: 0, r: 0 })]: hexWithVillage,
            },
            tiles: [],
            tileDeck: { countryside: [], core: [] },
          },
          offers: {
            units: [UNIT_HEROES],
            advancedActions: [],
            spells: [],
            artifacts: [],
          },
        });

        // Heroes base cost is 9
        const result = engine.processAction(state, "player1", {
          type: RECRUIT_UNIT_ACTION,
          unitId: UNIT_HEROES,
          influenceSpent: 9,
        });

        // Should be rejected
        const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
        expect(invalidEvent).toBeDefined();
        if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
          expect(invalidEvent.reason).toContain("Heroes");
          expect(invalidEvent.reason).toContain("Thugs");
        }
      });
    });
  });

  describe("AC #3: Heroes assault restrictions", () => {
    describe("validateHeroesAssaultRestriction (unit tests)", () => {
      it("should reject Heroes activation during fortified assault without payment", () => {
        // Create Heroes unit
        const heroesUnit = createHeroesUnit("heroes_1");
        const player = createTestPlayer({
          units: [heroesUnit],
          commandTokens: 2,
        });

        // Create state with fortified site assault
        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          true, // Fortified site
          { q: -1, r: 0 }, // Assault origin (indicates assault, not defense)
          false // Not paid
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const action = {
          type: ACTIVATE_UNIT_ACTION as const,
          unitInstanceId: "heroes_1",
          abilityIndex: 0,
        };

        const result = validateHeroesAssaultRestriction(state, "player1", action);

        expect(result.valid).toBe(false);
        if (!result.valid) {
          expect(result.error.message).toContain("Heroes");
          expect(result.error.message).toContain("Influence");
        }
      });

      it("should allow Heroes activation after paying 2 influence", () => {
        const heroesUnit = createHeroesUnit("heroes_1");
        const player = createTestPlayer({
          units: [heroesUnit],
          commandTokens: 2,
        });

        // Create state with assault, payment MADE
        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          true,
          { q: -1, r: 0 },
          true // Paid
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const action = {
          type: ACTIVATE_UNIT_ACTION as const,
          unitInstanceId: "heroes_1",
          abilityIndex: 0,
        };

        const result = validateHeroesAssaultRestriction(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should allow Heroes activation at non-fortified site without payment", () => {
        const heroesUnit = createHeroesUnit("heroes_1");
        const player = createTestPlayer({
          units: [heroesUnit],
          commandTokens: 2,
        });

        // Non-fortified combat
        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          false, // Not fortified
          null,
          false
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const action = {
          type: ACTIVATE_UNIT_ACTION as const,
          unitInstanceId: "heroes_1",
          abilityIndex: 0,
        };

        const result = validateHeroesAssaultRestriction(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should allow Heroes activation when defending fortified site (not assault)", () => {
        const heroesUnit = createHeroesUnit("heroes_1");
        const player = createTestPlayer({
          units: [heroesUnit],
          commandTokens: 2,
        });

        // Fortified site but NOT assault (assaultOrigin null = defending)
        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          true, // Fortified site
          null, // No assault origin = defending
          false
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const action = {
          type: ACTIVATE_UNIT_ACTION as const,
          unitInstanceId: "heroes_1",
          abilityIndex: 0,
        };

        const result = validateHeroesAssaultRestriction(state, "player1", action);

        expect(result.valid).toBe(true);
      });

      it("should allow non-Heroes units during assault without payment", () => {
        // Thugs unit - not Heroes
        const thugsUnit = createPlayerUnit(UNIT_THUGS, "thugs_1");
        const player = createTestPlayer({
          units: [thugsUnit],
          commandTokens: 2,
        });

        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          true,
          { q: -1, r: 0 },
          false // Not paid - but shouldn't matter for non-Heroes
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const action = {
          type: ACTIVATE_UNIT_ACTION as const,
          unitInstanceId: "thugs_1",
          abilityIndex: 0,
        };

        const result = validateHeroesAssaultRestriction(state, "player1", action);

        expect(result.valid).toBe(true);
      });
    });

    describe("PAY_HEROES_ASSAULT_INFLUENCE_ACTION", () => {
      it("should pay 2 influence and update combat state", () => {
        const player = createTestPlayer({
          influencePoints: 5,
        });

        const combatState = createAssaultCombatState(
          COMBAT_PHASE_ATTACK,
          true,
          { q: -1, r: 0 },
          false
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const result = engine.processAction(state, "player1", {
          type: PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
        });

        // Verify payment was recorded
        expect(result.state.combat?.paidHeroesAssaultInfluence).toBe(true);
        expect(result.state.players[0].influencePoints).toBe(3); // 5 - 2

        // Check for payment event
        const paymentEvent = result.events.find(
          (e) => e.type === HEROES_ASSAULT_INFLUENCE_PAID
        );
        expect(paymentEvent).toBeDefined();
      });

      it("should reject payment when not in assault combat", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      // Non-assault combat
      const combatState = createUnitCombatState(
        COMBAT_PHASE_ATTACK,
        false, // Not fortified
        null // No assault
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
      });

      // Should be rejected - not an assault
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
    });

    it("should reject payment when already paid", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      // Assault combat with payment already made
      const combatState = {
        ...createUnitCombatState(COMBAT_PHASE_ATTACK, true, { q: -1, r: 0 }),
        paidHeroesAssaultInfluence: true,
      };

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
      });

      // Should be rejected - already paid
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("already");
      }
    });

    it("should reject payment when insufficient influence", () => {
      const player = createTestPlayer({
        influencePoints: 1, // Not enough (need 2)
      });

      const combatState = createUnitCombatState(
        COMBAT_PHASE_ATTACK,
        true,
        { q: -1, r: 0 }
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: PAY_HEROES_ASSAULT_INFLUENCE_ACTION,
      });

      // Should be rejected - insufficient influence
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent && invalidEvent.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("influence");
      }
    });
    });
  });

  describe("AC #4: Damage can be assigned to Heroes during assault", () => {
    it("should allow assigning damage to Heroes during assault without payment", () => {
      // Heroes unit ready to take damage
      const heroesUnit = createHeroesUnit("heroes_1");
      const player = createTestPlayer({
        units: [heroesUnit],
        commandTokens: 2,
      });

      // Fortified site assault in assign damage phase
      const combatState = createAssaultCombatState(
        COMBAT_PHASE_ASSIGN_DAMAGE,
        true, // Fortified site
        { q: -1, r: 0 }, // Assault origin
        false // Not paid - but damage should still be assignable
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          {
            target: DAMAGE_TARGET_UNIT,
            unitInstanceId: "heroes_1",
            amount: 3, // Diggers attack is 3
          },
        ],
      });

      // Should succeed - damage assignment to Heroes is always allowed
      // Heroes should be wounded
      expect(result.state.players[0].units[0].wounded).toBe(true);

      // No invalid action event
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeUndefined();
    });

    it("should allow assigning damage to Heroes even with paidHeroesAssaultInfluence false", () => {
      const heroesUnit = createHeroesUnit("heroes_1");
      const player = createTestPlayer({
        units: [heroesUnit],
        commandTokens: 2,
        influencePoints: 0, // No influence to pay
      });

      // Assault combat, payment NOT made
      const combatState = createAssaultCombatState(
        COMBAT_PHASE_ASSIGN_DAMAGE,
        true,
        { q: -1, r: 0 },
        false
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const result = engine.processAction(state, "player1", {
        type: ASSIGN_DAMAGE_ACTION,
        enemyInstanceId: "enemy_1",
        assignments: [
          {
            target: DAMAGE_TARGET_UNIT,
            unitInstanceId: "heroes_1",
            amount: 3,
          },
        ],
      });

      // Should succeed - damage assignment is separate from ability activation
      expect(result.state.players[0].units[0].wounded).toBe(true);
    });
  });

  describe("FAQ clarifications", () => {
    it("should track unitsRecruitedThisInteraction correctly", () => {
      // Peasants cost 4, Heroes cost 9 (base)
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        units: [],
        commandTokens: 3,
        reputation: 0,
        influencePoints: 20,
        unitsRecruitedThisInteraction: [], // Fresh interaction
      });

      const hexWithVillage = {
        coord: { q: 0, r: 0 },
        terrain: TERRAIN_PLAINS,
        tileId: TileId.StartingTileA,
        site: {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        },
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };

      const state = createTestGameState({
        players: [player],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithVillage,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
        offers: {
          units: [UNIT_PEASANTS, UNIT_HEROES],
          advancedActions: [],
          spells: [],
          artifacts: [],
        },
      });

      // First recruit Peasants (cost 4)
      const afterFirstRecruit = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_PEASANTS,
        influenceSpent: 4,
      });

      // unitsRecruitedThisInteraction should track Peasants
      expect(afterFirstRecruit.state.players[0].unitsRecruitedThisInteraction).toContain(
        UNIT_PEASANTS
      );

      // Now recruit Heroes (cost 9)
      const afterSecondRecruit = engine.processAction(afterFirstRecruit.state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_HEROES,
        influenceSpent: 9,
      });

      // Both should be tracked
      expect(afterSecondRecruit.state.players[0].unitsRecruitedThisInteraction).toContain(
        UNIT_PEASANTS
      );
      expect(afterSecondRecruit.state.players[0].unitsRecruitedThisInteraction).toContain(
        UNIT_HEROES
      );
    });

    it("doubled reputation applies only to first Hero recruited in interaction", () => {
      // With high reputation, first Hero gets doubled discount, second doesn't
      // Heroes base cost is 9
      const player = createTestPlayer({
        position: { q: 0, r: 0 },
        units: [],
        commandTokens: 3,
        reputation: 5, // Base -3, doubled = -6 for first Hero
        influencePoints: 50,
        unitsRecruitedThisInteraction: [],
      });

      const hexWithVillage = {
        coord: { q: 0, r: 0 },
        terrain: TERRAIN_PLAINS,
        tileId: TileId.StartingTileA,
        site: {
          type: SiteType.Village,
          owner: null,
          isConquered: false,
          isBurned: false,
        },
        enemies: [],
        shieldTokens: [],
        rampagingEnemies: [],
      };

      const state = createTestGameState({
        players: [player],
        map: {
          hexes: {
            [hexKey({ q: 0, r: 0 })]: hexWithVillage,
          },
          tiles: [],
          tileDeck: { countryside: [], core: [] },
        },
        offers: {
          units: [UNIT_HEROES, UNIT_HEROES], // Two Heroes in offer
          advancedActions: [],
          spells: [],
          artifacts: [],
        },
      });

      // First Hero: base 9, doubled modifier -6 = cost 3
      const afterFirstHero = engine.processAction(state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_HEROES,
        influenceSpent: 3,
      });

      // Should succeed
      const firstHeroRecruited = afterFirstHero.state.players[0].units.filter(
        (u) => u.unitId === UNIT_HEROES
      ).length;
      expect(firstHeroRecruited).toBe(1);

      // Influence should be 50 - 3 = 47
      expect(afterFirstHero.state.players[0].influencePoints).toBe(47);

      // Second Hero: base 9, regular modifier -3 = cost 6 (not doubled)
      const afterSecondHero = engine.processAction(afterFirstHero.state, "player1", {
        type: RECRUIT_UNIT_ACTION,
        unitId: UNIT_HEROES,
        influenceSpent: 6,
      });

      // Should succeed
      const secondHeroRecruited = afterSecondHero.state.players[0].units.filter(
        (u) => u.unitId === UNIT_HEROES
      ).length;
      expect(secondHeroRecruited).toBe(2);

      // Influence should be 47 - 6 = 41
      expect(afterSecondHero.state.players[0].influencePoints).toBe(41);
    });
  });

  describe("ValidActions for Heroes assault influence", () => {
    it("should expose canPayHeroesAssaultInfluence during fortified assault", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      const combatState = createAssaultCombatState(
        COMBAT_PHASE_ATTACK,
        true, // Fortified
        { q: -1, r: 0 }, // Assault origin
        false // Not paid yet
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const options = getCombatOptions(state);

      expect(options).toBeDefined();
      expect(options?.canPayHeroesAssaultInfluence).toBe(true);
      expect(options?.heroesAssaultInfluenceCost).toBe(2);
      expect(options?.heroesAssaultInfluencePaid).toBe(false);
    });

    it("should not expose Heroes assault fields for non-fortified combat", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      const combatState = createUnitCombatState(
        COMBAT_PHASE_ATTACK,
        false, // Not fortified
        null // Not an assault
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const options = getCombatOptions(state);

      expect(options).toBeDefined();
      // These fields should be undefined (not present) for non-assault combat
      expect(options?.canPayHeroesAssaultInfluence).toBeUndefined();
      expect(options?.heroesAssaultInfluenceCost).toBeUndefined();
      expect(options?.heroesAssaultInfluencePaid).toBeUndefined();
    });

    it("should set canPayHeroesAssaultInfluence to false after payment", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      const combatState = createAssaultCombatState(
        COMBAT_PHASE_ATTACK,
        true,
        { q: -1, r: 0 },
        true // Already paid
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const options = getCombatOptions(state);

      expect(options).toBeDefined();
      expect(options?.canPayHeroesAssaultInfluence).toBe(false);
      expect(options?.heroesAssaultInfluencePaid).toBe(true);
    });

    it("should set canPayHeroesAssaultInfluence to false when insufficient influence", () => {
      const player = createTestPlayer({
        influencePoints: 1, // Not enough (need 2)
      });

      const combatState = createAssaultCombatState(
        COMBAT_PHASE_ATTACK,
        true,
        { q: -1, r: 0 },
        false
      );

      const state = createTestGameState({
        players: [player],
        combat: combatState,
      });

      const options = getCombatOptions(state);

      expect(options).toBeDefined();
      expect(options?.canPayHeroesAssaultInfluence).toBe(false);
      expect(options?.heroesAssaultInfluencePaid).toBe(false);
    });

    it("should expose Heroes assault fields during all combat phases", () => {
      const player = createTestPlayer({
        influencePoints: 5,
      });

      // Test multiple phases
      const phases = [
        COMBAT_PHASE_ATTACK,
        COMBAT_PHASE_ASSIGN_DAMAGE,
      ] as const;

      for (const phase of phases) {
        const combatState = createAssaultCombatState(
          phase,
          true,
          { q: -1, r: 0 },
          false
        );

        const state = createTestGameState({
          players: [player],
          combat: combatState,
        });

        const options = getCombatOptions(state);

        expect(options?.heroesAssaultInfluenceCost).toBe(2);
        expect(options?.heroesAssaultInfluencePaid).toBe(false);
      }
    });
  });
});
