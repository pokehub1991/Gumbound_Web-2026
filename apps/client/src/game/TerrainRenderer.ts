import { Container, Sprite, Texture } from "pixi.js";

export class TerrainRenderer extends Container {
  public readonly mapWidth: number;
  public readonly mapHeight: number;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private sprite: Sprite;
  private texture: Texture;

  constructor(width: number = 2400, height: number = 800) {
    super();
    this.mapWidth = width;
    this.mapHeight = height;

    this.canvas = document.createElement("canvas");
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("Could not acquire 2D context for terrain");
    this.ctx = ctx;

    this.generateDefaultTerrain();

    this.texture = Texture.from(this.canvas);
    this.sprite = new Sprite(this.texture);
    this.addChild(this.sprite);
  }

  public generateDefaultTerrain(
    groundBaseY: number = 560,
    roughness: number = 0.008,
    amplitude: number = 65,
    groundColor: string = "#593a1d",
    grassColor: string = "#4da333"
  ) {
    this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);

    // Draw terrain body matching exact server mathematical formula
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.mapHeight);

    for (let x = 0; x <= this.mapWidth; x++) {
      const elevation = Math.sin(x * roughness) * amplitude + Math.sin(x * roughness * 2.5) * (amplitude * 0.3);
      const y = Math.round(groundBaseY + elevation);
      this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(this.mapWidth, this.mapHeight);
    this.ctx.closePath();

    // Fill with soil gradient
    const gradient = this.ctx.createLinearGradient(0, groundBaseY - amplitude - 50, 0, this.mapHeight);
    gradient.addColorStop(0, "#734d26");
    gradient.addColorStop(0.3, groundColor);
    gradient.addColorStop(1.0, "#261a0d");
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Draw grass top border
    this.ctx.lineWidth = 4;
    this.ctx.strokeStyle = grassColor;
    this.ctx.stroke();

    if (this.texture) {
      this.texture.source.update();
    }
  }

  public clearCircle(cx: number, cy: number, radius: number) {
    this.ctx.save();
    this.ctx.globalCompositeOperation = "destination-out";
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();

    // Draw subtle dark burn mark around crater edge
    this.ctx.save();
    this.ctx.globalCompositeOperation = "source-atop";
    this.ctx.strokeStyle = "rgba(20, 10, 5, 0.4)";
    this.ctx.lineWidth = 4;
    this.ctx.beginPath();
    this.ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();

    // Notify PixiJS texture of the updated canvas buffer
    this.texture.source.update();
  }

  public isGround(x: number, y: number): boolean {
    if (x < 0 || x >= this.mapWidth || y < 0 || y >= this.mapHeight) return false;
    const pixel = this.ctx.getImageData(x, y, 1, 1).data;
    return pixel[3] > 32; // Alpha threshold
  }

  public findSurfaceY(x: number, startY: number): number {
    const minScanY = Math.max(10, Math.floor(startY - 35));
    const maxScanY = Math.min(this.mapHeight - 1, Math.floor(startY + 60));

    for (let y = minScanY; y <= maxScanY; y++) {
      if (this.isGround(Math.floor(x), y)) {
        return y;
      }
    }
    for (let y = maxScanY + 1; y < this.mapHeight; y += 4) {
      if (this.isGround(Math.floor(x), y)) {
        for (let r = y - 4; r <= y; r++) {
          if (this.isGround(Math.floor(x), r)) return r;
        }
        return y;
      }
    }
    return startY;
  }

  public getSlopeAngle(x: number, currentY: number): { angle: number; groundY: number; dy: number } {
    const probeDist = 14;
    const yLeft = this.findSurfaceY(x - probeDist, currentY);
    const yRight = this.findSurfaceY(x + probeDist, currentY);
    const groundY = (yLeft + yRight) / 2;
    const dx = probeDist * 2;
    const dy = yRight - yLeft;
    const rawAngle = Math.atan2(dy, dx);
    // Clamp slope to max ±55 degrees (~0.96 rad)
    const maxSlope = 0.96;
    const angle = Math.max(-maxSlope, Math.min(maxSlope, rawAngle));
    return { angle, groundY, dy };
  }
}

