/**
 * Tests for the Wings of Wind / Wings of Night spell (White Spell #23)
 *
 * Basic (Wings of Wind): Spend 1-5 move points and fly one space per point.
 *   Flight ignores terrain costs (all terrain costs 1).
 *   Does not provoke rampaging enemies.
 *   Cannot explore tiles during flight.
 *
 * Powered (Wings of Night): Target enemy does not attack this combat.
 *   Additional enemies cost increasing move points (0, 1, 2, 3...).
 *   No effect on Arcane Immune enemies.
 */

import { describe, it, expect } from "vitest";
import {
  resolveEffect,
  isEffectResolvable,
  describeEffect,
} from "../effects/index.js";
import type {
  WingsOfNightEffect,
  ResolveWingsOfNightTargetEffect,
} from "../../types/cards.js";
import {
  CATEGORY_MOVEMENT,
  CATEGORY_COMBAT,
  DEED_CARD_TYPE_SPELL,
} from "../../types/cards.js";
import {
  EFFECT_WINGS_OF_NIGHT,
  EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
  EFFECT_NOOP,
} from "../../types/effectTypes.js";
import {
  CARD_WINGS_OF_WIND,
  MANA_BLACK,
  MANA_WHITE,
  ENEMY_DIGGERS,
  ENEMY_SORCERERS,
  ENEMIES,
} from "@mage-knight/shared";
import type { GameState } from "../../state/GameState.js";
import type { CombatState, CombatEnemy } from "../../types/combat.js";
import { COMBAT_PHASE_BLOCK, COMBAT_CONTEXT_STANDARD } from "../../types/combat.js";
import { WINGS_OF_WIND } from "../../data/spells/white/wingsOfWind.js";
import { getSpellCard } from "../../data/spells/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import {
  EFFECT_ENEMY_SKIP_ATTACK,
  SCOPE_ONE_ENEMY,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";

// ============================================================================
// TEST HELPERS
// ============================================================================

function createCombatEnemy(
  instanceId: string,
  enemyId: string,
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  const definition = ENEMIES[enemyId as keyof typeof ENEMIES];
  if (!definition) {
    throw new Error(`Unknown enemy: ${enemyId}`);
  }
  return {
    instanceId,
    enemyId: enemyId as CombatEnemy["enemyId"],
    definition,
    isBlocked: false,
    isDefeated: false,
    damageAssigned: false,
    isRequiredForConquest: true,
    ...overrides,
  };
}

function createCombatStateWithEnemies(
  enemies: CombatEnemy[]
): CombatState {
  return {
    enemies,
    phase: COMBAT_PHASE_BLOCK,
    woundsThisCombat: 0,
    attacksThisPhase: 0,
    fameGained: 0,
    isAtFortifiedSite: false,
    unitsAllowed: true,
    nightManaRules: false,
    assaultOrigin: null,
    combatHexCoord: null,
    allDamageBlockedThisPhase: false,
    discardEnemiesOnFailure: false,
    pendingDamage: {},
    pendingBlock: {},
    pendingSwiftBlock: {},
    combatContext: COMBAT_CONTEXT_STANDARD,
    cumbersomeReductions: {},
    usedDefend: {},
    defendBonuses: {},
    paidHeroesAssaultInfluence: false,
    vampiricArmorBonus: {},
    paidThugsDamageInfluence: {},
    damageRedirects: {},
  };
}

function createCombatGameState(
  enemies: CombatEnemy[],
  movePoints = 0
): GameState {
  const player = createTestPlayer({
    id: "player1",
    movePoints,
  });
  return createTestGameState({
    players: [player],
    combat: createCombatStateWithEnemies(enemies),
  });
}

function getPlayer(state: GameState) {
  return state.players.find((p) => p.id === "player1")!;
}

// ============================================================================
// SPELL CARD DEFINITION TESTS
// ============================================================================

