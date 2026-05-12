import { describe, expect, it } from "bun:test";
import { shouldIgnoreHandClick } from "../src/components/Hand/handPointerGuards";

describe("hand pointer guards", () => {
  it("ignores focus-mode hand clicks while a card pie menu is active", () => {
    expect(
      shouldIgnoreHandClick({
        viewMode: "focus",
        isActive: true,
        isOverlayActive: true,
        inCombat: false,
        cardInteractionType: "action-select",
      })
    ).toBe(true);
  });

  it("allows focus-mode hand clicks when no card interaction is active", () => {
    expect(
      shouldIgnoreHandClick({
        viewMode: "focus",
        isActive: true,
        isOverlayActive: true,
        inCombat: false,
        cardInteractionType: "idle",
      })
    ).toBe(false);
  });

  it("still ignores hidden hand panes", () => {
    expect(
      shouldIgnoreHandClick({
        viewMode: "board",
        isActive: true,
        isOverlayActive: false,
        inCombat: false,
        cardInteractionType: "idle",
      })
    ).toBe(true);
  });
});
