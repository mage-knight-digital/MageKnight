import type { Container } from "pixi.js";

type HitTestableDisplayObject = Pick<Container, "eventMode" | "cursor">;
type InvisibleHitTarget = Pick<Container, "eventMode" | "cursor" | "alpha">;

export function makePointerPassthrough(displayObject: HitTestableDisplayObject): void {
  displayObject.eventMode = "none";
  displayObject.cursor = "default";
}

export function makeInvisiblePointerHitTarget(displayObject: InvisibleHitTarget): void {
  displayObject.eventMode = "static";
  displayObject.cursor = "pointer";
  displayObject.alpha = 0.001;
}