describe("Wings of Wind spell card definition", () => {
  it("should be registered in spell cards", () => {
    const card = getSpellCard(CARD_WINGS_OF_WIND);
    expect(card).toBeDefined();
    expect(card?.name).toBe("Wings of Wind");
  });

  it("should have correct metadata", () => {
    expect(WINGS_OF_WIND.id).toBe(CARD_WINGS_OF_WIND);
    expect(WINGS_OF_WIND.name).toBe("Wings of Wind");
    expect(WINGS_OF_WIND.poweredName).toBe("Wings of Night");
    expect(WINGS_OF_WIND.cardType).toBe(DEED_CARD_TYPE_SPELL);
    expect(WINGS_OF_WIND.sidewaysValue).toBe(1);
  });

  it("should be powered by black + white mana", () => {
    expect(WINGS_OF_WIND.poweredBy).toEqual([MANA_BLACK, MANA_WHITE]);
  });

  it("should have movement category for basic effect", () => {
    expect(WINGS_OF_WIND.categories).toEqual([CATEGORY_MOVEMENT]);
  });

  it("should have combat category for powered effect", () => {
    expect(WINGS_OF_WIND.poweredEffectCategories).toEqual([CATEGORY_COMBAT]);
  });

  it("should have basic effect with 5 flight options", () => {
    const basicEffect = WINGS_OF_WIND.basicEffect;
    expect(basicEffect.type).toBe("choice");
    if (basicEffect.type === "choice") {
      expect(basicEffect.options).toHaveLength(5);
    }
  });

  it("should have powered effect of type EFFECT_WINGS_OF_NIGHT", () => {
    const poweredEffect = WINGS_OF_WIND.poweredEffect;
    expect(poweredEffect.type).toBe(EFFECT_WINGS_OF_NIGHT);
  });
});

// ============================================================================
// BASIC EFFECT (WINGS OF WIND) TESTS
// ============================================================================

describe("Wings of Wind basic effect (flight)", () => {
  it("should present a choice with 5 flight options", () => {
    const basicEffect = WINGS_OF_WIND.basicEffect;
    // The basic effect is a CHOICE with 5 options (resolved via pendingChoice, not dynamicChoiceOptions)
    expect(basicEffect.type).toBe("choice");
    if (basicEffect.type === "choice") {
      expect(basicEffect.options).toHaveLength(5);
    }

    const state = createTestGameState();
    const result = resolveEffect(state, "player1", basicEffect);
    expect(result.requiresChoice).toBe(true);
  });

  it("each flight option should be a compound of move + modifiers", () => {
    const basicEffect = WINGS_OF_WIND.basicEffect;
    if (basicEffect.type === "choice") {
      for (let i = 0; i < basicEffect.options.length; i++) {
        const option = basicEffect.options[i]!;
        expect(option.type).toBe("compound");
        if (option.type === "compound") {
          // First effect should be GainMove
          expect(option.effects[0]!.type).toBe("gain_move");
          if (option.effects[0]!.type === "gain_move") {
            expect(option.effects[0]!.amount).toBe(i + 1);
          }
          // Should have flight modifiers (terrain cost, no provoke, no explore)
          const modifiers = option.effects.filter(
            (e) => e.type === "apply_modifier"
          );
          expect(modifiers.length).toBe(3);
        }
      }
    }
  });

  it("flight option 3 should grant 3 move points with flight modifiers", () => {
    const state = createTestGameState();
    const basicEffect = WINGS_OF_WIND.basicEffect;

    // Pick option index 2 (3 move points) directly from the choice options
    if (basicEffect.type !== "choice") throw new Error("Expected choice effect");
    const option3 = basicEffect.options[2]!;
    const resolveResult = resolveEffect(state, "player1", option3);

    const player = getPlayer(resolveResult.state);
    expect(player.movePoints).toBe(4 + 3); // default 4 + 3 from flight
  });
});

// ============================================================================
// POWERED EFFECT (WINGS OF NIGHT) TESTS
// ============================================================================

describe("EFFECT_WINGS_OF_NIGHT (powered)", () => {
  const poweredEffect: WingsOfNightEffect = {
    type: EFFECT_WINGS_OF_NIGHT,
  };

  describe("isEffectResolvable", () => {
    it("should be resolvable in combat with eligible enemies", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);
      expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(true);
    });

    it("should NOT be resolvable when not in combat", () => {
      const state = createTestGameState();
      expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
    });

    it("should NOT be resolvable when all enemies are defeated", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS, { isDefeated: true }),
      ]);
      expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
    });

    it("should NOT be resolvable when all enemies are Arcane Immune", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS),
      ]);
      expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(false);
    });

    it("should be resolvable with mix of arcane immune and non-immune enemies", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // arcane immune
        createCombatEnemy("enemy_1", ENEMY_DIGGERS), // not immune
      ]);
      expect(isEffectResolvable(state, "player1", poweredEffect)).toBe(true);
    });
  });

  describe("enemy selection", () => {
    it("should present eligible enemies as choices", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2);

      const options = result.dynamicChoiceOptions as ResolveWingsOfNightTargetEffect[];
      expect(options[0]!.type).toBe(EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET);
      expect(options[0]!.moveCost).toBe(0); // first target is free
    });

    it("should exclude Arcane Immune enemies from choices", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_SORCERERS), // arcane immune
        createCombatEnemy("enemy_1", ENEMY_DIGGERS), // not immune
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const options = result.dynamicChoiceOptions as ResolveWingsOfNightTargetEffect[];
      expect(options[0]!.enemyInstanceId).toBe("enemy_1");
    });

    it("should exclude defeated enemies from choices", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS, { isDefeated: true }),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(1);

      const options = result.dynamicChoiceOptions as ResolveWingsOfNightTargetEffect[];
      expect(options[0]!.enemyInstanceId).toBe("enemy_1");
    });

    it("should not offer 'Done' option for the first target", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
      ]);

      const result = resolveEffect(state, "player1", poweredEffect);

      expect(result.dynamicChoiceOptions).toHaveLength(1);
      // No NOOP option
      const hasNoop = result.dynamicChoiceOptions!.some(
        (opt) => opt.type === EFFECT_NOOP
      );
      expect(hasNoop).toBe(false);
    });
  });

  describe("not in combat", () => {
    it("should return early when not in combat", () => {
      const state = createTestGameState();

      const result = resolveEffect(state, "player1", poweredEffect);

      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toContain("Not in combat");
    });
  });
});

