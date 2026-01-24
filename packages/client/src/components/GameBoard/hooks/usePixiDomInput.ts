import { useEffect } from "react";
import type { RefObject } from "react";

interface UsePixiDomInputParams {
  isInitialized: boolean;
  containerRef: RefObject<HTMLDivElement | null>;
  handleWheel: (event: WheelEvent) => void;
  handleKeyDown: (event: KeyboardEvent) => void;
  handleKeyUp: (event: KeyboardEvent) => void;
}

export function usePixiDomInput({
  isInitialized,
  containerRef,
  handleWheel,
  handleKeyDown,
  handleKeyUp,
}: UsePixiDomInputParams) {
  useEffect(() => {
    if (!isInitialized) return;

    const container = containerRef.current;
    if (!container) return;

    // Prevent default context menu on right-click (we use it for site panel)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isInitialized, containerRef, handleWheel, handleKeyDown, handleKeyUp]);
}
