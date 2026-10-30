import { Container } from "pixi.js";

export class Camera {
  private targetX: number = 0;
  private targetY: number = 0;
  public zoom: number = 1.35;
  public viewportWidth: number;
  public viewportHeight: number;

  constructor(
    private readonly stageContainer: Container,
    viewportWidth: number = 800,
    viewportHeight: number = 600,
    initialZoom: number = 1.35
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.zoom = initialZoom;
  }

  public panTo(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  public setZoom(zoom: number) {
    this.zoom = zoom;
  }

  public setViewport(width: number, height: number) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  public update(_dt: number = 1) {
    // Current world coordinate centered in viewport
    const currentX = (this.viewportWidth / 2 - this.stageContainer.x) / this.zoom;
    const currentY = (this.viewportHeight / 2 - this.stageContainer.y) / this.zoom;

    // Smooth camera tracking
    const newX = currentX + (this.targetX - currentX) * 0.12;
    const newY = currentY + (this.targetY - currentY) * 0.12;

    this.stageContainer.scale.set(this.zoom);
    this.stageContainer.x = this.viewportWidth / 2 - newX * this.zoom;
    this.stageContainer.y = this.viewportHeight / 2 - newY * this.zoom;
  }
}