// ============================================================================
// RESOLVE WINGS OF NIGHT TARGET TESTS
// ============================================================================

describe("EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET", () => {
  describe("first target (free)", () => {
    it("should apply skip attack modifier to selected enemy", () => {
      const state = createCombatGameState([
        createCombatEnemy("enemy_0", ENEMY_DIGGERS),
        createCombatEnemy("enemy_1", ENEMY_DIGGERS),
      ]);

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_0",
        enemyName: "Diggers",
        moveCost: 0,
        targetCount: 1,
      };

      const result = resolveEffect(state, "player1", effect);

      // Should have applied the skip attack modifier
      const skipModifiers = result.state.activeModifiers.filter(
        (m) =>
          m.effect.type === EFFECT_ENEMY_SKIP_ATTACK &&
          m.scope.type === SCOPE_ONE_ENEMY &&
          m.scope.enemyId === "enemy_0"
      );
      expect(skipModifiers).toHaveLength(1);
    });

    it("should not deduct move points for first target", () => {
      const state = createCombatGameState(
        [createCombatEnemy("enemy_0", ENEMY_DIGGERS)],
        5 // give 5 move points
      );

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_0",
        enemyName: "Diggers",
        moveCost: 0,
        targetCount: 1,
      };

      const result = resolveEffect(state, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.movePoints).toBe(5); // unchanged
    });

    it("should chain to offer more targets if available", () => {
      const state = createCombatGameState(
        [
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ],
        5
      );

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_0",
        enemyName: "Diggers",
        moveCost: 0,
        targetCount: 1,
      };

      const result = resolveEffect(state, "player1", effect);

      // Should chain and offer second enemy + Done option
      expect(result.requiresChoice).toBe(true);
      expect(result.dynamicChoiceOptions).toHaveLength(2); // enemy_1 + Done

      const options = result.dynamicChoiceOptions!;
      const enemyOption = options.find(
        (opt) => opt.type === EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET
      ) as ResolveWingsOfNightTargetEffect;
      expect(enemyOption.enemyInstanceId).toBe("enemy_1");
      expect(enemyOption.moveCost).toBe(1); // second target costs 1 move

      // Should include Done option
      const noopOption = options.find((opt) => opt.type === EFFECT_NOOP);
      expect(noopOption).toBeDefined();
    });
  });

  describe("second target (costs 1 move)", () => {
    it("should deduct 1 move point for second target", () => {
      // Set up state where first enemy is already targeted
      const state = createCombatGameState(
        [
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ],
        5
      );

      // Simulate first target already applied by adding modifier
      const stateWithFirstTarget: GameState = {
        ...state,
        activeModifiers: [
          ...state.activeModifiers,
          {
            source: {
              type: SOURCE_CARD,
              cardId: "wings_of_wind" as any,
              playerId: "player1",
            },
            duration: "combat" as any,
            scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
            effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
            createdAtRound: state.round,
            createdByPlayerId: "player1",
          },
        ],
      };

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_1",
        enemyName: "Diggers",
        moveCost: 1,
        targetCount: 2,
      };

      const result = resolveEffect(stateWithFirstTarget, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.movePoints).toBe(4); // 5 - 1
    });

    it("should fail if not enough move points", () => {
      const state = createCombatGameState(
        [
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
        ],
        0 // no move points
      );

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_1",
        enemyName: "Diggers",
        moveCost: 1,
        targetCount: 2,
      };

      const result = resolveEffect(state, "player1", effect);

      // Should fail — not enough move points
      expect(result.description).toContain("Not enough move points");
    });
  });

  describe("scaling move cost", () => {
    it("third target should cost 2 move points", () => {
      const state = createCombatGameState(
        [
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
          createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        ],
        10
      );

      // Simulate two already targeted
      const stateWithTargets: GameState = {
        ...state,
        activeModifiers: [
          ...state.activeModifiers,
          {
            source: {
              type: SOURCE_CARD,
              cardId: "wings_of_wind" as any,
              playerId: "player1",
            },
            duration: "combat" as any,
            scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_0" },
            effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
            createdAtRound: state.round,
            createdByPlayerId: "player1",
          },
          {
            source: {
              type: SOURCE_CARD,
              cardId: "wings_of_wind" as any,
              playerId: "player1",
            },
            duration: "combat" as any,
            scope: { type: SCOPE_ONE_ENEMY, enemyId: "enemy_1" },
            effect: { type: EFFECT_ENEMY_SKIP_ATTACK },
            createdAtRound: state.round,
            createdByPlayerId: "player1",
          },
        ],
      };

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_2",
        enemyName: "Diggers",
        moveCost: 2,
        targetCount: 3,
      };

      const result = resolveEffect(stateWithTargets, "player1", effect);

      const player = getPlayer(result.state);
      expect(player.movePoints).toBe(8); // 10 - 2
    });
  });

  describe("no more targets available", () => {
    it("should not chain when all enemies are targeted", () => {
      const state = createCombatGameState(
        [createCombatEnemy("enemy_0", ENEMY_DIGGERS)],
        5
      );

      const effect: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_0",
        enemyName: "Diggers",
        moveCost: 0,
        targetCount: 1,
      };

      const result = resolveEffect(state, "player1", effect);

      // Only one enemy, so no continuation
      expect(result.requiresChoice).toBeUndefined();
      expect(result.description).toContain("does not attack");
    });
  });

  describe("move cost gating on continuation", () => {
    it("should not chain to third target if player lacks move points", () => {
      // Player has 1 move point. After targeting enemy_0 (free) and enemy_1 (costs 1),
      // no move points left for enemy_2 (would cost 2).
      const state = createCombatGameState(
        [
          createCombatEnemy("enemy_0", ENEMY_DIGGERS),
          createCombatEnemy("enemy_1", ENEMY_DIGGERS),
          createCombatEnemy("enemy_2", ENEMY_DIGGERS),
        ],
        1 // only 1 move point
      );

      // Step 1: select first target (free)
      const effect1: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_0",
        enemyName: "Diggers",
        moveCost: 0,
        targetCount: 1,
      };
      const result1 = resolveEffect(state, "player1", effect1);

      // Should chain and offer second enemy (costs 1 move) + Done
      expect(result1.requiresChoice).toBe(true);
      const secondOptions = result1.dynamicChoiceOptions!.filter(
        (opt) => opt.type === EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET
      ) as ResolveWingsOfNightTargetEffect[];
      expect(secondOptions.length).toBe(2); // enemy_1 and enemy_2

      // Step 2: select second target (costs 1 move, player has 1 → 0 remaining)
      const effect2: ResolveWingsOfNightTargetEffect = {
        type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
        enemyInstanceId: "enemy_1",
        enemyName: "Diggers",
        moveCost: 1,
        targetCount: 2,
      };
      const result2 = resolveEffect(result1.state, "player1", effect2);

      // After spending 1 move, player has 0.
      // Third target would cost 2 move — can't afford.
      // So the continuation should not offer enemy_2.
      expect(result2.requiresChoice).toBeUndefined();
      expect(result2.description).toContain("does not attack");
    });
  });
});

// ============================================================================
// DESCRIBE EFFECT TESTS
// ============================================================================

describe("describeEffect for Wings of Night effects", () => {
  it("should describe EFFECT_WINGS_OF_NIGHT", () => {
    const effect: WingsOfNightEffect = { type: EFFECT_WINGS_OF_NIGHT };
    const desc = describeEffect(effect);
    expect(desc).toContain("skip");
    expect(desc).toContain("attack");
  });

  it("should describe EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET without move cost", () => {
    const effect: ResolveWingsOfNightTargetEffect = {
      type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
      enemyInstanceId: "enemy_0",
      enemyName: "Diggers",
      moveCost: 0,
      targetCount: 1,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Diggers");
    expect(desc).toContain("does not attack");
    expect(desc).not.toContain("Move");
  });

  it("should describe EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET with move cost", () => {
    const effect: ResolveWingsOfNightTargetEffect = {
      type: EFFECT_RESOLVE_WINGS_OF_NIGHT_TARGET,
      enemyInstanceId: "enemy_1",
      enemyName: "Orc Summoner",
      moveCost: 2,
      targetCount: 3,
    };
    const desc = describeEffect(effect);
    expect(desc).toContain("Orc Summoner");
    expect(desc).toContain("2 Move");
  });
});
