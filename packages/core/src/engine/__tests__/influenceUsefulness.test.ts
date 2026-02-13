/**
 * Tests for influence usefulness rules and sideways-for-influence gating.
 */

import { describe, it, expect } from "vitest";
import { isInfluenceUseful } from "../rules/influenceUsefulness.js";
import {
  getAllowedSidewaysChoices,
  getSidewaysContext,
} from "../rules/sideways.js";
import {
  createTestGameState,
  createTestPlayer,
  createTestHex,
  createVillageSite,
  createUnitCombatState,
} from "./testHelpers.js";
import { SiteType } from "../../types/map.js";
import type { Site } from "../../types/map.js";
import {
  hexKey,
  CARD_MARCH,
  CARD_WOUND,
  CARD_KRANG_RUTHLESS_COERCION,
  CARD_PEACEFUL_MOMENT,
  PLAY_SIDEWAYS_AS_MOVE,
  PLAY_SIDEWAYS_AS_INFLUENCE,
  PLAY_SIDEWAYS_AS_BLOCK,
  UNIT_PEASANTS,
  UNIT_UTEM_SWORDSMEN,
} from "@mage-knight/shared";
import type { CardId } from "@mage-knight/shared";
import type { ActiveModifier } from "../../types/modifiers.js";
import {
  DURATION_TURN,
  EFFECT_LEARNING_DISCOUNT,
  SCOPE_SELF,
  SOURCE_CARD,
} from "../../types/modifierConstants.js";
import { COMBAT_PHASE_BLOCK } from "../../types/combat.js";

function createSite(overrides: Partial<Site> & { type: SiteType }): Site {
  return {
    owner: null,
    isConquered: false,
    isBurned: false,
    ...overrides,
  };
}

function createStateWithSite(
  site: Site,
  playerOverrides: Parameters<typeof createTestPlayer>[0] = {},
  stateOverrides: Parameters<typeof createTestGameState>[0] = {}
) {
  const player = createTestPlayer({
    position: { q: 0, r: 0 },
    ...playerOverrides,
  });
  const hex = createTestHex(0, 0, undefined, site);
  return {
    state: createTestGameState({
      players: [player],
      map: {
        hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
      ...stateOverrides,
    }),
    player,
  };
}

describe("isInfluenceUseful", () => {
  describe("returns false when no influence sink exists", () => {
    it("wilderness (no site), no cards", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });
      // Default test state has no site at player position
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });
  });

  describe("site-based sinks", () => {
    it("returns true — at Village with wounds in hand (healing sink)", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        { hand: [CARD_MARCH, CARD_WOUND] }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns true — at Village with wounded unit (unit healing sink)", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        {
          hand: [CARD_MARCH],
          units: [
            {
              instanceId: "unit_1",
              unitId: UNIT_PEASANTS,
              state: "ready",
              wounded: true,
              usedResistanceThisCombat: false,
            },
          ],
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns true — at Monastery with AAs in monastery offer", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Monastery }),
        { hand: [CARD_MARCH] },
        {
          offers: {
            units: [],
            advancedActions: { cards: [] },
            spells: { cards: [] },
            commonSkills: [],
            monasteryAdvancedActions: ["some_aa" as CardId],
            bondsOfLoyaltyBonusUnits: [],
          },
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns true — at conquered Mage Tower with spells in offer", () => {
      const { state } = createStateWithSite(
        createSite({
          type: SiteType.MageTower,
          isConquered: true,
          owner: "player1",
        }),
        { hand: [CARD_MARCH] },
        {
          offers: {
            units: [],
            advancedActions: { cards: [] },
            spells: { cards: ["some_spell" as CardId] },
            commonSkills: [],
            monasteryAdvancedActions: [],
            bondsOfLoyaltyBonusUnits: [],
          },
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns true — at Village with village-recruitable unit in offer", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        { hand: [CARD_MARCH] },
        {
          offers: {
            units: [UNIT_PEASANTS],
            advancedActions: { cards: [] },
            spells: { cards: [] },
            commonSkills: [],
            monasteryAdvancedActions: [],
            bondsOfLoyaltyBonusUnits: [],
          },
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns false — at Village with only city-recruitable units in offer", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        { hand: [CARD_MARCH] },
        {
          offers: {
            // Utem Swordsmen recruit at Keep only, not Village
            units: [UNIT_UTEM_SWORDSMEN],
            advancedActions: { cards: [] },
            spells: { cards: [] },
            commonSkills: [],
            monasteryAdvancedActions: [],
            bondsOfLoyaltyBonusUnits: [],
          },
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });

    it("returns true — at Refugee Camp with any units in offer", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.RefugeeCamp }),
        { hand: [CARD_MARCH] },
        {
          offers: {
            // Even keep-only units can be recruited at Refugee Camp
            units: [UNIT_UTEM_SWORDSMEN],
            advancedActions: { cards: [] },
            spells: { cards: [] },
            commonSkills: [],
            monasteryAdvancedActions: [],
            bondsOfLoyaltyBonusUnits: [],
          },
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns false — at Village but player already took action", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        {
          hand: [CARD_MARCH, CARD_WOUND],
          hasTakenActionThisTurn: true,
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });

    it("returns false — at conquered Keep owned by another player", () => {
      const { state } = createStateWithSite(
        createSite({
          type: SiteType.Keep,
          isConquered: true,
          owner: "player2",
        }),
        {
          hand: [CARD_MARCH, CARD_WOUND],
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });

    it("returns false — at burned Monastery", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Monastery, isBurned: true }),
        { hand: [CARD_MARCH, CARD_WOUND] }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });
  });

  describe("learning discount sink", () => {
    it("returns true — Learning discount active with AAs in offer", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH],
        position: { q: 0, r: 0 },
      });

      const learningModifier: ActiveModifier = {
        id: "learning-mod",
        source: {
          type: SOURCE_CARD,
          cardId: "learning" as CardId,
          playerId: "player1",
        },
        duration: DURATION_TURN,
        scope: { type: SCOPE_SELF },
        effect: {
          type: EFFECT_LEARNING_DISCOUNT,
          influenceCost: 3,
        },
        createdAtRound: 1,
        createdByPlayerId: "player1",
      };

      const state = createTestGameState({
        players: [player],
        activeModifiers: [learningModifier],
        offers: {
          units: [],
          advancedActions: { cards: ["some_aa" as CardId] },
          spells: { cards: [] },
          commonSkills: [],
          monasteryAdvancedActions: [],
          bondsOfLoyaltyBonusUnits: [],
        },
      });

      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });
  });

  describe("card-based sinks", () => {
    it("returns true — Ruthless Coercion in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_KRANG_RUTHLESS_COERCION],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns true — Peaceful Moment in hand, action available, wounds in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_PEACEFUL_MOMENT as CardId, CARD_WOUND],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns false — Peaceful Moment in hand but action already taken", () => {
      const player = createTestPlayer({
        hand: [CARD_PEACEFUL_MOMENT as CardId, CARD_WOUND],
        position: { q: 0, r: 0 },
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });

    it("returns false — Peaceful Moment in hand, action available, but no wounds and no wounded units", () => {
      const player = createTestPlayer({
        hand: [CARD_PEACEFUL_MOMENT as CardId, CARD_MARCH],
        position: { q: 0, r: 0 },
      });
      const state = createTestGameState({ players: [player] });
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });
  });

  describe("after rest scenarios", () => {
    it("returns true — Ruthless Coercion in hand", () => {
      const player = createTestPlayer({
        hand: [CARD_MARCH, CARD_KRANG_RUTHLESS_COERCION],
        position: { q: 0, r: 0 },
        hasRestedThisTurn: true,
        hasTakenActionThisTurn: true,
      });
      const state = createTestGameState({ players: [player] });
      expect(isInfluenceUseful(state, state.players[0])).toBe(true);
    });

    it("returns false — at Village (action taken, can't interact)", () => {
      const { state } = createStateWithSite(
        createSite({ type: SiteType.Village }),
        {
          hand: [CARD_MARCH, CARD_WOUND],
          hasRestedThisTurn: true,
          hasTakenActionThisTurn: true,
        }
      );
      expect(isInfluenceUseful(state, state.players[0])).toBe(false);
    });
  });
});

