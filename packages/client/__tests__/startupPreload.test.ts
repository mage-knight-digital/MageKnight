import { describe, expect, it } from "bun:test";

describe("client startup preloading", () => {
  it("renders the app before warming all sprite sheets", async () => {
    const source = await Bun.file(new URL("../src/main.tsx", import.meta.url)).text();

    const renderIndex = source.indexOf("createRoot(rootElement).render");
    const spritePreloadIndex = source.indexOf("preloadAllSpriteSheets()");

    expect(renderIndex).toBeGreaterThan(-1);
    expect(spritePreloadIndex).toBeGreaterThan(-1);
    expect(spritePreloadIndex).toBeGreaterThan(renderIndex);
  });
});
