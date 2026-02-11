/**
 * Tests for Maximal Effect (red advanced action card)
 *
 * Maximal Effect allows throwing away (permanently removing) an action card from hand
 * and using its effect multiple times:
 * - Basic: Throw away action card → use its basic effect 3 times
 * - Powered (Red): Throw away action card → use its stronger effect 2 times (for free)
 *
 * Key rules:
 * - Only action cards (basic/advanced) can be thrown away (not wounds, artifacts, spells)
 * - The Maximal Effect card itself cannot be thrown away
 * - Thrown away cards go to removedCards (permanent, not recycled)
 * - Effects aggregate (3x Attack 2 = Attack 6 in the accumulator)
 * - Card destroyed event is emitted (permanent removal)
 */

import { describe, it, expect } from "vitest";
import { createTestGameState, createTestPlayer, createUnitCombatState } from "./testHelpers.js";
import { COMBAT_PHASE_ATTACK } from "../../types/combat.js";
import { isEffectResolvable } from "../effects/index.js";
import {
  handleMaximalEffectEffect,
  getCardsEligibleForMaximalEffect,
} from "../effects/maximalEffectEffects.js";
import { createResolveMaximalEffectCommand } from "../commands/resolveMaximalEffectCommand.js";
import { createResolveMaximalEffectCommandFromAction } from "../commands/factories/cards.js";
import { describeEffect } from "../effects/describeEffect.js";
import {
  validateHasPendingMaximalEffect,
  validateMaximalEffectSelection,
} from "../validators/maximalEffectValidators.js";
import { getMaximalEffectOptions } from "../validActions/pending.js";
import { getValidActions } from "../validActions/index.js";
import { EFFECT_MAXIMAL_EFFECT } from "../../types/effectTypes.js";
import type { MaximalEffectEffect } from "../../types/cards.js";
import type { PendingMaximalEffect } from "../../types/player.js";
import {
  CARD_MAXIMAL_EFFECT,
  CARD_MARCH,
  CARD_RAGE,
  CARD_COUNTERATTACK,
  CARD_WOUND,
  CARD_BANNER_OF_GLORY,
  CARD_FIREBALL,
  CARD_DESTROYED,
  RESOLVE_MAXIMAL_EFFECT_ACTION,
  PLAY_CARD_ACTION,
} from "@mage-knight/shared";

// ============================================================================
// HELPERS
// ============================================================================

function makePending(
  overrides: Partial<PendingMaximalEffect> = {}
): PendingMaximalEffect {
  return {
    sourceCardId: CARD_MAXIMAL_EFFECT,
    multiplier: 3,
    effectKind: "basic",
    ...overrides,
  };
}

// ============================================================================
// ELIGIBILITY
// ============================================================================

