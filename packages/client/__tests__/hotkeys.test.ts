import { describe, expect, it } from "bun:test";
import { matchesHotkey } from "../src/utils/hotkeys";

function keyEvent(key: string, code: string): KeyboardEvent {
  return { key, code } as KeyboardEvent;
}

describe("matchesHotkey", () => {
  it("matches printable key values", () => {
    expect(matchesHotkey(keyEvent("4", ""), ["4"])).toBe(true);
    expect(matchesHotkey(keyEvent("Q", ""), ["q"])).toBe(true);
  });

  it("matches physical key codes when key is unreliable", () => {
    expect(matchesHotkey(keyEvent("Unidentified", "Digit4"), ["4"], ["Digit4"])).toBe(true);
    expect(matchesHotkey(keyEvent("Unidentified", "Numpad4"), ["4"], ["Numpad4"])).toBe(true);
    expect(matchesHotkey(keyEvent("Unidentified", "KeyQ"), ["q"], ["KeyQ"])).toBe(true);
  });
});
