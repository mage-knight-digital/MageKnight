import { useCallback, useEffect, useRef, useState } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { Application, Container } from "pixi.js";
import type { ClientGameState, ClientPlayer, HexCoord } from "@mage-knight/shared";
import { TIME_OF_DAY_NIGHT, hexKey, TILE_HEX_OFFSETS } from "@mage-knight/shared";
import type { CinematicSequence } from "../../../contexts/CinematicContext";
import type { AnimationEvent } from "../../../contexts/AnimationDispatcherContext";
import type { PixelPosition, CameraState } from "../pixi/types";
import { CAMERA_MAX_ZOOM } from "../pixi/types";
import {
  AnimationManager,
  Easing,
  HERO_MOVE_DURATION_MS,
  ENEMY_FLIP_STAGGER_MS,
  INTRO_PHASE_GAP_MS,
} from "../pixi/animations";
import {
  ParticleManager,
  HEX_OUTLINE_DURATION_MS,
  TILE_RISE_DURATION_MS,
  TILE_SLAM_DURATION_MS,
  PORTAL_HERO_EMERGE_DURATION_MS,
} from "../pixi/particles";
import { BackgroundAtmosphere } from "../pixi/background";
import { applyCamera, clampCameraCenter } from "../pixi/camera";
import { hexToPixel, calculateBounds } from "../pixi/hexMath";
import type { WorldLayers } from "../pixi/types";
import {
  renderTiles,
  renderStaticTileOutlines,
  renderEnemies,
  animateEnemyFlips,
  renderRuinsTokens,
  renderHeroIntoContainer,
  getOrCreateHeroContainer,
  renderBoardShape,
  type ExploreTarget,
  type EnemyFlipTarget,
} from "../pixi/rendering";
import { preloadIntroAssets } from "../pixi/preloadIntroAssets";

interface UseGameBoardRendererParams {
  isInitialized: boolean;
  state: ClientGameState | null;
  player: ClientPlayer | null;
  exploreTargets: ExploreTarget[];
  appRef: RefObject<Application | null>;
  layersRef: RefObject<WorldLayers | null>;
  worldRef: RefObject<Container | null>;
  animationManagerRef: RefObject<AnimationManager | null>;
  particleManagerRef: RefObject<ParticleManager | null>;
  backgroundRef: RefObject<BackgroundAtmosphere | null>;
  heroContainerRef: RefObject<Container | null>;
  cameraRef: MutableRefObject<CameraState>;
  hasCenteredOnHeroRef: MutableRefObject<boolean>;
  cameraReadyRef: MutableRefObject<boolean>;
  centerAndApplyCamera: (worldPos: PixelPosition, instant?: boolean) => void;
  emitAnimationEvent: (event: AnimationEvent) => void;
  startIntro: (tileCount: number, enemyCount: number) => void;
  isInCinematic: boolean;
  playCinematic: (sequence: CinematicSequence) => void;
  onHeroRightClick?: () => void;
}

interface UseGameBoardRendererReturn {
  isLoading: boolean;
  revealingHexKeysRef: RefObject<Set<string>>;
  revealingUpdateCounter: number;
  resetRenderer: () => void;
}

type TileState = ClientGameState["map"]["tiles"][number];

