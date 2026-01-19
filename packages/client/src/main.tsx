import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadAtlas } from "./utils/cardAtlas";
import "./styles/index.css";

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

// Load atlas early so sprites are ready for all components
loadAtlas();

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
