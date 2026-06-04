import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadAtlas } from "./utils/cardAtlas";
import { preloadAllSpriteSheets } from "./components/PixiCard/PixiCardCanvas";
import "./styles/index.css";
import "./styles/animations/tile-reveal.css";

if (import.meta.env.DEV) {
  const originalRAF = window.requestAnimationFrame;
  window.requestAnimationFrame = (callback) => {
    return originalRAF((time) => {
      const start = performance.now();
      callback(time);
      const duration = performance.now() - start;
      if (duration > 50) {
        console.warn(`Slow rAF: ${duration.toFixed(1)}ms`, new Error().stack);
      }
    });
  };
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Atlas metadata is small and needed for sprite lookups. The large sheets are
// warmed after first render so setup is visible while the cache fills.
loadAtlas().then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );

  warmSpriteSheetsAfterFirstPaint();
});

function warmSpriteSheetsAfterFirstPaint(): void {
  const warmSpriteSheets = () => {
    preloadAllSpriteSheets().catch((error) => {
      console.warn("Failed to warm sprite sheets:", error);
    });
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(warmSpriteSheets, { timeout: 1500 });
    return;
  }

  globalThis.setTimeout(warmSpriteSheets, 0);
}
