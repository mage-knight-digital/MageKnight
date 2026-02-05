import { useEffect, useState } from "react";
import { Application, Container, type FederatedPointerEvent } from "pixi.js";
import "@pixi/layout"; // Side-effect import to register layout system with PixiJS
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
      // Fresh initialization
      const app = new Application();

      await app.init({
        backgroundAlpha: 0, // Transparent background - BackgroundAtmosphere provides the color
        resizeTo: container,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
        // @pixi/layout v3 configuration
        layout: {
          autoUpdate: true,
          enableDebug: false, // Set to true to visualize layout boxes during development
          debugModificationCount: 0,
          throttle: 100,
        } as unknown as import("@pixi/layout").LayoutSystemOptions,
      });

      if (destroyed) {
        app.destroy(true);
        return;
      }

      container.appendChild(app.canvas);

      const { world, layers } = createWorldLayers();

      const background = new BackgroundAtmosphere();
      background.initialize(app.screen.width, app.screen.height);
      backgroundRef.current = background;

      app.stage.addChild(background.getContainer());
      app.stage.addChild(world);

      const screenOverlay = new Container();
      screenOverlay.label = "screenOverlay";
      screenOverlay.sortableChildren = true; // Enable z-index sorting for overlays
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

      // Expose app globally for debugging (accessible via window.__PIXI_APP__)
      (window as unknown as { __PIXI_APP__: typeof app }).__PIXI_APP__ = app;

      setApp(app);
      setOverlayLayer(screenOverlay);

      setIsInitialized(true);
    };

    initPixi();

    return () => {
      destroyed = true;

      // Full cleanup on unmount
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
