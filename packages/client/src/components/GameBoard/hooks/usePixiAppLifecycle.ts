import { useEffect, useState } from "react";
import { Application, Container, type FederatedPointerEvent } from "pixi.js";
import type { MutableRefObject, RefObject } from "react";
import type { WorldLayers } from "../pixi/types";
import { AnimationManager } from "../pixi/animations";
import { ParticleManager } from "../pixi/particles";
import { BackgroundAtmosphere } from "../pixi/background";
import { setGhostHexTicker, cleanupGhostHexEffects } from "../pixi/rendering";
import { createWorldLayers } from "../pixi/worldLayers";

interface UsePixiAppLifecycleParams {
  containerRef: RefObject<HTMLDivElement | null>;
  appRef: MutableRefObject<Application | null>;
  layersRef: MutableRefObject<WorldLayers | null>;
  worldRef: MutableRefObject<Container | null>;
  backgroundRef: MutableRefObject<BackgroundAtmosphere | null>;
  animationManagerRef: MutableRefObject<AnimationManager | null>;
  particleManagerRef: MutableRefObject<ParticleManager | null>;
  handlePointerDown: (event: FederatedPointerEvent) => void;
  handlePointerMove: (event: FederatedPointerEvent) => void;
  handlePointerUp: () => void;
  updateCameraTick: (deltaMS: number) => void;
  setApp: (app: Application | null) => void;
  setOverlayLayer: (layer: Container | null) => void;
  hasCenteredOnHeroRef: MutableRefObject<boolean>;
  cameraReadyRef: MutableRefObject<boolean>;
  onDestroyed?: () => void;
}

export function usePixiAppLifecycle({
  containerRef,
  appRef,
  layersRef,
  worldRef,
  backgroundRef,
  animationManagerRef,
  particleManagerRef,
  handlePointerDown,
  handlePointerMove,
  handlePointerUp,
  updateCameraTick,
  setApp,
  setOverlayLayer,
  hasCenteredOnHeroRef,
  cameraReadyRef,
  onDestroyed,
}: UsePixiAppLifecycleParams): boolean {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    let destroyed = false;

    const initPixi = async () => {
      const t0 = performance.now();
      const app = new Application();

      await app.init({
        backgroundAlpha: 0, // Transparent background - BackgroundAtmosphere provides the color
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
      });
      console.log(`[initPixi] app.init: ${(performance.now() - t0).toFixed(1)}ms`);

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const t1 = performance.now();
      const { world, layers } = createWorldLayers();
      console.log(`[initPixi] createWorldLayers: ${(performance.now() - t1).toFixed(1)}ms`);

      const t2 = performance.now();
      const background = new BackgroundAtmosphere();
      background.initialize(app.screen.width, app.screen.height);
      console.log(`[initPixi] BackgroundAtmosphere: ${(performance.now() - t2).toFixed(1)}ms`);
      backgroundRef.current = background;

      app.stage.addChild(background.getContainer());
      app.stage.addChild(world);

      const screenOverlay = new Container();
      screenOverlay.label = "screenOverlay";
      app.stage.addChild(screenOverlay);

      world.visible = false;

      const handleResize = () => {
        if (backgroundRef.current) {
          backgroundRef.current.resize(app.screen.width, app.screen.height);
        }
      };
      app.renderer.on("resize", handleResize);

      app.stage.eventMode = "static";
      app.stage.hitArea = app.screen;

      app.stage.on("pointerdown", handlePointerDown);
      app.stage.on("pointermove", handlePointerMove);
      app.stage.on("pointerup", handlePointerUp);
      app.stage.on("pointerupoutside", handlePointerUp);

      app.canvas.addEventListener("contextmenu", (e) => e.preventDefault());

      app.ticker.add((ticker) => {
        updateCameraTick(ticker.deltaMS);
      });

      const animManager = new AnimationManager();
      animManager.attach(app.ticker);
      animationManagerRef.current = animManager;

      const particleManager = new ParticleManager();
      particleManager.attach(app.ticker);
      particleManagerRef.current = particleManager;

      setGhostHexTicker(app.ticker);
      background.attach(app.ticker);

      appRef.current = app;
      layersRef.current = layers;
      worldRef.current = world;

      setApp(app);
      setOverlayLayer(screenOverlay);

      console.log("[PixiHexGrid] Initialized");
      setIsInitialized(true);
    };

    initPixi();

    return () => {
      destroyed = true;
      setApp(null);
      setOverlayLayer(null);
      animationManagerRef.current?.detach();
      animationManagerRef.current = null;
      particleManagerRef.current?.clear();
      particleManagerRef.current?.detach();
      particleManagerRef.current = null;
      cleanupGhostHexEffects();
      if (backgroundRef.current && appRef.current) {
        backgroundRef.current.detach(appRef.current.ticker);
        backgroundRef.current.destroy();
        backgroundRef.current = null;
      }
      if (appRef.current) {
        console.log("[PixiHexGrid] Destroying");
        appRef.current.destroy(true, { children: true, texture: true });
        appRef.current = null;
        layersRef.current = null;
        worldRef.current = null;
        hasCenteredOnHeroRef.current = false;
        cameraReadyRef.current = false;
        setIsInitialized(false);
      }
      onDestroyed?.();
    };
  }, [
    containerRef,
    appRef,
    layersRef,
    worldRef,
    backgroundRef,
    animationManagerRef,
    particleManagerRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    updateCameraTick,
    setApp,
    setOverlayLayer,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    onDestroyed,
  ]);

  return isInitialized;
}
