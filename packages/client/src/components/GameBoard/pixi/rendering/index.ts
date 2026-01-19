/**
 * Rendering modules for PixiJS hex grid
 *
 * Re-exports all rendering functions for convenient imports.
 */

export { renderTiles, applyScreenShake, type RenderTilesResult } from "./tiles";
export { renderEnemies } from "./enemies";
export { renderHeroIntoContainer, getOrCreateHeroContainer } from "./hero";
export { renderHexOverlays, type MoveHighlight, type MoveHighlightType, type HexHoverEvent } from "./overlays";
export { renderPathPreview } from "./pathPreview";
export {
  renderGhostHexes,
  renderBoardShape,
  setGhostHexTicker,
  cleanupGhostHexEffects,
  type ExploreTarget,
} from "./ghostHexes";