describe("sideways gating integration", () => {
  it("normal turn at Village with wounds — sideways includes INFLUENCE", () => {
    const player = createTestPlayer({
      position: { q: 0, r: 0 },
      hand: [CARD_MARCH, CARD_WOUND],
    });
    const hex = createTestHex(
      0,
      0,
      undefined,
      createVillageSite()
    );
    const state = createTestGameState({
      players: [player],
      map: {
        hexes: { [hexKey({ q: 0, r: 0 })]: hex },
        tiles: [],
        tileDeck: { countryside: [], core: [] },
      },
    });

    const context = getSidewaysContext(state, state.players[0]);
    const choices = getAllowedSidewaysChoices(context);

    expect(choices).toContain(PLAY_SIDEWAYS_AS_MOVE);
    expect(choices).toContain(PLAY_SIDEWAYS_AS_INFLUENCE);
  });

  it("normal turn in wilderness, no cards — sideways excludes INFLUENCE", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      position: { q: 0, r: 0 },
    });
    const state = createTestGameState({ players: [player] });

    const context = getSidewaysContext(state, state.players[0]);
    const choices = getAllowedSidewaysChoices(context);

    expect(choices).toContain(PLAY_SIDEWAYS_AS_MOVE);
    expect(choices).not.toContain(PLAY_SIDEWAYS_AS_INFLUENCE);
  });

  it("after rest with Ruthless Coercion — sideways = [INFLUENCE]", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH, CARD_KRANG_RUTHLESS_COERCION],
      position: { q: 0, r: 0 },
      hasRestedThisTurn: true,
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const context = getSidewaysContext(state, state.players[0]);
    const choices = getAllowedSidewaysChoices(context);

    expect(choices).toEqual([PLAY_SIDEWAYS_AS_INFLUENCE]);
  });

  it("after rest without consumer — sideways = []", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      position: { q: 0, r: 0 },
      hasRestedThisTurn: true,
      hasTakenActionThisTurn: true,
    });
    const state = createTestGameState({ players: [player] });

    const context = getSidewaysContext(state, state.players[0]);
    const choices = getAllowedSidewaysChoices(context);

    expect(choices).toEqual([]);
  });

  it("combat block phase — sideways = [BLOCK] (unaffected)", () => {
    const player = createTestPlayer({
      hand: [CARD_MARCH],
      position: { q: 0, r: 0 },
    });
    const state = createTestGameState({
      players: [player],
      combat: createUnitCombatState(COMBAT_PHASE_BLOCK),
    });

    const context = getSidewaysContext(state, state.players[0]);
    const choices = getAllowedSidewaysChoices(context);

    expect(choices).toEqual([PLAY_SIDEWAYS_AS_BLOCK]);
  });
});
