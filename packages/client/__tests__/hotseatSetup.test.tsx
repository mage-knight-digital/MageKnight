import { describe, expect, it } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  GAME_LAUNCH_MODE_HOTSEAT,
  GAME_SEAT_CONTROLLER_LOCAL,
  SCENARIO_BLITZ_CONQUEST_3P,
  SCENARIO_FULL_CONQUEST_2P,
  SCENARIO_FULL_CONQUEST_4P,
} from "@mage-knight/shared";
import {
  createGameConfigForSetup,
  getSetupScenarioLaunchConfig,
} from "../src/components/Setup/SetupScreen";
import { HotseatPassScreen } from "../src/components/HotseatPassScreen";

describe("hotseat setup", () => {
  it("emits hotseat config with stable engine player ids", () => {
    const config = createGameConfigForSetup(
      2,
      ["arythea", "tovak"],
      { scenarioId: SCENARIO_FULL_CONQUEST_2P }
    );

    expect(config).not.toBeNull();
    expect(config?.launchMode).toBe(GAME_LAUNCH_MODE_HOTSEAT);
    expect(config?.playerIds).toEqual(["player_0", "player_1"]);
    expect(config?.seats).toEqual([
      {
        playerId: "player_0",
        heroId: "arythea",
        controller: GAME_SEAT_CONTROLLER_LOCAL,
      },
      {
        playerId: "player_1",
        heroId: "tovak",
        controller: GAME_SEAT_CONTROLLER_LOCAL,
      },
    ]);
  });

  it("maps conquest scenarios to explicit player-count variants", () => {
    expect(getSetupScenarioLaunchConfig("full_conquest", 2)?.scenarioId).toBe(
      SCENARIO_FULL_CONQUEST_2P
    );
    expect(getSetupScenarioLaunchConfig("full_conquest", 4)?.scenarioId).toBe(
      SCENARIO_FULL_CONQUEST_4P
    );
    expect(getSetupScenarioLaunchConfig("blitz_conquest", 3)?.scenarioId).toBe(
      SCENARIO_BLITZ_CONQUEST_3P
    );
  });

  it("renders the hotseat pass screen for the next active player", () => {
    const html = renderToStaticMarkup(
      <HotseatPassScreen playerId="player_1" hero="tovak" onContinue={() => {}} />
    );

    expect(html).toContain("Pass to Tovak");
    expect(html).toContain("Reveal turn");
  });
});
