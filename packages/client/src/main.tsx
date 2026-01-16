import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { loadAtlas } from "./utils/cardAtlas";
import "./styles/index.css";

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
