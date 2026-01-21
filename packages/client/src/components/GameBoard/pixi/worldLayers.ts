import { Container } from "pixi.js";
import type { WorldLayers } from "./types";

/**
 * Create the world container hierarchy with labeled layers.
 */
export function createWorldLayers(): { world: Container; layers: WorldLayers } {
  const world = new Container();
  world.label = "world";

  const layers: WorldLayers = {
    boardShape: new Container(),
    shadows: new Container(),
    tiles: new Container(),
    particles: new Container(),
    hexOverlays: new Container(),
    pathPreview: new Container(),
    enemies: new Container(),
    hero: new Container(),
    ghostHexes: new Container(),
    ui: new Container(),
  };

  // Label layers for debugging
  layers.boardShape.label = "boardShape";
  layers.shadows.label = "shadows";
  layers.tiles.label = "tiles";
  layers.particles.label = "particles";
  layers.hexOverlays.label = "hexOverlays";
  layers.pathPreview.label = "pathPreview";
  layers.enemies.label = "enemies";
  layers.hero.label = "hero";
  layers.ghostHexes.label = "ghostHexes";
  layers.ui.label = "ui";

  // Add in z-order (bottom to top)
  world.addChild(layers.boardShape);
  world.addChild(layers.shadows);
  world.addChild(layers.tiles);
  world.addChild(layers.particles);
  world.addChild(layers.hexOverlays);
  world.addChild(layers.pathPreview);
  world.addChild(layers.enemies);
  world.addChild(layers.hero);
  world.addChild(layers.ghostHexes);
  world.addChild(layers.ui);

  return { world, layers };
}
