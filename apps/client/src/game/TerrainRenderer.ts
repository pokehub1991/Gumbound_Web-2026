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

  public generateDefaultTerrain(groundBaseY: number = 550) {
    this.ctx.clearRect(0, 0, this.mapWidth, this.mapHeight);

    // Draw terrain body
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.mapHeight);

    for (let x = 0; x <= this.mapWidth; x += 10) {
      const y = groundBaseY + Math.sin(x * 0.008) * 60 + Math.sin(x * 0.02) * 20;
      if (x === 0) this.ctx.lineTo(x, y);
      else this.ctx.lineTo(x, y);
    }

    this.ctx.lineTo(this.mapWidth, this.mapHeight);
    this.ctx.closePath();

    // Fill with soil gradient
    const gradient = this.ctx.createLinearGradient(0, groundBaseY - 80, 0, this.mapHeight);
    gradient.addColorStop(0, "#734d26");
    gradient.addColorStop(0.3, "#593a1d");
    gradient.addColorStop(1.0, "#261a0d");
    this.ctx.fillStyle = gradient;
    this.ctx.fill();

    // Draw grass top border
    this.ctx.lineWidth = 6;
    this.ctx.strokeStyle = "#4da333";
    this.ctx.stroke();
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
}

