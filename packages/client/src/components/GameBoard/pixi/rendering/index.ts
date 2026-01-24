/**
 * Rendering modules for PixiJS hex grid
 *
 * Re-exports all rendering functions for convenient imports.
 */

export { renderTiles, renderStaticTileOutlines, applyScreenShake, type RenderTilesResult } from "./tiles";
export { renderEnemies, animateEnemyFlips, type EnemyFlipTarget } from "./enemies";
export { renderRuinsTokens, animateRuinsFlips, type RuinsFlipTarget } from "./ruinsTokens";
export { renderHeroIntoContainer, getOrCreateHeroContainer } from "./hero";
export { renderHexOverlays, type MoveHighlight, type MoveHighlightType, type HexHoverEvent } from "./overlays";
export { renderPathPreview } from "./pathPreview";
export { renderReachabilityBoundary } from "./boundaryOutline";
export {
  renderGhostHexes,
  renderBoardShape,
  setGhostHexTicker,
  cleanupGhostHexEffects,
  type ExploreTarget,
} from "./ghostHexes";
