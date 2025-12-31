import { describe, it, expect } from "vitest";
import { createInitialGameState } from "../src/state/GameState.js";

describe("GameState", () => {
  it("creates initial game state with correct defaults", () => {
    const state = createInitialGameState();

    expect(state.phase).toBe("setup");
    expect(state.timeOfDay).toBe("day");
    expect(state.round).toBe(1);
    expect(state.currentPlayerIndex).toBe(0);
    expect(state.map).toBeDefined();
  });
});
