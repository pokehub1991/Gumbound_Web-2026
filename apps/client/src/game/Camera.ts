import { Container } from "pixi.js";

export class Camera {
  private targetX: number = 0;
  private targetY: number = 0;
  public zoom: number = 1.0;
  public readonly viewportWidth: number;
  public readonly viewportHeight: number;

  constructor(
    private readonly stageContainer: Container,
    viewportWidth: number = 800,
    viewportHeight: number = 600
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
  }

  public panTo(x: number, y: number) {
    this.targetX = x;
    this.targetY = y;
  }

  public update(_dt: number = 1) {
    // Smooth interpolation towards target
    const currentX = -this.stageContainer.x + this.viewportWidth / 2;
    const currentY = -this.stageContainer.y + this.viewportHeight / 2;

    const newX = currentX + (this.targetX - currentX) * 0.1;
    const newY = currentY + (this.targetY - currentY) * 0.1;

    this.stageContainer.scale.set(this.zoom);
    this.stageContainer.x = this.viewportWidth / 2 - newX * this.zoom;
    this.stageContainer.y = this.viewportHeight / 2 - newY * this.zoom;
  }
}

