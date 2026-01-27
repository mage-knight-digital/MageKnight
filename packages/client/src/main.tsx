import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadAtlas } from "./utils/cardAtlas";
import { preloadAllSpriteSheets } from "./components/PixiCard/PixiCardCanvas";
import "./styles/index.css";
import "./styles/animations/tile-reveal.css";

// DEBUG: Instrument requestAnimationFrame to catch slow frames
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

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

// Preload all assets before rendering:
// 1. loadAtlas() - loads atlas.json and precomputes sprite styles
// 2. preloadAllSpriteSheets() - uses PixiJS Assets.load() to upload textures to GPU
// PixiJS properly handles GPU texture upload, unlike DOM/CSS approaches.
Promise.all([loadAtlas(), preloadAllSpriteSheets()]).then(() => {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
});
