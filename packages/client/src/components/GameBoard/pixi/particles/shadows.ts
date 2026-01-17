/**
 * Shadow Effects
 *
 * Drop shadows for 3D rising effects on tiles and small objects.
 */

import { Container, Graphics } from "pixi.js";
import type { PixelPosition } from "../types";
import { get7HexClusterVertices } from "./outlineTracers";

/**
 * Drop shadow for 3D rising effect - uses hex cluster shape
 */
export class DropShadow {
  private graphics: Graphics;
  private _scale = 1;
  private _alpha = 0.3;
  private _offsetY = 0; // Vertical offset for shadow (increases as tile rises)
  private vertices: PixelPosition[];

  constructor(
    private container: Container,
    private center: PixelPosition,
    hexSize: number
  ) {
    this.graphics = new Graphics();
    this.graphics.zIndex = -1; // Below other content
    this.container.addChild(this.graphics);
    // Get the hex cluster vertices for the shadow shape
    this.vertices = get7HexClusterVertices(hexSize);
    this.render();
  }

  set scale(value: number) {
    this._scale = value;
    this.render();
  }

  get scale(): number {
    return this._scale;
  }

  set alpha(value: number) {
    this._alpha = value;
    this.render();
  }

  get alpha(): number {
    return this._alpha;
  }

  set offsetY(value: number) {
    this._offsetY = value;
    this.render();
  }

  get offsetY(): number {
    return this._offsetY;
  }

  private render(): void {
    this.graphics.clear();

    // Shadow centered directly under tile - no offset
    const shadowPoints = this.vertices.map((v) => ({
      x: this.center.x + v.x * this._scale,
      y: this.center.y + v.y * this._scale,
    }));

    // Soft dark shadow
    this.graphics.poly(shadowPoints).fill({ color: 0x000000, alpha: 0.25 });
  }

  destroy(): void {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}

/**
 * Simple circular drop shadow for small objects like enemies
 */
export class CircleShadow {
  private graphics: Graphics;
  private _scale = 1;
  private _alpha = 0.3;
  private radius: number;

  constructor(
    private container: Container,
    private center: PixelPosition,
    radius: number
  ) {
    this.graphics = new Graphics();
    this.graphics.zIndex = -1;
    this.container.addChild(this.graphics);
    this.radius = radius;
    this.render();
  }

  set scale(value: number) {
    this._scale = value;
    this.render();
  }

  get scale(): number {
    return this._scale;
  }

  set alpha(value: number) {
    this._alpha = value;
    this.render();
  }

  get alpha(): number {
    return this._alpha;
  }

  private render(): void {
    this.graphics.clear();
    // Simple circular shadow
    this.graphics
      .circle(this.center.x, this.center.y, this.radius * this._scale)
      .fill({ color: 0x000000, alpha: this._alpha });
  }

  destroy(): void {
    this.container.removeChild(this.graphics);
    this.graphics.destroy();
  }
}
