import { describe, expect, it } from "bun:test";
import {
  makeInvisiblePointerHitTarget,
  makePointerPassthrough,
} from "../src/components/CardInteraction/pixiHitTesting";

describe("pie menu hit testing", () => {
  it("makes labels ignore pointer hits so clicks reach the wedge underneath", () => {
    const label = {
      eventMode: "static" as const,
      cursor: "pointer",
    };

    makePointerPassthrough(label);

    expect(label.eventMode).toBe("none");
    expect(label.cursor).toBe("default");
  });

  it("creates an invisible pointer target for text-covered wedge areas", () => {
    const hitTarget = {
      eventMode: "none" as const,
      cursor: "default",
      alpha: 1,
    };

    makeInvisiblePointerHitTarget(hitTarget);

    expect(hitTarget.eventMode).toBe("static");
    expect(hitTarget.cursor).toBe("pointer");
    expect(hitTarget.alpha).toBeGreaterThan(0);
    expect(hitTarget.alpha).toBeLessThan(0.01);
  });
});
