import { describe, expect, it } from "bun:test";
import { skillImagePath } from "../src/utils/skillImagePath";

describe("skillImagePath", () => {
  it("maps co-op skill ids to scanned asset stems", () => {
    expect(skillImagePath("norowas_prayer_of_weather")).toBe(
      "/assets/skills/norowas_calming_the_weather_co-op.jpg"
    );
    expect(skillImagePath("wolfhawk_wolfs_howl")).toBe(
      "/assets/skills/wolfhawk_howl_of_the_pack_co-op.jpg"
    );
  });

  it("uses the skill id as the stem when no alias exists", () => {
    expect(skillImagePath("norowas_motivation")).toBe(
      "/assets/skills/norowas_motivation.jpg"
    );
  });
});