export function useGameBoardRenderer({
  isInitialized,
  state,
  player,
  exploreTargets,
  appRef,
  layersRef,
  worldRef,
  animationManagerRef,
  particleManagerRef,
  backgroundRef,
  heroContainerRef,
  cameraRef,
  hasCenteredOnHeroRef,
  cameraReadyRef,
  centerAndApplyCamera,
  emitAnimationEvent,
  startIntro,
  isInCinematic,
  playCinematic,
  onHeroRightClick,
}: UseGameBoardRendererParams): UseGameBoardRendererReturn {
  const [isLoading, setIsLoading] = useState(true);

  const prevHeroPositionRef = useRef<HexCoord | null>(null);
  const introPlayedRef = useRef(false);
  const prevTileCountRef = useRef(0);
  const knownTileIdsRef = useRef<Set<string>>(new Set());
  const revealedEnemyTokenIdsRef = useRef<Set<string>>(new Set());
  const pendingFlipTokenIdsRef = useRef<Set<string>>(new Set());
  const pendingFlipTargetsRef = useRef<EnemyFlipTarget[]>([]);
  const flipAnimationInProgressRef = useRef(false);

  const revealingHexKeysRef = useRef<Set<string>>(new Set());
  const [revealingUpdateCounter, setRevealingUpdateCounter] = useState(0);

  const resetRenderer = useCallback(() => {
    revealingHexKeysRef.current = new Set();
    setRevealingUpdateCounter((c) => c + 1);
  }, []);

  const timeOfDay = state?.timeOfDay;
  useEffect(() => {
    if (!isInitialized || !timeOfDay || !backgroundRef.current) return;
    backgroundRef.current.setNight(timeOfDay === TIME_OF_DAY_NIGHT);
  }, [isInitialized, timeOfDay, backgroundRef]);

  useEffect(() => {
    if (!isInitialized || !state || !layersRef.current || !worldRef.current) return;

    const layers = layersRef.current;
    const world = worldRef.current;
    const heroPosition = player?.position ?? null;
    const animManager = animationManagerRef.current;
    const particleManager = particleManagerRef.current;

    const plan = buildRenderPlan(state, prevTileCountRef, knownTileIdsRef);
    const { isFirstLoad, shouldPlayTileIntro, isExploration, newTiles } = plan;

    if (isExploration && !isInCinematic) {
      const newTile = newTiles[0];
      const newTilePosition = newTile ? hexToPixel(newTile.centerCoord) : null;
      const heroPixelPosition = heroPosition ? hexToPixel(heroPosition) : null;

      const newHexKeysImmediate = collectTileHexKeys(newTiles);
      revealingHexKeysRef.current = newHexKeysImmediate;
      setRevealingUpdateCounter((c) => c + 1);

      const adjacentFlipTargets = collectAdjacentFlipTargets(
        state,
        newHexKeysImmediate,
        revealedEnemyTokenIdsRef.current
      );

      if (adjacentFlipTargets.length > 0) {
        console.log(
          "[PixiHexGrid] Will flip adjacent enemies after exploration:",
          adjacentFlipTargets.map((t) => t.tokenId)
        );
        pendingFlipTokenIdsRef.current = new Set(
          adjacentFlipTargets.map((t) => t.tokenId)
        );
        pendingFlipTargetsRef.current = adjacentFlipTargets;
      }

      const camera = cameraRef.current;
      for (const tile of newTiles) {
        const tileCenter = hexToPixel(tile.centerCoord);
        const TILE_PADDING = 200;
        camera.bounds.minX = Math.min(camera.bounds.minX, tileCenter.x - TILE_PADDING);
        camera.bounds.maxX = Math.max(camera.bounds.maxX, tileCenter.x + TILE_PADDING);
        camera.bounds.minY = Math.min(camera.bounds.minY, tileCenter.y - TILE_PADDING);
        camera.bounds.maxY = Math.max(camera.bounds.maxY, tileCenter.y + TILE_PADDING);
      }

      const TRACER_DURATION = HEX_OUTLINE_DURATION_MS + 240 + 100;
      const TILE_DROP_DURATION = TILE_RISE_DURATION_MS + TILE_SLAM_DURATION_MS + 200;
      const ENEMY_DROP_ESTIMATE = 400;
      const EXPLORATION_TOTAL_DURATION =
        TRACER_DURATION + TILE_DROP_DURATION + ENEMY_DROP_ESTIMATE;
      const CAMERA_PAN_DURATION = 600;

      const capturedLayers = layersRef.current;
      const capturedAnimManager = animManager;
      const capturedParticleManager = particleManager;

      const explorationCinematic: CinematicSequence = {
        id: "exploration",
        name: `Explore tile ${newTiles[0]?.tileId}`,
        steps: [
          {
            id: "pan-to-tile",
            description: "Pan camera to new tile",
            duration: newTilePosition ? CAMERA_PAN_DURATION : 0,
            execute: () => {
              if (newTilePosition) {
                centerAndApplyCamera(newTilePosition, false);
              }
            },
          },
          {
            id: "tile-animation",
            description: "Tile reveal animation (tracer + drop + enemies)",
            duration: EXPLORATION_TOTAL_DURATION,
            execute: () => {},
          },
          {
            id: "pan-to-hero",
            description: "Pan camera back to hero",
            duration: heroPixelPosition ? CAMERA_PAN_DURATION : 0,
            execute: () => {
              if (heroPixelPosition) {
                centerAndApplyCamera(heroPixelPosition, false);
              }
            },
          },
        ],
        onComplete: () => {
          console.log("[PixiHexGrid] Exploration cinematic complete");

          if (
            pendingFlipTargetsRef.current.length > 0 &&
            capturedLayers &&
            capturedAnimManager &&
            capturedParticleManager
          ) {
            const flipTargets = pendingFlipTargetsRef.current;
            pendingFlipTargetsRef.current = [];
            flipAnimationInProgressRef.current = true;

            console.log(
              "[PixiHexGrid] Starting post-exploration flip for:",
              flipTargets.map((t) => t.tokenId)
            );

            setTimeout(() => {
              animateEnemyFlips(
                capturedLayers,
                flipTargets,
                capturedAnimManager,
                capturedParticleManager,
                0,
                () => {
                  pendingFlipTokenIdsRef.current = new Set();
                  flipAnimationInProgressRef.current = false;
                  console.log("[PixiHexGrid] Post-exploration flip complete");
                }
              );
            }, 200);
          }
        },
      };

      playCinematic(explorationCinematic);
    }

    const { currentRevealedEnemyIds, enemyInfoByTokenId } =
      collectRevealedEnemies(state);

    const newlyRevealedTokenIds: string[] = [];
    for (const tokenId of currentRevealedEnemyIds) {
      if (!revealedEnemyTokenIdsRef.current.has(tokenId)) {
        newlyRevealedTokenIds.push(tokenId);
      }
    }

    revealedEnemyTokenIdsRef.current = currentRevealedEnemyIds;

    const shouldPlayEnemyReveal =
      newlyRevealedTokenIds.length > 0 &&
      !isExploration &&
      !isInCinematic &&
      !isFirstLoad &&
      animManager &&
      particleManager;

    if (shouldPlayEnemyReveal) {
      console.log(
        "[PixiHexGrid] Scheduling enemy reveal for:",
        newlyRevealedTokenIds
      );

      pendingFlipTokenIdsRef.current = new Set(newlyRevealedTokenIds);

      pendingFlipTargetsRef.current = newlyRevealedTokenIds
        .map((tokenId) => {
          const info = enemyInfoByTokenId.get(tokenId);
          if (!info) return null;
          return {
            tokenId,
            hexCoord: info.hexCoord,
            color: info.color,
            indexInHex: info.indexInHex,
            totalInHex: info.totalInHex,
          };
        })
        .filter((t): t is EnemyFlipTarget => t !== null);
    }

    const renderAsync = async () => {
      const renderStart = performance.now();

      const heroId = player?.heroId ?? null;
      await preloadIntroAssets(state, heroId);

      if (!hasCenteredOnHeroRef.current && appRef.current) {
        const app = appRef.current;

        const hexes = Object.values(state.map.hexes);
        const hexPositions = hexes.map((h) => hexToPixel(h.coord));
        for (const target of exploreTargets) {
          hexPositions.push(hexToPixel(target.coord));
        }
        const currentBounds = calculateBounds(hexPositions);

        const GRID_PADDING = 150;
        const paddedBounds = {
          minX: currentBounds.minX - GRID_PADDING,
          maxX: currentBounds.maxX + GRID_PADDING,
          minY: currentBounds.minY - GRID_PADDING,
          maxY: currentBounds.maxY + GRID_PADDING,
          width: currentBounds.width + GRID_PADDING * 2,
          height: currentBounds.height + GRID_PADDING * 2,
        };

        const minZoomX = app.screen.width / paddedBounds.width;
        const minZoomY = app.screen.height / paddedBounds.height;
        const dynamicMinZoom = Math.max(minZoomX, minZoomY) * 0.6;
        const scaleX = app.screen.width / currentBounds.width;
        const scaleY = app.screen.height / currentBounds.height;
        const fitZoom = Math.min(scaleX, scaleY) * 0.85;
        const initialZoom = Math.max(
          dynamicMinZoom,
          Math.min(fitZoom, CAMERA_MAX_ZOOM)
        );

        const camera = cameraRef.current;
        camera.minZoom = dynamicMinZoom;
        camera.targetZoom = initialZoom;
        camera.zoom = initialZoom;
        camera.bounds = {
          minX: paddedBounds.minX,
          maxX: paddedBounds.maxX,
          minY: paddedBounds.minY,
          maxY: paddedBounds.maxY,
        };
        camera.screenWidth = app.screen.width;
        camera.screenHeight = app.screen.height;

        const initialPos = heroPosition
          ? hexToPixel(heroPosition)
          : {
            x: currentBounds.minX + currentBounds.width / 2,
            y: currentBounds.minY + currentBounds.height / 2,
          };
        camera.targetCenter = { ...initialPos };

        clampCameraCenter(camera);

        camera.center = { ...camera.targetCenter };

        applyCamera(app, world, camera);
        world.visible = true;

        if (shouldPlayTileIntro && !introPlayedRef.current) {
          world.alpha = 0;
        }

        hasCenteredOnHeroRef.current = true;
        cameraReadyRef.current = true;

        app.renderer.render(app.stage);
      }

      const t_board = performance.now();
      renderBoardShape(layers, state.map.tileSlots);
      console.log(
        `[renderAsync] renderBoardShape: ${(performance.now() - t_board).toFixed(
          1
        )}ms`
      );

      const hexKeysToReveal = new Set(revealingHexKeysRef.current);

      const t_tiles = performance.now();
      if (!shouldPlayTileIntro) {
        const { revealingTileCoords } = await renderTiles(
          layers,
          state.map.tiles,
          animManager,
          particleManager,
          world,
          false,
          knownTileIdsRef.current,
          () => {
            emitAnimationEvent("tiles-complete");
            console.log("[PixiHexGrid] Tile intro complete");
          },
          () => {
            if (
              isExploration &&
              animManager &&
              particleManager &&
              hexKeysToReveal.size > 0
            ) {
              console.log(
                "[PixiHexGrid] Tile revealed, starting enemy animation for hexes:",
                [...hexKeysToReveal]
              );

              renderEnemies(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true,
                100,
                () => {
                  revealingHexKeysRef.current = new Set();
                  setRevealingUpdateCounter((c) => c + 1);
                },
                hexKeysToReveal,
                pendingFlipTokenIdsRef.current
              );

              // Render ruins tokens with drop animation (same timing as enemies)
              renderRuinsTokens(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true,
                100
              );
            } else {
              revealingHexKeysRef.current = new Set();
              setRevealingUpdateCounter((c) => c + 1);
            }
          }
        );

        if (
          revealingTileCoords.length === 0 &&
          revealingHexKeysRef.current.size > 0
        ) {
          console.log("[PixiHexGrid] No tiles to reveal, clearing revealing state");
          revealingHexKeysRef.current = new Set();
          setRevealingUpdateCounter((c) => c + 1);
        }
      }
      console.log(
        `[renderAsync] renderTiles: ${(performance.now() - t_tiles).toFixed(1)}ms`
      );

      if (!shouldPlayTileIntro) {
        const tileAnimationTime = 0;

        const t_enemies = performance.now();
        if (!isExploration && !flipAnimationInProgressRef.current) {
          await renderEnemies(
            layers,
            state.map.hexes,
            animManager,
            particleManager,
            false,
            tileAnimationTime,
            () => {
              emitAnimationEvent("enemies-complete");
              console.log("[PixiHexGrid] Enemy intro complete");
            },
            undefined,
            pendingFlipTokenIdsRef.current
          );

          if (pendingFlipTargetsRef.current.length > 0 && animManager && particleManager) {
            const flipTargets = pendingFlipTargetsRef.current;
            pendingFlipTargetsRef.current = [];
            flipAnimationInProgressRef.current = true;

            console.log(
              "[PixiHexGrid] Starting enemy flip animation for:",
              flipTargets.map((t) => t.tokenId)
            );

            const FLIP_DELAY_AFTER_MOVE = HERO_MOVE_DURATION_MS + 100;
            setTimeout(() => {
              animateEnemyFlips(
                layers,
                flipTargets,
                animManager,
                particleManager,
                0,
                () => {
                  pendingFlipTokenIdsRef.current = new Set();
                  flipAnimationInProgressRef.current = false;
                  console.log("[PixiHexGrid] Enemy flip animation complete");
                }
              );
            }, FLIP_DELAY_AFTER_MOVE);
          }

          // Render ruins tokens (static, no animation for normal updates)
          await renderRuinsTokens(layers, state.map.hexes);
        }
        console.log(
          `[renderAsync] renderEnemies: ${(performance.now() - t_enemies).toFixed(
            1
          )}ms`
        );

        const heroContainer = getOrCreateHeroContainer(layers, heroContainerRef);
        const prevPos = prevHeroPositionRef.current;

        if (heroPosition) {
          const targetPixel = hexToPixel(heroPosition);
          const heroMoved =
            prevPos && (prevPos.q !== heroPosition.q || prevPos.r !== heroPosition.r);

          if (heroMoved && animManager) {
            animManager.moveTo(
              "hero-move",
              heroContainer,
              targetPixel,
              HERO_MOVE_DURATION_MS,
              Easing.easeOutQuad
            );
          } else {
            heroContainer.position.set(targetPixel.x, targetPixel.y);
          }

          const activeHeroId = player?.heroId ?? null;
          renderHeroIntoContainer(heroContainer, heroPosition, activeHeroId, onHeroRightClick);
        }

        prevHeroPositionRef.current = heroPosition;

        setIsLoading(false);
      }

      if (shouldPlayTileIntro && animManager && particleManager && !introPlayedRef.current) {
        const BOARD_FADE_DURATION = 800;
        const PAUSE_BEFORE_INTRO = 450;

        const BOARD_SHAPE_STROKE_COLOR = 0x8b7355;
        renderStaticTileOutlines(
          layers.boardShape,
          state.map.tiles,
          0.6,
          BOARD_SHAPE_STROKE_COLOR
        );

        animManager.animate("board-fade-in", world, {
          endAlpha: 1,
          duration: BOARD_FADE_DURATION,
          easing: Easing.easeOutCubic,
          onComplete: () => {
            setTimeout(async () => {
              console.log("[PixiHexGrid] Fade complete, rendering tiles with intro...");

              await renderTiles(
                layers,
                state.map.tiles,
                animManager,
                particleManager,
                world,
                true,
                knownTileIdsRef.current,
                () => {
                  emitAnimationEvent("tiles-complete");
                  console.log("[PixiHexGrid] Tile intro complete");
                }
              );

              const PHASE5_TILE_STAGGER = 200;
              const PHASE5_SINGLE_TILE_TIME =
                HEX_OUTLINE_DURATION_MS +
                TILE_RISE_DURATION_MS +
                TILE_SLAM_DURATION_MS +
                200;
              const tileAnimationTime =
                (state.map.tiles.length - 1) * PHASE5_TILE_STAGGER +
                PHASE5_SINGLE_TILE_TIME +
                INTRO_PHASE_GAP_MS;

              const enemyCount = Object.values(state.map.hexes).reduce(
                (count, hex) => count + (hex.enemies?.length ?? 0),
                0
              );
              const ENEMY_DROP_DURATION = 250;
              const ENEMY_BOUNCE_DURATION = 100;
              const estimatedEnemyDuration =
                enemyCount > 0
                  ? (enemyCount - 1) * ENEMY_FLIP_STAGGER_MS +
                    ENEMY_DROP_DURATION +
                    ENEMY_BOUNCE_DURATION +
                    200
                  : 0;
              const heroRevealTime = tileAnimationTime + estimatedEnemyDuration;

              await renderEnemies(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true,
                tileAnimationTime,
                () => {
                  emitAnimationEvent("enemies-complete");
                  console.log("[PixiHexGrid] Enemy intro complete");
                }
              );

              // Render ruins tokens with drop animation (same timing as enemies)
              await renderRuinsTokens(
                layers,
                state.map.hexes,
                animManager,
                particleManager,
                true,
                tileAnimationTime
              );

              const heroContainer = getOrCreateHeroContainer(layers, heroContainerRef);
              if (heroPosition) {
                const targetPixel = hexToPixel(heroPosition);
                const activeHeroId = player?.heroId ?? null;

                heroContainer.alpha = 0;
                heroContainer.scale.set(0.8);
                heroContainer.position.set(targetPixel.x, targetPixel.y);
                renderHeroIntoContainer(heroContainer, heroPosition, activeHeroId, onHeroRightClick);

                setTimeout(() => {
                  particleManager.createPortal(layers.particles, targetPixel, {
                    heroId: activeHeroId ?? undefined,
                    onHeroEmerge: () => {
                      animManager.animate("hero-emerge", heroContainer, {
                        endAlpha: 1,
                        endScale: 1,
                        duration: PORTAL_HERO_EMERGE_DURATION_MS,
                        easing: Easing.easeOutCubic,
                      });
                    },
                    onComplete: () => {
                      emitAnimationEvent("hero-complete");
                      console.log("[PixiHexGrid] Hero portal complete");
                    },
                  });
                }, heroRevealTime);

                prevHeroPositionRef.current = heroPosition;
              }

              const tileCount = state.map.tiles.length;
              startIntro(tileCount, enemyCount);
              introPlayedRef.current = true;
              console.log(
                "[PixiHexGrid] Starting intro:",
                tileCount,
                "tiles,",
                enemyCount,
                "enemies"
              );
            }, PAUSE_BEFORE_INTRO);
          },
        });

        setIsLoading(false);
      }

      console.log(
        `[renderAsync] TOTAL: ${(performance.now() - renderStart).toFixed(1)}ms`
      );
      console.log("[PixiHexGrid] Rendered:", state.map.tiles.length, "tiles");
    };

    renderAsync();
  }, [
    isInitialized,
    state,
    player?.position,
    player?.heroId,
    exploreTargets,
    centerAndApplyCamera,
    emitAnimationEvent,
    startIntro,
    isInCinematic,
    playCinematic,
    appRef,
    layersRef,
    worldRef,
    animationManagerRef,
    particleManagerRef,
    cameraRef,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    backgroundRef,
    heroContainerRef,
    onHeroRightClick,
  ]);

  return {
    isLoading,
    revealingHexKeysRef,
    revealingUpdateCounter,
    resetRenderer,
  };
}

