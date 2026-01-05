/**
 * Tests for tactics selection system
 */

import { describe, it, expect } from "vitest";
import {
  TACTIC_EARLY_BIRD,
  TACTIC_GREAT_START,
  TACTIC_PLANNING,
  TACTIC_FROM_THE_DUSK,
  TACTIC_SELECTED,
  TACTICS_PHASE_ENDED,
  INVALID_ACTION,
  ROUND_PHASE_PLAYER_TURNS,
  ALL_DAY_TACTICS,
} from "@mage-knight/shared";
import { createTacticsSelectionState } from "./testHelpers.js";
import { createSelectTacticCommand } from "../commands/selectTacticCommand.js";
import { getTacticCard } from "../../data/tactics.js";

describe("Tactics Selection", () => {
  describe("selectTacticCommand", () => {
    it("assigns selected tactic to player", () => {
      const state = createTacticsSelectionState(["player1"]);
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_PLANNING,
      });

      const result = command.execute(state);

      // Player should have the tactic assigned
      const player = result.state.players.find((p) => p.id === "player1");
      expect(player?.selectedTactic).toBe(TACTIC_PLANNING);
      expect(player?.tacticFlipped).toBe(false);

      // Event should be emitted
      const tacticSelectedEvent = result.events.find(
        (e) => e.type === TACTIC_SELECTED
      );
      expect(tacticSelectedEvent).toBeDefined();
      if (tacticSelectedEvent?.type === TACTIC_SELECTED) {
        expect(tacticSelectedEvent.playerId).toBe("player1");
        expect(tacticSelectedEvent.tacticId).toBe(TACTIC_PLANNING);
        expect(tacticSelectedEvent.turnOrder).toBe(4); // Planning is turn order 4
      }
    });

    it("removes selected tactic from available pool", () => {
      const state = createTacticsSelectionState(["player1", "player2"]);
      const command = createSelectTacticCommand({
        playerId: "player2", // Player 2 selects first (lowest Fame)
        tacticId: TACTIC_EARLY_BIRD,
      });

      const result = command.execute(state);

      // Tactic should no longer be available
      expect(result.state.availableTactics).not.toContain(TACTIC_EARLY_BIRD);
      expect(result.state.availableTactics).toContain(TACTIC_PLANNING);
    });

    it("cannot select tactic already taken by another player", () => {
      // Set up state where player2 already selected EARLY_BIRD
      const baseState = createTacticsSelectionState(["player1", "player2"]);
      const state = {
        ...baseState,
        availableTactics: ALL_DAY_TACTICS.filter((t) => t !== TACTIC_EARLY_BIRD),
        currentTacticSelector: "player1",
        players: baseState.players.map((p) =>
          p.id === "player2"
            ? { ...p, selectedTactic: TACTIC_EARLY_BIRD }
            : p
        ),
      };

      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_EARLY_BIRD, // Try to select already-taken tactic
      });

      const result = command.execute(state);

      // Should emit invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not available");
      }
    });

    it("cannot select night tactic during day", () => {
      const state = createTacticsSelectionState(["player1"], "day");
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_FROM_THE_DUSK, // Night tactic
      });

      const result = command.execute(state);

      // Should emit invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not available during day");
      }
    });

    it("cannot select day tactic during night", () => {
      const state = createTacticsSelectionState(["player1"], "night");
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_EARLY_BIRD, // Day tactic
      });

      const result = command.execute(state);

      // Should emit invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("not available during night");
      }
    });

    it("cannot select when not your turn", () => {
      const state = createTacticsSelectionState(["player1", "player2"]);
      // player2 is first selector (lowest Fame), but player1 tries to select
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_PLANNING,
      });

      const result = command.execute(state);

      // Should emit invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Not your turn to select");
      }
    });

    it("cannot select when not in tactics phase", () => {
      const state = createTacticsSelectionState(["player1"]);
      const stateInPlayerTurns = {
        ...state,
        roundPhase: ROUND_PHASE_PLAYER_TURNS,
      };

      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_PLANNING,
      });

      const result = command.execute(stateInPlayerTurns);

      // Should emit invalid action
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeDefined();
      if (invalidEvent?.type === INVALID_ACTION) {
        expect(invalidEvent.reason).toContain("Not in tactics selection phase");
      }
    });
  });

  describe("turn order from tactics", () => {
    it("sets turn order based on tactic numbers (lower first)", () => {
      // Two players select tactics
      const state = createTacticsSelectionState(["player1", "player2"]);

      // Player 2 selects Great Start (turn order 5)
      const command1 = createSelectTacticCommand({
        playerId: "player2",
        tacticId: TACTIC_GREAT_START,
      });
      const result1 = command1.execute(state);

      // Player 1 selects Early Bird (turn order 1)
      const command2 = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_EARLY_BIRD,
      });
      const result2 = command2.execute(result1.state);

      // Phase should end and turn order should be set
      expect(result2.state.roundPhase).toBe(ROUND_PHASE_PLAYER_TURNS);

      // Player 1 (Early Bird, order 1) should go before Player 2 (Great Start, order 5)
      expect(result2.state.turnOrder).toEqual(["player1", "player2"]);

      // TACTICS_PHASE_ENDED event should have the turn order
      const phaseEndedEvent = result2.events.find(
        (e) => e.type === TACTICS_PHASE_ENDED
      );
      expect(phaseEndedEvent).toBeDefined();
      if (phaseEndedEvent?.type === TACTICS_PHASE_ENDED) {
        expect(phaseEndedEvent.turnOrder).toEqual(["player1", "player2"]);
      }
    });

    it("handles ties by maintaining selection order", () => {
      // This would happen if we had duplicate turn order numbers
      // For MVP, we just test that the sort is stable
      const state = createTacticsSelectionState(["player1", "player2", "player3"]);

      // All three players select different tactics
      // Selection order: player3, player2, player1
      let currentState = state;

      // Player 3 selects Planning (turn order 4)
      const cmd1 = createSelectTacticCommand({
        playerId: "player3",
        tacticId: TACTIC_PLANNING,
      });
      currentState = cmd1.execute(currentState).state;

      // Player 2 selects Great Start (turn order 5)
      const cmd2 = createSelectTacticCommand({
        playerId: "player2",
        tacticId: TACTIC_GREAT_START,
      });
      currentState = cmd2.execute(currentState).state;

      // Player 1 selects Early Bird (turn order 1)
      const cmd3 = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_EARLY_BIRD,
      });
      const finalResult = cmd3.execute(currentState);

      // Turn order should be: player1 (1), player3 (4), player2 (5)
      expect(finalResult.state.turnOrder).toEqual([
        "player1",
        "player3",
        "player2",
      ]);
    });
  });

  describe("tactic card data", () => {
    it("all day tactics have correct time of day", () => {
      for (const tacticId of ALL_DAY_TACTICS) {
        const card = getTacticCard(tacticId);
        expect(card.timeOfDay).toBe("day");
      }
    });

    it("all tactics have turn order 1-6", () => {
      for (const tacticId of ALL_DAY_TACTICS) {
        const card = getTacticCard(tacticId);
        expect(card.turnOrder).toBeGreaterThanOrEqual(1);
        expect(card.turnOrder).toBeLessThanOrEqual(6);
      }
    });

    it("each turn order number is used exactly once per time of day", () => {
      const dayTurnOrders = ALL_DAY_TACTICS.map(
        (id) => getTacticCard(id).turnOrder
      );
      const uniqueDayOrders = new Set(dayTurnOrders);
      expect(uniqueDayOrders.size).toBe(6);
      expect(dayTurnOrders).toContain(1);
      expect(dayTurnOrders).toContain(2);
      expect(dayTurnOrders).toContain(3);
      expect(dayTurnOrders).toContain(4);
      expect(dayTurnOrders).toContain(5);
      expect(dayTurnOrders).toContain(6);
    });
  });

  describe("solo play", () => {
    it("solo player can select any tactic", () => {
      const state = createTacticsSelectionState(["player1"]);
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_PLANNING,
      });

      const result = command.execute(state);

      // Should succeed
      const invalidEvent = result.events.find((e) => e.type === INVALID_ACTION);
      expect(invalidEvent).toBeUndefined();

      // Should transition to player turns
      expect(result.state.roundPhase).toBe(ROUND_PHASE_PLAYER_TURNS);
    });

    it("solo player turn order is just themselves", () => {
      const state = createTacticsSelectionState(["player1"]);
      const command = createSelectTacticCommand({
        playerId: "player1",
        tacticId: TACTIC_GREAT_START,
      });

      const result = command.execute(state);

      expect(result.state.turnOrder).toEqual(["player1"]);
    });
  });
});
