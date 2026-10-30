import { Container, Graphics } from "pixi.js";

export interface Point2D {
  x: number;
  y: number;
}

export class Projectile extends Container {
  private bulletGraphics: Graphics;
  private trailGraphics: Graphics;
  private points: Point2D[];
  private currentIndex: number = 0;
  private speedFactor: number = 1.0;
  private onCompleteCallback?: () => void;

  constructor(points: Point2D[], onComplete?: () => void) {
    super();
    this.points = points;
    this.onCompleteCallback = onComplete;

    this.trailGraphics = new Graphics();
    this.bulletGraphics = new Graphics();

    // Glowing bullet shell
    this.bulletGraphics.circle(0, 0, 5).fill(0xff9800);
    this.bulletGraphics.circle(0, 0, 3).fill(0xffeb3b);

    this.addChild(this.trailGraphics);
    this.addChild(this.bulletGraphics);

    if (points.length > 0) {
      this.x = points[0].x;
      this.y = points[0].y;
    }
  }

  public update(_dt: number): boolean {
    if (this.currentIndex >= this.points.length - 1) {
      if (this.onCompleteCallback) {
        this.onCompleteCallback();
        this.onCompleteCallback = undefined;
      }
      return true; // Finished
    }

    // Advance 1-2 points per frame
    this.currentIndex = Math.min(this.points.length - 1, this.currentIndex + Math.ceil(this.speedFactor));
    const pt = this.points[this.currentIndex];
    this.bulletGraphics.x = pt.x - this.x;
    this.bulletGraphics.y = pt.y - this.y;

    // Render trail
    this.trailGraphics.clear();
    const startIdx = Math.max(0, this.currentIndex - 8);
    if (this.currentIndex > startIdx) {
      this.trailGraphics.moveTo(this.points[startIdx].x - this.x, this.points[startIdx].y - this.y);
      for (let i = startIdx + 1; i <= this.currentIndex; i++) {
        this.trailGraphics.lineTo(this.points[i].x - this.x, this.points[i].y - this.y);
      }
      this.trailGraphics.stroke({ width: 2.5, color: 0xffa726, alpha: 0.7 });
    }

    return false;
  }
}