describe("Maximal Effect", () => {
  describe("getCardsEligibleForMaximalEffect", () => {
    it("should return action cards excluding wounds and the source card", () => {
      const hand = [CARD_MARCH, CARD_RAGE, CARD_WOUND, CARD_MAXIMAL_EFFECT];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });

    it("should exclude wounds", () => {
      const hand = [CARD_WOUND, CARD_MARCH];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude the source card (Maximal Effect itself)", () => {
      const hand = [CARD_MAXIMAL_EFFECT, CARD_MARCH];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude artifacts (not action cards)", () => {
      const hand = [CARD_BANNER_OF_GLORY, CARD_MARCH];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should exclude spells (not action cards)", () => {
      const hand = [CARD_FIREBALL, CARD_MARCH];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH]);
    });

    it("should return empty when only wounds and Maximal Effect in hand", () => {
      const hand = [CARD_WOUND, CARD_MAXIMAL_EFFECT];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([]);
    });

    it("should return empty for empty hand", () => {
      const eligible = getCardsEligibleForMaximalEffect(
        [],
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([]);
    });

    it("should include both basic and advanced action cards", () => {
      const hand = [CARD_MARCH, CARD_RAGE];
      const eligible = getCardsEligibleForMaximalEffect(
        hand,
        CARD_MAXIMAL_EFFECT
      );
      expect(eligible).toEqual([CARD_MARCH, CARD_RAGE]);
    });
  });

  // ============================================================================
  // RESOLVABILITY
  // ============================================================================

  describe("isEffectResolvable", () => {
    const basicEffect: MaximalEffectEffect = {
      type: EFFECT_MAXIMAL_EFFECT,
      effectKind: "basic",
      multiplier: 3,
    };

    it("should be resolvable when player has action cards", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should NOT be resolvable when player only has wounds", () => {
      const player = createTestPlayer({ hand: [CARD_WOUND] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when hand is empty", () => {
      const player = createTestPlayer({ hand: [] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should be resolvable with mix of wounds and action cards", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MARCH, CARD_WOUND],
      });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(true);
    });

    it("should NOT be resolvable when only artifacts in hand", () => {
      const player = createTestPlayer({ hand: [CARD_BANNER_OF_GLORY] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });

    it("should NOT be resolvable when only spells in hand", () => {
      const player = createTestPlayer({ hand: [CARD_FIREBALL] });
      const state = createTestGameState({ players: [player] });
      expect(isEffectResolvable(state, "player1", basicEffect)).toBe(false);
    });
  });

  // ============================================================================
  // EFFECT HANDLER
  // ============================================================================

  describe("handleMaximalEffectEffect", () => {
    it("should create pending state (basic mode, multiplier 3)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH, CARD_RAGE] });
      const state = createTestGameState({ players: [player] });
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "basic",
        multiplier: 3,
      };

      const result = handleMaximalEffectEffect(
        state,
        0,
        player,
        effect,
        CARD_MAXIMAL_EFFECT
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingMaximalEffect).not.toBeNull();
      expect(result.state.players[0].pendingMaximalEffect?.effectKind).toBe(
        "basic"
      );
      expect(result.state.players[0].pendingMaximalEffect?.multiplier).toBe(3);
      expect(
        result.state.players[0].pendingMaximalEffect?.sourceCardId
      ).toBe(CARD_MAXIMAL_EFFECT);
    });

    it("should create pending state (powered mode, multiplier 2)", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "powered",
        multiplier: 2,
      };

      const result = handleMaximalEffectEffect(
        state,
        0,
        player,
        effect,
        CARD_MAXIMAL_EFFECT
      );

      expect(result.requiresChoice).toBe(true);
      expect(result.state.players[0].pendingMaximalEffect?.effectKind).toBe(
        "powered"
      );
      expect(result.state.players[0].pendingMaximalEffect?.multiplier).toBe(2);
    });

    it("should throw when no eligible action cards", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND, CARD_MAXIMAL_EFFECT],
      });
      const state = createTestGameState({ players: [player] });
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "basic",
        multiplier: 3,
      };

      expect(() =>
        handleMaximalEffectEffect(
          state,
          0,
          player,
          effect,
          CARD_MAXIMAL_EFFECT
        )
      ).toThrow("No action cards available to throw away for Maximal Effect");
    });

    it("should throw when sourceCardId is null", () => {
      const player = createTestPlayer({ hand: [CARD_MARCH] });
      const state = createTestGameState({ players: [player] });
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "basic",
        multiplier: 3,
      };

      expect(() =>
        handleMaximalEffectEffect(state, 0, player, effect, null)
      ).toThrow("MaximalEffectEffect requires sourceCardId");
    });
  });

  // ============================================================================
  // RESOLVE MAXIMAL EFFECT COMMAND - BASIC MODE
  // ============================================================================

  describe("resolveMaximalEffectCommand (basic mode)", () => {
    it("should throw away card and apply its basic effect 3 times", () => {
      // March: basic effect = Move 2
      // 3x Move 2 = Move 6 total
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        movePoints: 0,
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green basic action: Move 2
      });
      const result = command.execute(state);

      // Card removed from hand
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
      // Card added to removedCards (permanent removal)
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Card NOT in discard
      expect(result.state.players[0].discard).not.toContain(CARD_MARCH);
      // Move 2 × 3 = 6 move points gained
      expect(result.state.players[0].movePoints).toBe(6);
      // Pending state cleared
      expect(result.state.players[0].pendingMaximalEffect).toBeNull();
      // Card destroyed event emitted
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_DESTROYED,
          cardId: CARD_MARCH,
        })
      );
    });

    it("should throw away a card with direct attack and apply its basic effect 3 times", () => {
      // Counterattack: basic effect = Attack 2 (direct, no choice)
      // 3x Attack 2 → combat accumulator should have attack 6
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK],
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_COUNTERATTACK,
      });
      const result = command.execute(state);

      // Card removed and destroyed
      expect(result.state.players[0].removedCards).toContain(CARD_COUNTERATTACK);
      // Attack 2 × 3 = 6 attack in the accumulator
      expect(
        result.state.players[0].combatAccumulator.attack.normal
      ).toBe(6);
    });

    it("should create pending choice when card basic effect has a choice", () => {
      // Rage: basic effect = choice(attack(2), block(2))
      // Maximal Effect with a choice card should result in a pending choice (requires combat)
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({ players: [player], combat });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });
      const result = command.execute(state);

      // Card should still be removed and destroyed
      expect(result.state.players[0].removedCards).toContain(CARD_RAGE);
      // Effect resolution pauses on the first choice - player has pending choice
      expect(result.state.players[0].pendingChoice).not.toBeNull();
    });
  });

  // ============================================================================
  // RESOLVE MAXIMAL EFFECT COMMAND - POWERED MODE
  // ============================================================================

  describe("resolveMaximalEffectCommand (powered mode)", () => {
    it("should throw away card and apply its powered effect 2 times", () => {
      // March: powered (green) effect = Move 4
      // 2x Move 4 = Move 8 total
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        movePoints: 0,
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "powered",
          multiplier: 2,
        }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH, // green basic action: powered = Move 4
      });
      const result = command.execute(state);

      // Card removed from hand
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
      // Move 4 × 2 = 8 move points gained
      expect(result.state.players[0].movePoints).toBe(8);
      // Pending state cleared
      expect(result.state.players[0].pendingMaximalEffect).toBeNull();
    });

    it("should throw away a card with direct attack and apply its powered effect 2 times", () => {
      // Counterattack: powered effect = Attack 4 (direct, no choice)
      // 2x Attack 4 → 8 attack
      const player = createTestPlayer({
        hand: [CARD_COUNTERATTACK],
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "powered",
          multiplier: 2,
        }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_COUNTERATTACK,
      });
      const result = command.execute(state);

      expect(result.state.players[0].removedCards).toContain(CARD_COUNTERATTACK);
      // Attack 4 × 2 = 8
      expect(
        result.state.players[0].combatAccumulator.attack.normal
      ).toBe(8);
    });
  });

  // ============================================================================
  // ERROR HANDLING
  // ============================================================================

  describe("resolveMaximalEffectCommand error handling", () => {
    it("should throw when no pending state exists", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: null,
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      expect(() => command.execute(state)).toThrow(
        "No pending Maximal Effect to resolve"
      );
    });

    it("should throw when card is not eligible (wound)", () => {
      const player = createTestPlayer({
        hand: [CARD_WOUND],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_WOUND,
      });

      expect(() => command.execute(state)).toThrow(
        "not eligible for Maximal Effect"
      );
    });

    it("should throw when card is not eligible (artifact)", () => {
      const player = createTestPlayer({
        hand: [CARD_BANNER_OF_GLORY],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_BANNER_OF_GLORY,
      });

      expect(() => command.execute(state)).toThrow(
        "not eligible for Maximal Effect"
      );
    });

    it("should throw when player not found", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "nonexistent",
        cardId: CARD_MARCH,
      });

      expect(() => command.execute(state)).toThrow("Player not found");
    });
  });

  // ============================================================================
  // UNDO
  // ============================================================================

  describe("resolveMaximalEffectCommand undo", () => {
    it("should restore full player state after basic mode execution", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        discard: [],
        removedCards: [],
        movePoints: 0,
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });

      const executed = command.execute(state);
      // Verify execute changed state
      expect(executed.state.players[0].movePoints).toBe(6);
      expect(executed.state.players[0].hand).not.toContain(CARD_MARCH);
      expect(executed.state.players[0].removedCards).toContain(CARD_MARCH);

      const undone = command.undo(executed.state);

      // Hand restored
      expect(undone.state.players[0].hand).toContain(CARD_MARCH);
      expect(undone.state.players[0].hand).toContain(CARD_RAGE);
      // removedCards restored
      expect(undone.state.players[0].removedCards).toEqual([]);
      // Move points restored
      expect(undone.state.players[0].movePoints).toBe(0);
      // Pending state restored
      expect(undone.state.players[0].pendingMaximalEffect).not.toBeNull();
      expect(
        undone.state.players[0].pendingMaximalEffect?.effectKind
      ).toBe("basic");
    });
  });

  // ============================================================================
  // DESCRIBE EFFECT
  // ============================================================================

  describe("describeEffect", () => {
    it("should describe basic maximal effect", () => {
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "basic",
        multiplier: 3,
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card to use its basic effect 3 times"
      );
    });

    it("should describe powered maximal effect", () => {
      const effect: MaximalEffectEffect = {
        type: EFFECT_MAXIMAL_EFFECT,
        effectKind: "powered",
        multiplier: 2,
      };
      expect(describeEffect(effect)).toBe(
        "Throw away an action card to use its stronger effect 2 times"
      );
    });
  });

  // ============================================================================
  // VALIDATORS
  // ============================================================================

  describe("validators", () => {
    describe("validateHasPendingMaximalEffect", () => {
      it("should pass when pending state exists", () => {
        const player = createTestPlayer({
          pendingMaximalEffect: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingMaximalEffect(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(true);
      });

      it("should fail when no pending state", () => {
        const player = createTestPlayer({
          pendingMaximalEffect: null,
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateHasPendingMaximalEffect(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(false);
      });
    });

    describe("validateMaximalEffectSelection", () => {
      it("should pass for eligible action card", () => {
        const player = createTestPlayer({
          hand: [CARD_MARCH],
          pendingMaximalEffect: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_MARCH,
        } as const;

        const result = validateMaximalEffectSelection(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(true);
      });

      it("should fail for wound card", () => {
        const player = createTestPlayer({
          hand: [CARD_WOUND],
          pendingMaximalEffect: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_WOUND,
        } as const;

        const result = validateMaximalEffectSelection(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(false);
      });

      it("should fail for artifact card", () => {
        const player = createTestPlayer({
          hand: [CARD_BANNER_OF_GLORY],
          pendingMaximalEffect: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_BANNER_OF_GLORY,
        } as const;

        const result = validateMaximalEffectSelection(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(false);
      });

      it("should fail for the Maximal Effect card itself", () => {
        const player = createTestPlayer({
          hand: [CARD_MAXIMAL_EFFECT, CARD_MARCH],
          pendingMaximalEffect: makePending(),
        });
        const state = createTestGameState({ players: [player] });
        const action = {
          type: RESOLVE_MAXIMAL_EFFECT_ACTION,
          cardId: CARD_MAXIMAL_EFFECT,
        } as const;

        const result = validateMaximalEffectSelection(
          state,
          "player1",
          action
        );
        expect(result.valid).toBe(false);
      });
    });
  });

  // ============================================================================
  // PERMANENT REMOVAL VERIFICATION
  // ============================================================================

  describe("permanent removal (throw away)", () => {
    it("should add card to removedCards, not discard pile", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        discard: [],
        removedCards: [],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      // Card is in removedCards (permanent)
      expect(result.state.players[0].removedCards).toContain(CARD_MARCH);
      // Card is NOT in discard (would be recycled)
      expect(result.state.players[0].discard).not.toContain(CARD_MARCH);
      // Card is NOT in hand
      expect(result.state.players[0].hand).not.toContain(CARD_MARCH);
      // Other cards remain in hand
      expect(result.state.players[0].hand).toContain(CARD_RAGE);
    });

    it("should emit CARD_DESTROYED event", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        removedCards: [],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual({
        type: CARD_DESTROYED,
        playerId: "player1",
        cardId: CARD_MARCH,
      });
    });

    it("should preserve existing removedCards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        removedCards: [CARD_RAGE],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_MARCH,
      });
      const result = command.execute(state);

      expect(result.state.players[0].removedCards).toEqual([
        CARD_RAGE,
        CARD_MARCH,
      ]);
    });
  });

  // ============================================================================
  // CARD DEFINITION
  // ============================================================================

  describe("card definition", () => {
    it("should have correct basic effect (maximal_effect, basic, 3)", () => {
      // Import the card definition
      const { MAXIMAL_EFFECT } = require("../../data/advancedActions/red/maximal-effect.js");
      expect(MAXIMAL_EFFECT.basicEffect.type).toBe(EFFECT_MAXIMAL_EFFECT);
      expect(MAXIMAL_EFFECT.basicEffect.effectKind).toBe("basic");
      expect(MAXIMAL_EFFECT.basicEffect.multiplier).toBe(3);
    });

    it("should have correct powered effect (maximal_effect, powered, 2)", () => {
      const { MAXIMAL_EFFECT } = require("../../data/advancedActions/red/maximal-effect.js");
      expect(MAXIMAL_EFFECT.poweredEffect.type).toBe(EFFECT_MAXIMAL_EFFECT);
      expect(MAXIMAL_EFFECT.poweredEffect.effectKind).toBe("powered");
      expect(MAXIMAL_EFFECT.poweredEffect.multiplier).toBe(2);
    });
  });

  // ============================================================================
  // VALID ACTIONS - getMaximalEffectOptions
  // ============================================================================

  describe("getMaximalEffectOptions", () => {
    it("should return undefined when no pending maximal effect", () => {
      const player = createTestPlayer({ pendingMaximalEffect: null });
      const state = createTestGameState({ players: [player] });
      expect(getMaximalEffectOptions(state, player)).toBeUndefined();
    });

    it("should return options when pending maximal effect exists", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE, CARD_WOUND],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const state = createTestGameState({ players: [player] });
      const options = getMaximalEffectOptions(state, player);

      expect(options).toBeDefined();
      expect(options!.sourceCardId).toBe(CARD_MAXIMAL_EFFECT);
      expect(options!.multiplier).toBe(3);
      expect(options!.effectKind).toBe("basic");
      expect(options!.availableCardIds).toEqual([CARD_MARCH, CARD_RAGE]);
    });
  });

  // ============================================================================
  // VALID ACTIONS - getValidActions routing
  // ============================================================================

  describe("getValidActions routing", () => {
    it("should return pending_maximal_effect mode when player has pending state", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_RAGE],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });

      const actions = getValidActions(state, "player1");
      expect(actions.mode).toBe("pending_maximal_effect");
      expect(actions.maximalEffect).toBeDefined();
      expect(actions.maximalEffect!.availableCardIds).toEqual([
        CARD_MARCH,
        CARD_RAGE,
      ]);
    });
  });

  // ============================================================================
  // FACTORY - createResolveMaximalEffectCommandFromAction
  // ============================================================================

  describe("createResolveMaximalEffectCommandFromAction", () => {
    it("should return null for wrong action type", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      } as const;

      const result = createResolveMaximalEffectCommandFromAction(
        state,
        "player1",
        action
      );
      expect(result).toBeNull();
    });

    it("should return null when player not found", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = createResolveMaximalEffectCommandFromAction(
        state,
        "nonexistent",
        action
      );
      expect(result).toBeNull();
    });

    it("should return null when no pending maximal effect", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: null,
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = createResolveMaximalEffectCommandFromAction(
        state,
        "player1",
        action
      );
      expect(result).toBeNull();
    });

    it("should return command when valid", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = createResolveMaximalEffectCommandFromAction(
        state,
        "player1",
        action
      );
      expect(result).not.toBeNull();
    });
  });

  // ============================================================================
  // VALIDATOR EDGE CASES
  // ============================================================================

  describe("validator edge cases", () => {
    it("validateMaximalEffectSelection should pass for non-RESOLVE_MAXIMAL_EFFECT action", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: PLAY_CARD_ACTION,
        cardId: CARD_MARCH,
        powered: false,
      } as const;

      const result = validateMaximalEffectSelection(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("validateMaximalEffectSelection should pass when no pending state (defers to other validator)", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: null,
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateMaximalEffectSelection(state, "player1", action);
      expect(result.valid).toBe(true);
    });

    it("validateMaximalEffectSelection should fail for nonexistent player", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateMaximalEffectSelection(
        state,
        "nonexistent",
        action
      );
      expect(result.valid).toBe(false);
    });

    it("validateHasPendingMaximalEffect should fail for nonexistent player", () => {
      const player = createTestPlayer({
        pendingMaximalEffect: makePending(),
      });
      const state = createTestGameState({ players: [player] });
      const action = {
        type: RESOLVE_MAXIMAL_EFFECT_ACTION,
        cardId: CARD_MARCH,
      } as const;

      const result = validateHasPendingMaximalEffect(
        state,
        "nonexistent",
        action
      );
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // CHOICE HANDLING IN COMMAND
  // ============================================================================

  describe("resolveMaximalEffectCommand with choice effects", () => {
    it("should set up pending choice with correct options for choice-based card", () => {
      // Rage basic = choice(attack(2), block(2))
      // Maximal Effect wraps 3 copies in CompoundEffect
      // First choice should pause with options for attack or block (requires combat)
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({ players: [player], combat });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });
      const result = command.execute(state);

      // Card is permanently removed
      expect(result.state.players[0].removedCards).toContain(CARD_RAGE);
      expect(result.state.players[0].hand).not.toContain(CARD_RAGE);
      // Pending maximal effect cleared
      expect(result.state.players[0].pendingMaximalEffect).toBeNull();
      // Pending choice created with 2 options (attack or block)
      const pendingChoice = result.state.players[0].pendingChoice;
      expect(pendingChoice).not.toBeNull();
      expect(pendingChoice!.options).toHaveLength(2);
      // Should have remaining effects (2 more choice effects from the compound)
      expect(pendingChoice!.remainingEffects).toBeDefined();
      expect(pendingChoice!.remainingEffects!.length).toBe(2);
    });

    it("should emit CARD_DESTROYED and choice required events for choice-based card", () => {
      const player = createTestPlayer({
        hand: [CARD_RAGE],
        removedCards: [],
        pendingMaximalEffect: makePending({
          effectKind: "basic",
          multiplier: 3,
        }),
      });
      const combat = createUnitCombatState(COMBAT_PHASE_ATTACK);
      const state = createTestGameState({ players: [player], combat });

      const command = createResolveMaximalEffectCommand({
        playerId: "player1",
        cardId: CARD_RAGE,
      });
      const result = command.execute(state);

      // Should have CARD_DESTROYED event and a choice required event
      expect(result.events.length).toBeGreaterThanOrEqual(1);
      expect(result.events).toContainEqual(
        expect.objectContaining({
          type: CARD_DESTROYED,
          cardId: CARD_RAGE,
        })
      );
    });
  });
});
