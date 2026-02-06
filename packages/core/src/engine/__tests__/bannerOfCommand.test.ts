/**
 * Tests for Banner of Command artifact
 *
 * Basic: Influence 4. If recruited Unit this turn, may assign this instead
 *        of Command token. (Banner assignment uses existing banner system.)
 * Powered: Fame +2. Recruit any Unit from offer for free. Destroy artifact.
 *
 * FAQ S2: Can play banner, recruit with its influence, assign to unit in same turn.
 * FAQ S3: No location restrictions.
 * FAQ S4: Works in combat.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { resolveEffect, isEffectResolvable, describeEffect, resetFreeRecruitInstanceCounter } from "../effects/index.js";
import { BANNER_OF_COMMAND_CARDS } from "../../data/artifacts/bannerOfCommand.js";
import { createTestPlayer, createTestGameState } from "./testHelpers.js";
import { getCard } from "../helpers/cardLookup.js";
import { isBannerArtifact } from "../rules/banners.js";
import {
  CARD_BANNER_OF_COMMAND,
  MANA_RED,
  MANA_BLUE,
  MANA_GREEN,
  MANA_WHITE,
  UNIT_PEASANTS,
  UNIT_FORESTERS,
  UNIT_UTEM_CROSSBOWMEN,
} from "@mage-knight/shared";
import type { UnitId } from "@mage-knight/shared";
import type { FreeRecruitEffect, ResolveFreeRecruitTargetEffect } from "../../types/cards.js";
import {
  DEED_CARD_TYPE_ARTIFACT,
  CATEGORY_BANNER,
  CATEGORY_INFLUENCE,
} from "../../types/cards.js";
import {
  EFFECT_GAIN_INFLUENCE,
  EFFECT_COMPOUND,
  EFFECT_GAIN_FAME,
  EFFECT_FREE_RECRUIT,
  EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
} from "../../types/effectTypes.js";
import type { GameState } from "../../state/GameState.js";
import type { Player } from "../../types/player.js";
import { createPlayerUnit } from "../../types/unit.js";

// ============================================================================
// Test Helpers
// ============================================================================

function createStateWithUnitOffer(
  unitOffer: UnitId[],
  playerOverrides: Partial<Player> = {}
): GameState {
  const player = createTestPlayer({
    hand: [CARD_BANNER_OF_COMMAND],
    commandTokens: 2,
    ...playerOverrides,
  });
  return createTestGameState({
    players: [player],
    offers: {
      units: unitOffer,
      advancedActions: { cards: [] },
      spells: { cards: [] },
      commonSkills: [],
      monasteryAdvancedActions: [],
    },
  });
}

// ============================================================================
// Tests
// ============================================================================

describe("Banner of Command", () => {
  beforeEach(() => {
    resetFreeRecruitInstanceCounter();
  });

  // --------------------------------------------------------------------------
  // Card Definition
  // --------------------------------------------------------------------------
  describe("Card Definition", () => {
    it("should have correct card properties", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card).toBeDefined();
      expect(card.id).toBe(CARD_BANNER_OF_COMMAND);
      expect(card.name).toBe("Banner of Command");
      expect(card.cardType).toBe(DEED_CARD_TYPE_ARTIFACT);
      expect(card.sidewaysValue).toBe(1);
    });

    it("should have banner and influence categories", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card.categories).toContain(CATEGORY_BANNER);
      expect(card.categories).toContain(CATEGORY_INFLUENCE);
    });

    it("should be identified as a banner artifact", () => {
      const card = getCard(CARD_BANNER_OF_COMMAND);
      expect(card).not.toBeNull();
      expect(isBannerArtifact(card!)).toBe(true);
    });

    it("should be powered by any basic mana color", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card.poweredBy).toContain(MANA_RED);
      expect(card.poweredBy).toContain(MANA_BLUE);
      expect(card.poweredBy).toContain(MANA_GREEN);
      expect(card.poweredBy).toContain(MANA_WHITE);
    });

    it("should be destroyed after powered effect", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card.destroyOnPowered).toBe(true);
    });
  });

  // --------------------------------------------------------------------------
  // Basic Effect — Influence 4
  // --------------------------------------------------------------------------
  describe("Basic Effect — Influence 4", () => {
    it("should have Influence 4 as basic effect", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card.basicEffect.type).toBe(EFFECT_GAIN_INFLUENCE);
      if (card.basicEffect.type === EFFECT_GAIN_INFLUENCE) {
        expect(card.basicEffect.amount).toBe(4);
      }
    });

    it("should grant 4 influence when resolved", () => {
      const state = createStateWithUnitOffer([UNIT_PEASANTS]);
      const player = state.players[0]!;
      expect(player.influencePoints).toBe(0);

      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND]!;
      const result = resolveEffect(state, player.id, card.basicEffect);

      expect(result.state.players[0]!.influencePoints).toBe(4);
      expect(result.description).toContain("4");
    });
  });

  // --------------------------------------------------------------------------
  // Powered Effect — Fame +2, Free Recruit
  // --------------------------------------------------------------------------
  describe("Powered Effect", () => {
    it("should be a compound of Fame +2 and Free Recruit", () => {
      const card = BANNER_OF_COMMAND_CARDS[CARD_BANNER_OF_COMMAND];
      expect(card.poweredEffect.type).toBe(EFFECT_COMPOUND);
      if (card.poweredEffect.type === EFFECT_COMPOUND) {
        expect(card.poweredEffect.effects).toHaveLength(2);
        expect(card.poweredEffect.effects[0]!.type).toBe(EFFECT_GAIN_FAME);
        expect(card.poweredEffect.effects[1]!.type).toBe(EFFECT_FREE_RECRUIT);
      }
    });
  });

  // --------------------------------------------------------------------------
  // Free Recruit Effect
  // --------------------------------------------------------------------------
  describe("EFFECT_FREE_RECRUIT", () => {
    const effect: FreeRecruitEffect = { type: EFFECT_FREE_RECRUIT };

    describe("isEffectResolvable", () => {
      it("should return false when no units in offer", () => {
        const state = createStateWithUnitOffer([]);
        expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(false);
      });

      it("should return false when at command limit", () => {
        const state = createStateWithUnitOffer([UNIT_PEASANTS], {
          commandTokens: 1,
          units: [createPlayerUnit(UNIT_PEASANTS, "unit_1")],
        });
        expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(false);
      });

      it("should return true when units available and has command slots", () => {
        const state = createStateWithUnitOffer([UNIT_PEASANTS], {
          commandTokens: 2,
          units: [],
        });
        expect(isEffectResolvable(state, state.players[0]!.id, effect)).toBe(true);
      });
    });

    describe("resolveEffect — single unit", () => {
      it("should auto-resolve when only one unit in offer", () => {
        const state = createStateWithUnitOffer([UNIT_PEASANTS], {
          commandTokens: 2,
          units: [],
        });

        const result = resolveEffect(state, state.players[0]!.id, effect);

        // Should NOT require a choice (auto-resolved)
        expect(result.requiresChoice).toBeFalsy();
        // Player should have the unit
        expect(result.state.players[0]!.units).toHaveLength(1);
        expect(result.state.players[0]!.units[0]!.unitId).toBe(UNIT_PEASANTS);
        // Unit should be removed from offer
        expect(result.state.offers.units).not.toContain(UNIT_PEASANTS);
        // Player flags should be updated
        expect(result.state.players[0]!.hasRecruitedUnitThisTurn).toBe(true);
        expect(result.state.players[0]!.hasTakenActionThisTurn).toBe(true);
        // No influence deducted (free!)
        expect(result.state.players[0]!.influencePoints).toBe(0);
      });
    });

    describe("resolveEffect — multiple units", () => {
      it("should present choice when multiple units available", () => {
        const state = createStateWithUnitOffer(
          [UNIT_PEASANTS, UNIT_FORESTERS, UNIT_UTEM_CROSSBOWMEN],
          { commandTokens: 2, units: [] }
        );

        const result = resolveEffect(state, state.players[0]!.id, effect);

        expect(result.requiresChoice).toBe(true);
        expect(result.dynamicChoiceOptions).toHaveLength(3);
        // Each option should be a RESOLVE_FREE_RECRUIT_TARGET
        for (const opt of result.dynamicChoiceOptions!) {
          expect(opt.type).toBe(EFFECT_RESOLVE_FREE_RECRUIT_TARGET);
        }
      });
    });

    describe("resolveEffect — RESOLVE_FREE_RECRUIT_TARGET", () => {
      it("should recruit the selected unit for free", () => {
        const state = createStateWithUnitOffer(
          [UNIT_PEASANTS, UNIT_FORESTERS],
          { commandTokens: 2, units: [] }
        );

        const targetEffect: ResolveFreeRecruitTargetEffect = {
          type: EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
          unitId: UNIT_FORESTERS,
          unitName: "Foresters",
        };

        const result = resolveEffect(state, state.players[0]!.id, targetEffect);

        // Foresters recruited
        expect(result.state.players[0]!.units).toHaveLength(1);
        expect(result.state.players[0]!.units[0]!.unitId).toBe(UNIT_FORESTERS);
        // Foresters removed from offer, Peasants remain
        expect(result.state.offers.units).not.toContain(UNIT_FORESTERS);
        expect(result.state.offers.units).toContain(UNIT_PEASANTS);
        // No influence spent
        expect(result.state.players[0]!.influencePoints).toBe(0);
      });
    });

    describe("edge cases", () => {
      it("should handle empty offer gracefully", () => {
        const state = createStateWithUnitOffer([], {
          commandTokens: 2,
          units: [],
        });

        const result = resolveEffect(state, state.players[0]!.id, effect);

        expect(result.requiresChoice).toBeFalsy();
        expect(result.description).toContain("No units");
      });

      it("should block recruitment when at command limit", () => {
        const state = createStateWithUnitOffer([UNIT_PEASANTS], {
          commandTokens: 1,
          units: [createPlayerUnit(UNIT_PEASANTS, "existing_unit")],
        });

        const result = resolveEffect(state, state.players[0]!.id, effect);

        expect(result.requiresChoice).toBeFalsy();
        expect(result.description).toContain("command limit");
        expect(result.state.players[0]!.units).toHaveLength(1); // unchanged
      });

      it("should track unit in unitsRecruitedThisInteraction", () => {
        const state = createStateWithUnitOffer([UNIT_PEASANTS], {
          commandTokens: 2,
          units: [],
        });

        const result = resolveEffect(state, state.players[0]!.id, effect);

        expect(result.state.players[0]!.unitsRecruitedThisInteraction).toContain(
          UNIT_PEASANTS
        );
      });
    });
  });

  // --------------------------------------------------------------------------
  // describeEffect
  // --------------------------------------------------------------------------
  describe("describeEffect", () => {
    it("should describe EFFECT_FREE_RECRUIT", () => {
      const effect: FreeRecruitEffect = { type: EFFECT_FREE_RECRUIT };
      expect(describeEffect(effect)).toBe("Recruit any Unit for free");
    });

    it("should describe EFFECT_RESOLVE_FREE_RECRUIT_TARGET", () => {
      const effect: ResolveFreeRecruitTargetEffect = {
        type: EFFECT_RESOLVE_FREE_RECRUIT_TARGET,
        unitId: UNIT_PEASANTS,
        unitName: "Peasants",
      };
      expect(describeEffect(effect)).toBe("Recruit Peasants for free");
    });
  });
});
