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

    container.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      container.removeEventListener("wheel", handleWheel);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isInitialized, containerRef, handleWheel, handleKeyDown, handleKeyUp]);
}