function buildRenderPlan(
  state: ClientGameState,
  prevTileCountRef: MutableRefObject<number>,
  knownTileIdsRef: MutableRefObject<Set<string>>
) {
  const currentTileCount = state.map.tiles.length;
  const isFirstLoad = prevTileCountRef.current === 0 && currentTileCount > 0;
  const shouldPlayTileIntro = isFirstLoad;
  prevTileCountRef.current = currentTileCount;

  const newTiles = state.map.tiles.filter(
    (tile) => tile.tileId && !knownTileIdsRef.current.has(tile.tileId)
  );
  const isExploration = !isFirstLoad && newTiles.length > 0;

  return {
    isFirstLoad,
    shouldPlayTileIntro,
    isExploration,
    newTiles,
  };
}

function collectTileHexKeys(tiles: readonly TileState[]): Set<string> {
  const hexKeys = new Set<string>();
  for (const tile of tiles) {
    hexKeys.add(hexKey(tile.centerCoord));
    for (const offset of TILE_HEX_OFFSETS) {
      hexKeys.add(
        hexKey({ q: tile.centerCoord.q + offset.q, r: tile.centerCoord.r + offset.r })
      );
    }
  }
  return hexKeys;
}

function collectAdjacentFlipTargets(
  state: ClientGameState,
  excludedHexKeys: Set<string>,
  revealedEnemyTokenIds: Set<string>
): EnemyFlipTarget[] {
  const adjacentFlipTargets: EnemyFlipTarget[] = [];
  for (const hex of Object.values(state.map.hexes)) {
    const hKey = hexKey(hex.coord);
    if (excludedHexKeys.has(hKey)) continue;

    for (let i = 0; i < hex.enemies.length; i++) {
      const enemy = hex.enemies[i];
      if (enemy?.isRevealed && enemy.tokenId) {
        if (!revealedEnemyTokenIds.has(enemy.tokenId)) {
          adjacentFlipTargets.push({
            tokenId: enemy.tokenId,
            hexCoord: hex.coord,
            color: enemy.color,
            indexInHex: i,
            totalInHex: hex.enemies.length,
          });
        }
      }
    }
  }
  return adjacentFlipTargets;
}

function collectRevealedEnemies(state: ClientGameState) {
  const currentRevealedEnemyIds = new Set<string>();
  const enemyInfoByTokenId = new Map<
    string,
    { hexCoord: { q: number; r: number }; color: string; indexInHex: number; totalInHex: number }
  >();

  for (const hex of Object.values(state.map.hexes)) {
    for (let i = 0; i < hex.enemies.length; i++) {
      const enemy = hex.enemies[i];
      if (enemy?.isRevealed && enemy.tokenId) {
        currentRevealedEnemyIds.add(enemy.tokenId);
        enemyInfoByTokenId.set(enemy.tokenId, {
          hexCoord: hex.coord,
          color: enemy.color,
          indexInHex: i,
          totalInHex: hex.enemies.length,
        });
      }
    }
  }

  return { currentRevealedEnemyIds, enemyInfoByTokenId };
}
