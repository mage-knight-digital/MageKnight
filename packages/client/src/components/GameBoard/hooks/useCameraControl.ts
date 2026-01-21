/**
 * Camera control hook for PixiJS hex grid
 * 
 * Manages camera state, pan/zoom controls, and keyboard/mouse event handlers.
 */

import { useRef, useCallback } from "react";
import type { RefObject, MutableRefObject } from "react";
import type { FederatedPointerEvent, Application, Container } from "pixi.js";
import type { PixelPosition, CameraState } from "../pixi/types";
import {
  createInitialCameraState,
  applyCamera,
  updateCamera,
  handleWheelZoom,
  handlePointerDown as cameraPointerDown,
  handlePointerMove as cameraPointerMove,
  handlePointerUp as cameraPointerUp,
  centerCameraOn,
  isCameraPanKey,
} from "../pixi/camera";

interface UseCameraControlParams {
  appRef: RefObject<Application | null>;
  worldRef: RefObject<Container | null>;
}

interface UseCameraControlReturn {
  // Refs
  cameraRef: MutableRefObject<CameraState>;
  isDraggingRef: MutableRefObject<boolean>;
  lastPointerPosRef: MutableRefObject<PixelPosition>;
  keysDownRef: MutableRefObject<Set<string>>;
  hasCenteredOnHeroRef: MutableRefObject<boolean>;
  cameraReadyRef: MutableRefObject<boolean>;
  // Event handlers
  handlePointerDown: (event: FederatedPointerEvent) => void;
  handlePointerMove: (event: FederatedPointerEvent) => void;
  handlePointerUp: () => void;
  handleWheel: (event: WheelEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
  // Helper functions
  centerAndApplyCamera: (worldPos: PixelPosition, instant?: boolean) => void;
  // Ticker callback (to be called from app.ticker)
  updateCameraTick: (deltaMS: number) => void;
}

export function useCameraControl({
  appRef,
  worldRef,
}: UseCameraControlParams): UseCameraControlReturn {
  // Camera state refs
  const cameraRef = useRef<CameraState>(createInitialCameraState());
  const isDraggingRef = useRef(false);
  const lastPointerPosRef = useRef<PixelPosition>({ x: 0, y: 0 });
  const keysDownRef = useRef<Set<string>>(new Set());
  const hasCenteredOnHeroRef = useRef(false);
  const cameraReadyRef = useRef(false);

  // Camera helper to center and apply
  const centerAndApplyCamera = useCallback(
    (worldPos: PixelPosition, instant: boolean = false) => {
      const app = appRef.current;
      const world = worldRef.current;
      if (!app || !world) return;

      centerCameraOn(cameraRef.current, worldPos, instant);
      if (instant) {
        applyCamera(app, world, cameraRef.current);
      }
    },
    [appRef, worldRef]
  );

  // Camera event handlers
  const handlePointerDown = useCallback((event: FederatedPointerEvent) => {
    cameraPointerDown(
      event,
      cameraRef.current,
      lastPointerPosRef.current,
      (dragging) => { isDraggingRef.current = dragging; }
    );
  }, []);

  const handlePointerMove = useCallback((event: FederatedPointerEvent) => {
    cameraPointerMove(
      event,
      cameraRef.current,
      lastPointerPosRef.current,
      isDraggingRef.current
    );
  }, []);

  const handlePointerUp = useCallback(() => {
    cameraPointerUp(
      cameraRef.current,
      (dragging) => { isDraggingRef.current = dragging; }
    );
  }, []);

  const handleWheel = useCallback((event: WheelEvent) => {
    const app = appRef.current;
    if (!app) return;
    handleWheelZoom(event, app, cameraRef.current);
  }, [appRef]);

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    if (isCameraPanKey(key)) {
      keysDownRef.current.add(key);
    }
  }, []);

  const handleKeyUp = useCallback((event: KeyboardEvent) => {
    const key = event.key.toLowerCase();
    keysDownRef.current.delete(key);
  }, []);

  // Ticker callback for camera updates
  const updateCameraTick = useCallback((deltaMS: number) => {
    const app = appRef.current;
    const world = worldRef.current;
    if (!app || !world || !cameraReadyRef.current) return;
    
    updateCamera(cameraRef.current, keysDownRef.current, deltaMS);
    applyCamera(app, world, cameraRef.current);
  }, [appRef, worldRef]);

  return {
    cameraRef,
    isDraggingRef,
    lastPointerPosRef,
    keysDownRef,
    hasCenteredOnHeroRef,
    cameraReadyRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handleWheel,
    handleKeyDown,
    handleKeyUp,
    centerAndApplyCamera,
    updateCameraTick,
  };
}
