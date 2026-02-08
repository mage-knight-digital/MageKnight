/**
 * Soul Harvester Tests
 *
 * Tests for:
 * - Card definition (properties, effect structure)
 * - Crystal color options based on enemy resistances
 * - Basic effect: Attack 3 + crystal for one defeated enemy
 * - Powered effect: Attack 8 + crystal per defeated enemy
 * - Summoned enemies excluded from crystal reward
 * - Modifier consumed after phase resolution
 * - Crystal overflow when at max
 */

import { describe, it, expect } from "vitest";
import type { CombatEnemy } from "../../types/combat.js";
import {
  CARD_SOUL_HARVESTER,
  ENEMY_DIGGERS,
  ELEMENT_PHYSICAL,
  RESIST_FIRE,
  RESIST_ICE,
  RESIST_PHYSICAL,
} from "@mage-knight/shared";
import {
  DEED_CARD_TYPE_ARTIFACT,
  CATEGORY_COMBAT,
} from "../../types/cards.js";
import {
  EFFECT_COMPOUND,
  EFFECT_GAIN_ATTACK,
  EFFECT_APPLY_MODIFIER,
  COMBAT_TYPE_MELEE,
} from "../../types/effectTypes.js";
import {
  DURATION_COMBAT,
  EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { SOUL_HARVESTER_CARDS } from "../../data/artifacts/soulHarvester.js";
import {
  getCrystalOptionsForEnemy,
  resolveSoulHarvesterCrystals,
} from "../combat/soulHarvesterTracking.js";
import { addModifier } from "../modifiers/index.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";

const card = SOUL_HARVESTER_CARDS[CARD_SOUL_HARVESTER]!;

/**
 * Create a CombatEnemy with specified resistances for testing.
 */
function createCombatEnemy(
  instanceId: string,
  resistances: readonly string[],
  overrides: Partial<CombatEnemy> = {}
): CombatEnemy {
  return {
    instanceId,
    enemyId: ENEMY_DIGGERS,
    definition: {
      id: ENEMY_DIGGERS,
      name: "Test Enemy",
      color: "green" as const,
      attack: 3,
      attackElement: ELEMENT_PHYSICAL,
      armor: 3,
      fame: 2,
      resistances: resistances as CombatEnemy["definition"]["resistances"],
      abilities: [],
    },
    isBlocked: false,
    isDefeated: true,
    damageAssigned: true,
    isRequiredForConquest: true,
    ...overrides,
  };
}

/**
 * Add a Soul Harvester modifier to state with the given limit.
 */
function addSoulHarvesterModifier(
  state: ReturnType<typeof createTestGameState>,
  limit: number,
  playerId = "player1"
) {
  return addModifier(state, {
    source: {
      type: SOURCE_CARD,
      cardId: CARD_SOUL_HARVESTER,
      playerId,
    },
    duration: DURATION_COMBAT,
    scope: { type: SCOPE_SELF },
    effect: {
      type: EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING,
      limit,
      trackByAttack: false,
    },
    createdAtRound: 1,
    createdByPlayerId: playerId,
  });
}

describe("Soul Harvester", () => {
  describe("card definition", () => {
    it("should be defined with correct properties", () => {
      expect(card).toBeDefined();
      expect(card.name).toBe("Soul Harvester");
      expect(card.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
      expect(card.categories).toContain(CATEGORY_COMBAT);
      expect(card.sidewaysValue).toBe(1);
      expect(card.destroyOnPowered).toBe(true);
    });

    it("should be powered by any basic color", () => {
      expect(card.poweredBy).toContain("red");
      expect(card.poweredBy).toContain("blue");
      expect(card.poweredBy).toContain("green");
      expect(card.poweredBy).toContain("white");
    });

    it("should have compound basic effect with Attack 3 and crystal tracking", () => {
      expect(card.basicEffect.type).toBe(EFFECT_COMPOUND);
      if (card.basicEffect.type === EFFECT_COMPOUND) {
        const effects = card.basicEffect.effects;
        expect(effects).toHaveLength(2);

        // First sub-effect: Attack 3 melee
        const attackEffect = effects[0]!;
        expect(attackEffect.type).toBe(EFFECT_GAIN_ATTACK);
        if (attackEffect.type === EFFECT_GAIN_ATTACK) {
          expect(attackEffect.amount).toBe(3);
          expect(attackEffect.combatType).toBe(COMBAT_TYPE_MELEE);
        }

        // Second sub-effect: crystal tracking modifier (limit 1)
        const modifierEffect = effects[1]!;
        expect(modifierEffect.type).toBe(EFFECT_APPLY_MODIFIER);
        if (modifierEffect.type === EFFECT_APPLY_MODIFIER) {
          expect(modifierEffect.modifier.type).toBe(EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING);
          if (modifierEffect.modifier.type === EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING) {
            expect(modifierEffect.modifier.limit).toBe(1);
          }
        }
      }
    });

    it("should have compound powered effect with Attack 8 and unlimited crystal tracking", () => {
      expect(card.poweredEffect.type).toBe(EFFECT_COMPOUND);
      if (card.poweredEffect.type === EFFECT_COMPOUND) {
        const effects = card.poweredEffect.effects;
        expect(effects).toHaveLength(2);

        // First sub-effect: Attack 8 melee
        const attackEffect = effects[0]!;
        expect(attackEffect.type).toBe(EFFECT_GAIN_ATTACK);
        if (attackEffect.type === EFFECT_GAIN_ATTACK) {
          expect(attackEffect.amount).toBe(8);
          expect(attackEffect.combatType).toBe(COMBAT_TYPE_MELEE);
        }

        // Second sub-effect: crystal tracking modifier (limit 99)
        const modifierEffect = effects[1]!;
        expect(modifierEffect.type).toBe(EFFECT_APPLY_MODIFIER);
        if (modifierEffect.type === EFFECT_APPLY_MODIFIER) {
          expect(modifierEffect.modifier.type).toBe(EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING);
          if (modifierEffect.modifier.type === EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING) {
            expect(modifierEffect.modifier.limit).toBe(99);
          }
        }
      }
    });
  });

  describe("getCrystalOptionsForEnemy", () => {
    it("should return white only for enemy with no resistances", () => {
      const enemy = createCombatEnemy("enemy_1", []);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(1);
      expect(options[0]!.color).toBe("white");
    });

    it("should return red + white for Fire resistant enemy", () => {
      const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(2);
      expect(options[0]!.color).toBe("red");
      expect(options[1]!.color).toBe("white");
    });

    it("should return blue + white for Ice resistant enemy", () => {
      const enemy = createCombatEnemy("enemy_1", [RESIST_ICE]);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(2);
      expect(options[0]!.color).toBe("blue");
      expect(options[1]!.color).toBe("white");
    });

    it("should return green + white for Physical resistant enemy", () => {
      const enemy = createCombatEnemy("enemy_1", [RESIST_PHYSICAL]);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(2);
      expect(options[0]!.color).toBe("green");
      expect(options[1]!.color).toBe("white");
    });

    it("should return multiple options for enemy with multiple resistances", () => {
      const enemy = createCombatEnemy("enemy_1", [RESIST_ICE, RESIST_PHYSICAL]);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(3);
      expect(options[0]!.color).toBe("blue");
      expect(options[1]!.color).toBe("green");
      expect(options[2]!.color).toBe("white");
    });

    it("should return all colors for enemy with all resistances", () => {
      const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE, RESIST_ICE, RESIST_PHYSICAL]);
      const options = getCrystalOptionsForEnemy(enemy);

      expect(options).toHaveLength(4);
      expect(options[0]!.color).toBe("red");
      expect(options[1]!.color).toBe("blue");
      expect(options[2]!.color).toBe("green");
      expect(options[3]!.color).toBe("white");
    });
  });

  describe("resolveSoulHarvesterCrystals", () => {
    describe("basic mode (limit 1)", () => {
      it("should grant one crystal for one defeated enemy", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        // Should gain red crystal (first non-white option)
        expect(result.state.players[0]!.crystals.red).toBe(1);
      });

      it("should only grant crystal for one enemy even if multiple defeated", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        const enemies = [
          createCombatEnemy("enemy_1", [RESIST_FIRE]),
          createCombatEnemy("enemy_2", [RESIST_ICE]),
        ];
        const result = resolveSoulHarvesterCrystals(state, "player1", enemies);

        // Should gain only one crystal (red from first enemy)
        expect(result.state.players[0]!.crystals.red).toBe(1);
        expect(result.state.players[0]!.crystals.blue).toBe(0);
      });

      it("should grant white crystal for enemy with no resistances", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        const enemy = createCombatEnemy("enemy_1", []);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        expect(result.state.players[0]!.crystals.white).toBe(1);
      });
    });

    describe("powered mode (limit 99)", () => {
      it("should grant one crystal per defeated enemy", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 99);

        const enemies = [
          createCombatEnemy("enemy_1", [RESIST_FIRE]),
          createCombatEnemy("enemy_2", [RESIST_ICE]),
          createCombatEnemy("enemy_3", [RESIST_PHYSICAL]),
        ];
        const result = resolveSoulHarvesterCrystals(state, "player1", enemies);

        expect(result.state.players[0]!.crystals.red).toBe(1);
        expect(result.state.players[0]!.crystals.blue).toBe(1);
        expect(result.state.players[0]!.crystals.green).toBe(1);
      });

      it("should grant white crystal for enemies with no resistances", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 99);

        const enemies = [
          createCombatEnemy("enemy_1", []),
          createCombatEnemy("enemy_2", []),
        ];
        const result = resolveSoulHarvesterCrystals(state, "player1", enemies);

        expect(result.state.players[0]!.crystals.white).toBe(2);
      });
    });

    describe("summoned enemy exclusion", () => {
      it("should not grant crystal for summoned enemies", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 99);

        const enemies = [
          createCombatEnemy("enemy_1", [RESIST_FIRE], { summonedByInstanceId: "summoner_0" }),
        ];
        const result = resolveSoulHarvesterCrystals(state, "player1", enemies);

        // No crystals should be gained
        expect(result.state.players[0]!.crystals.red).toBe(0);
        expect(result.state.players[0]!.crystals.white).toBe(0);
      });

      it("should grant crystal for non-summoned enemies but not summoned ones", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 99);

        const enemies = [
          createCombatEnemy("enemy_1", [RESIST_FIRE]),
          createCombatEnemy("enemy_2", [RESIST_ICE], { summonedByInstanceId: "enemy_1" }),
        ];
        const result = resolveSoulHarvesterCrystals(state, "player1", enemies);

        // Only the non-summoned enemy should grant a crystal
        expect(result.state.players[0]!.crystals.red).toBe(1);
        expect(result.state.players[0]!.crystals.blue).toBe(0);
      });
    });

    describe("modifier consumption", () => {
      it("should consume the modifier after resolution", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        const remainingModifiers = result.state.activeModifiers.filter(
          (m) => m.effect.type === EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING
        );
        expect(remainingModifiers).toHaveLength(0);
      });

      it("should consume the modifier even if no enemies are defeated", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        const result = resolveSoulHarvesterCrystals(state, "player1", []);

        const remainingModifiers = result.state.activeModifiers.filter(
          (m) => m.effect.type === EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING
        );
        expect(remainingModifiers).toHaveLength(0);
      });

      it("should not affect other players' modifiers", () => {
        const player1 = createTestPlayer({ id: "player1" });
        const player2 = createTestPlayer({ id: "player2" });
        let state = createTestGameState({ players: [player1, player2] });
        state = addSoulHarvesterModifier(state, 1, "player1");
        state = addSoulHarvesterModifier(state, 1, "player2");

        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        // Player 1's modifier consumed, player 2's still present
        const remainingModifiers = result.state.activeModifiers.filter(
          (m) => m.effect.type === EFFECT_SOUL_HARVESTER_CRYSTAL_TRACKING
        );
        expect(remainingModifiers).toHaveLength(1);
        expect(remainingModifiers[0]!.createdByPlayerId).toBe("player2");
      });
    });

    describe("no modifier active", () => {
      it("should return unchanged state when no modifier exists", () => {
        const state = createTestGameState();

        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        expect(result.state).toBe(state); // Same reference — no change
        expect(result.crystalChoices).toHaveLength(0);
      });
    });

    describe("crystal color auto-selection", () => {
      it("should prefer non-white crystal when resistance options exist", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        // Enemy has Fire resistance -> red and white options
        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        // Should pick red over white
        expect(result.state.players[0]!.crystals.red).toBe(1);
        expect(result.state.players[0]!.crystals.white).toBe(0);
      });

      it("should pick first resistance color when multiple resistances exist", () => {
        const player = createTestPlayer();
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        // Enemy with Fire + Ice resistance -> red is first non-white
        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE, RESIST_ICE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        expect(result.state.players[0]!.crystals.red).toBe(1);
        expect(result.state.players[0]!.crystals.blue).toBe(0);
      });
    });

    describe("crystal overflow", () => {
      it("should overflow to mana token when crystal inventory is full", () => {
        const player = createTestPlayer({
          crystals: { red: 3, blue: 0, green: 0, white: 0 },
        });
        let state = createTestGameState({ players: [player] });
        state = addSoulHarvesterModifier(state, 1);

        // Enemy with Fire resistance -> would give red, but red is full
        const enemy = createCombatEnemy("enemy_1", [RESIST_FIRE]);
        const result = resolveSoulHarvesterCrystals(state, "player1", [enemy]);

        // Red crystal stays at 3, overflow goes to pureMana
        expect(result.state.players[0]!.crystals.red).toBe(3);
        expect(result.state.players[0]!.pureMana).toHaveLength(1);
        expect(result.state.players[0]!.pureMana[0]!.color).toBe("red");
      });
    });
  });
});
